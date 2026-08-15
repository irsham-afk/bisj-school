import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Field, Input, useToast } from "../components/ui";

export default function Account() {
  const { profile } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (pw.length < 8) { toast("Use at least 8 characters", "error"); return; }
    if (pw !== pw2) { toast("The two passwords don't match", "error"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw(""); setPw2("");
      toast("Password changed");
    } catch (e: any) { toast(e.message ?? "Could not change password", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <h2 className="font-display text-2xl">My account</h2>
        <p className="text-sm text-muted">{profile?.full_name} · {profile?.email}</p>
      </div>
      <Card>
        <div className="p-4 space-y-3">
          <h3 className="font-semibold">Change my password</h3>
          <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></Field>
          <Field label="Confirm new password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || !pw}>{busy ? "Saving…" : "Change password"}</Button>
          </div>
          <p className="text-xs text-muted">You'll stay signed in. Use your new password next time you sign in.</p>
        </div>
      </Card>
    </div>
  );
}
