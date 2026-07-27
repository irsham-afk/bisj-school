import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { Student } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, Table, useToast } from "../components/ui";

const blank = { admission_no: "", first_name: "", last_name: "", date_of_birth: "", gender: "", status: "active" };

export default function Students() {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useFetch<Student[]>(async () => {
    const { data, error } = await supabase
      .from("students").select("*, enrollments(status, classes(name))").is("archived_at", null)
      .order("last_name", { ascending: true });
    if (error) throw error;
    return data as Student[];
  });

  function startAdd() { setEditing(null); setForm(blank); setOpen(true); }
  function startEdit(s: Student) {
    setEditing(s);
    setForm({
      admission_no: s.admission_no ?? "", first_name: s.first_name, last_name: s.last_name,
      date_of_birth: s.date_of_birth ?? "", gender: s.gender ?? "", status: s.status,
    });
    setOpen(true);
  }

  async function save() {
    if (!profile) return;
    setBusy(true);
    const payload = {
      admission_no: form.admission_no || null,
      first_name: form.first_name, last_name: form.last_name,
      date_of_birth: form.date_of_birth || null, gender: form.gender || null,
      status: form.status,
    };
    const res = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert({ ...payload, school_id: profile.school_id });
    setBusy(false);
    if (res.error) { toast(res.error.message, "error"); return; }
    toast(editing ? "Student updated" : "Student added");
    setOpen(false); refetch();
  }

  async function archive(s: Student) {
    if (!confirm(`Archive ${s.first_name} ${s.last_name}? Their records are kept.`)) return;
    const { error } = await supabase.from("students")
      .update({ archived_at: new Date().toISOString(), archived_reason: "Archived from console" })
      .eq("id", s.id);
    if (error) { toast(error.message, "error"); return; }
    toast("Student archived"); refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{data ? `${data.length} active` : ""}</p>
        <Button onClick={startAdd}>Add student</Button>
      </div>

      <Card>
        {loading ? (
          <Empty title="Loading…" hint="Fetching the register." />
        ) : !data || data.length === 0 ? (
          <Empty title="No students yet" hint="Add your first student to start the register." />
        ) : (
          <Table head={["Adm. no", "Name", "Class", "Status", ""]}>
            {data.map((s) => (
              <tr key={s.id} className="hover:bg-paper/60">
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{s.admission_no ?? "—"}</td>
                <td className="px-4 py-2.5">{s.last_name}, {s.first_name}</td>
                <td className="px-4 py-2.5">{(s as any).enrollments?.find((e: any) => e.status === "active")?.classes?.name ?? "—"}</td>
                <td className="px-4 py-2.5"><span className="text-xs uppercase tracking-wide text-muted">{s.status}</span></td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button className="text-sm text-brand hover:underline mr-3" onClick={() => startEdit(s)}>Edit</button>
                  <button className="text-sm text-danger hover:underline" onClick={() => archive(s)}>Archive</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit student" : "Add student"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Admission no">
              <Input value={form.admission_no} onChange={(e) => setForm({ ...form, admission_no: e.target.value })} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["active", "withdrawn", "transferred", "graduated", "suspended"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.first_name || !form.last_name}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
