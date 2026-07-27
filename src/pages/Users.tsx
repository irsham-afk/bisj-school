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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkPass, setBulkPass] = useState("Bisj2026!");
  const [bulkDomain, setBulkDomain] = useState("bisj.school");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ name: string; email: string; ok: boolean; error?: string }[]>([]);

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

  function emailFor(raw: string) {
    const full = raw.replace(/^(Ms|Mr|Mrs|Miss)\.?\s*/i, "").trim();
    const first = (full.split(/\s+/)[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "");
    return { full, email: `${first}@${bulkDomain}` };
  }

  async function bulkCreate() {
    const names = bulkText.split("\n").map((x) => x.trim()).filter(Boolean);
    if (names.length === 0) { toast("Paste at least one name", "error"); return; }
    if (bulkPass.length < 8) { toast("The shared password must be at least 8 characters", "error"); return; }
    setBulkBusy(true); setBulkResults([]);
    const results: { name: string; email: string; ok: boolean; error?: string }[] = [];
    for (const raw of names) {
      const { full, email } = emailFor(raw);
      const r = await callAdmin({ action: "create", full_name: full, email, role: "teacher", password: bulkPass, is_teaching: true });
      results.push({ name: full, email, ok: !!r.ok, error: r.error });
      setBulkResults([...results]);
    }
    setBulkBusy(false);
    refetch();
    toast(`Created ${results.filter((r) => r.ok).length} of ${names.length}`);
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
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => { setBulkResults([]); setBulkOpen(true); }}>Add many</Button>
          <Button onClick={() => setAddOpen(true)}>Add person</Button>
        </div>
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

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Add many teachers at once">
        <div className="space-y-3">
          <p className="text-xs text-muted">Paste one full name per line. Each gets a login email made from their first name, and the same starting password below. They can change it after first sign-in.</p>
          <Field label="Names (one per line)">
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8}
              placeholder={"Shifana\nNiveen\nAzra"}
              className="w-full rounded-lg border border-line p-2 text-sm font-mono" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email domain"><Input value={bulkDomain} onChange={(e) => setBulkDomain(e.target.value)} /></Field>
            <Field label="Shared starting password"><Input value={bulkPass} onChange={(e) => setBulkPass(e.target.value)} /></Field>
          </div>
          {bulkText.trim() && (
            <div className="text-xs text-muted">
              First login will be <span className="font-mono">{emailFor(bulkText.split("\n").map((x)=>x.trim()).filter(Boolean)[0] || "")?.email}</span>
            </div>
          )}
          {bulkResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-line divide-y text-sm">
              {bulkResults.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className={r.ok ? "text-ok" : "text-danger"}>{r.ok ? "\u2713" : "\u2717"}</span>
                  <span className="flex-1">{r.name}</span>
                  <span className="font-mono text-xs text-muted">{r.email}</span>
                  {!r.ok && <span className="text-xs text-danger">{r.error}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>Close</Button>
            <Button onClick={bulkCreate} disabled={bulkBusy || !bulkText.trim() || bulkPass.length < 8}>
              {bulkBusy ? "Creating\u2026" : "Create all"}
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
