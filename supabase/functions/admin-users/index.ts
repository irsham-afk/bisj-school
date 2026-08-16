// supabase/functions/admin-users/index.ts
// Secure admin-only user management. Uses the service-role key (server-side
// ONLY) and refuses anything unless the caller is an active admin of the school.
// Deploy:  supabase functions deploy admin-users
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ ok: false, error: "Not signed in" });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Identify the caller and confirm they are an active admin.
    const { data: who, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !who.user) return json({ ok: false, error: "Your session has expired — sign in again." });
    const { data: caller } = await admin
      .from("profiles").select("role, school_id, is_active").eq("id", who.user.id).maybeSingle();
    if (!caller || caller.role !== "admin" || caller.is_active === false)
      return json({ ok: false, error: "Only admins can manage users." });

    const body = await req.json();
    const action = body.action as string;

    // ---- create a new login ----
    if (action === "create") {
      const { email, full_name, role, password, is_teaching } = body;
      if (!email || !full_name || !password)
        return json({ ok: false, error: "Name, email and a temporary password are all required." });
      if (String(password).length < 8)
        return json({ ok: false, error: "The temporary password must be at least 8 characters." });
      const r = ["teacher", "staff", "admin"].includes(role) ? role : "teacher";

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created.user)
        return json({ ok: false, error: cErr?.message ?? "Could not create that login (is the email already used?)." });

      const { error: pErr } = await admin.from("profiles").insert({
        id: created.user.id, school_id: caller.school_id, full_name, email,
        role: r, is_teaching: is_teaching ?? r === "teacher",
      });
      if (pErr) {                       // don't leave an orphaned login behind
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ ok: false, error: pErr.message });
      }
      // Explicitly set the password (same call as reset) so the new login works immediately.
      await admin.auth.admin.updateUserById(created.user.id, { password, email_confirm: true });
      return json({ ok: true });
    }

    // Everything below targets an existing user — must be in the caller's school.
    const targetId = body.user_id as string;
    if (!targetId) return json({ ok: false, error: "No user selected." });
    const { data: target } = await admin.from("profiles").select("school_id").eq("id", targetId).maybeSingle();
    if (!target || target.school_id !== caller.school_id)
      return json({ ok: false, error: "That user is not in your school." });

    // ---- enable / disable a login ----
    if (action === "set_active") {
      const active = !!body.active;
      await admin.from("profiles").update({ is_active: active }).eq("id", targetId);
      // also block/restore the actual sign-in
      await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
      return json({ ok: true });
    }

    // ---- reset a password ----
    if (action === "reset_password") {
      const password = body.password as string;
      if (!password || password.length < 8)
        return json({ ok: false, error: "The new password must be at least 8 characters." });
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return json({ ok: false, error: error.message });
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action." });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
