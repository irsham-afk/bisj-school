import { useState } from "react";
import { deleteSubject } from "../lib/classadmin";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { Subject } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Table, useToast } from "../components/ui";

export default function Subjects() {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", is_elective: false });
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useFetch<Subject[]>(async () => {
    const { data, error } = await supabase.from("subjects").select("*").order("name");
    if (error) throw error;
    return data as Subject[];
  });

  async function removeSubject(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes the subject from every class and deletes any marks recorded for it. This cannot be undone.`)) return;
    try { await deleteSubject(id); toast("Subject deleted"); refetch(); }
    catch (e: any) { toast(e.message ?? "Could not delete", "error"); }
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("subjects").insert({
      school_id: profile.school_id, name: form.name, code: form.code || null, is_elective: form.is_elective,
    });
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Subject added"); setOpen(false); setForm({ name: "", code: "", is_elective: false }); refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Add subject</Button>
      </div>
      <Card>
        {loading ? <Empty title="Loading…" hint="" />
          : !data || data.length === 0 ? <Empty title="No subjects yet" hint="Add the subjects your school teaches." />
          : (
            <Table head={["Code", "Subject", "Type", ""]}>
              {data.map((s) => (
                <tr key={s.id} className="hover:bg-paper/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{s.code ?? "—"}</td>
                  <td className="px-4 py-2.5"><Link to={`/subjects/${s.id}`} className="text-brand hover:underline">{s.name}</Link></td>
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted">{s.is_elective ? "Elective" : "Core"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap"><Link to={`/subjects/${s.id}`} className="text-sm text-brand hover:underline mr-3">Details ›</Link><button onClick={() => removeSubject(s.id, s.name)} className="text-sm text-danger hover:underline">Delete</button></td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add subject">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" /></Field>
          <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.is_elective} onChange={(e) => setForm({ ...form, is_elective: e.target.checked })} />
            Elective subject
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
