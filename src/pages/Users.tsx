import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { Profile } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, Table, useToast } from "../components/ui";

async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

export default function Users() {
  const { profile } = useAuth();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Profile | null>(null);
  const [add, setAdd] = useState({ full_name: "", email: "", role: "teacher", password: "" });
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useFetch<Profile[]>(async () => {
    const { data, error } = await supabase
      .from("profiles").select("*").order("full_name");
    if (error) throw error;
    return data as Profile[];
  });

  async function createUser() {
    setBusy(true);
    const r = await callAdmin({ action: "create", ...add });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Could not add user", "error"); return; }
    toast(`${add.full_name} added`);
    setAddOpen(false);
    setAdd({ full_name: "", email: "", role: "teacher", password: "" });
    refetch();
  }

  async function toggleActive(u: Profile) {
    const verb = u.is_active ? "Disable" : "Enable";
    if (!confirm(`${verb} ${u.full_name}'s login?`)) return;
    const r = await callAdmin({ action: "set_active", user_id: u.id, active: !u.is_active });
    if (!r.ok) { toast(r.error ?? "Failed", "error"); return; }
    toast(`${u.full_name} ${u.is_active ? "disabled" : "enabled"}`);
    refetch();
  }

  async function resetPassword() {
    if (!resetFor) return;
    setBusy(true);
    const r = await callAdmin({ action: "reset_password", user_id: resetFor.id, password: newPass });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Failed", "error"); return; }
    toast(`Password reset for ${resetFor.full_name}`);
    setResetFor(null); setNewPass("");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">Teachers and staff who can sign in.</p>
        <Button onClick={() => setAddOpen(true)}>Add person</Button>
      </div>

      <Card>
        {loading ? <Empty title="Loading…" hint="" />
          : !data || data.length === 0 ? <Empty title="No one yet" hint="Add a teacher or staff member to give them a login." />
          : (
            <Table head={["Name", "Email", "Role", "Status", ""]}>
              {data.map((u) => (
                <tr key={u.id} className="hover:bg-paper/60">
                  <td className="px-4 py-2.5">{u.full_name}{u.id === profile?.id && <span className="text-muted text-xs"> (you)</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{u.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted">{u.role}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs uppercase tracking-wide ${u.is_active ? "text-ok" : "text-danger"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {u.id !== profile?.id && (
                      <>
                        <button className="text-sm text-brand hover:underline mr-3" onClick={() => setResetFor(u)}>Reset password</button>
                        <button className="text-sm text-danger hover:underline" onClick={() => toggleActive(u)}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add person">
        <div className="space-y-3">
          <Field label="Full name"><Input value={add.full_name} onChange={(e) => setAdd({ ...add, full_name: e.target.value })} /></Field>
          <Field label="Email (this is their login)"><Input type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <Select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })}>
                <option value="teacher">Teacher</option>
                <option value="staff">Staff (non-teaching)</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
            <Field label="Temporary password"><Input value={add.password} onChange={(e) => setAdd({ ...add, password: e.target.value })} placeholder="min. 8 characters" /></Field>
          </div>
          <p className="text-xs text-muted">Share the temporary password with them; they can change it later. At least 8 characters.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={busy || !add.full_name || !add.email || add.password.length < 8}>
              {busy ? "Adding…" : "Add person"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password — ${resetFor?.full_name ?? ""}`}>
        <div className="space-y-3">
          <Field label="New temporary password">
            <Input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="min. 8 characters" />
          </Field>
          <p className="text-xs text-muted">Tell them the new password. They sign in with it and can change it afterwards.</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button onClick={resetPassword} disabled={busy || newPass.length < 8}>{busy ? "Saving…" : "Reset password"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
