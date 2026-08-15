import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { Student } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, Table, useToast } from "../components/ui";
import { listClassesForSchool, listClassSubjects, listEnrollmentSubjects, setEnrollmentSubjects, enrolStudent, unenrolStudent, type Pick, type CsRow } from "../lib/classadmin";

const blank = { admission_no: "", first_name: "", last_name: "", date_of_birth: "", gender: "", status: "active" };

export default function Students() {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [busy, setBusy] = useState(false);
  const [sortKey, setSortKey] = useState<"admission_no" | "name" | "class" | "status">("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [csOpen, setCsOpen] = useState(false);
  const [csStudent, setCsStudent] = useState<any>(null);
  const [csEnrollmentId, setCsEnrollmentId] = useState<string | null>(null);
  const [csClasses, setCsClasses] = useState<Pick[]>([]);
  const [csClassId, setCsClassId] = useState("");
  const [csOrigClassId, setCsOrigClassId] = useState("");
  const [csSubs, setCsSubs] = useState<CsRow[]>([]);
  const [csSel, setCsSel] = useState<Set<string>>(new Set());
  const [csBusy, setCsBusy] = useState(false);

  async function openClassSubs(s: any) {
    const enr = s.enrollments?.find((e: any) => e.status === "active");
    setCsStudent(s); setCsEnrollmentId(enr?.id ?? null);
    setCsClassId(enr?.class_id ?? ""); setCsOrigClassId(enr?.class_id ?? "");
    setCsClasses(await listClassesForSchool(profile!.school_id));
    if (enr?.class_id) {
      const subs = await listClassSubjects(enr.class_id); setCsSubs(subs);
      setCsSel(new Set(enr?.id ? await listEnrollmentSubjects(enr.id) : []));
    } else { setCsSubs([]); setCsSel(new Set()); }
    setCsOpen(true);
  }
  async function onCsClass(cid: string) {
    setCsClassId(cid);
    const subs = cid ? await listClassSubjects(cid) : [];
    setCsSubs(subs);
    // default: take all subjects the (new) class offers
    setCsSel(new Set(subs.map((x) => x.id)));
  }
  async function saveClassSubs() {
    setCsBusy(true);
    try {
      let enrollmentId = csEnrollmentId;
      if (csClassId && csClassId !== csOrigClassId) {
        if (csEnrollmentId) await unenrolStudent(csEnrollmentId);
        const ne = await enrolStudent(csStudent.id, csClassId);
        enrollmentId = (ne as any)?.id ?? null;
      }
      if (enrollmentId) await setEnrollmentSubjects(enrollmentId, [...csSel]);
      setCsOpen(false); toast("Saved"); refetch();
    } catch (e: any) { toast(e.message ?? "Could not save", "error"); }
    finally { setCsBusy(false); }
  }

  const { data, loading, refetch } = useFetch<Student[]>(async () => {
    const { data, error } = await supabase
      .from("students").select("*, enrollments(id, status, class_id, classes(name))").is("archived_at", null)
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

  const clsName = (x: any) => x.enrollments?.find((e: any) => e.status === "active")?.classes?.name ?? "";
  function toggleSort(k: typeof sortKey) {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(1); }
  }
  const arrow = (k: typeof sortKey) => (sortKey === k ? (sortDir === 1 ? " \u2191" : " \u2193") : "");
  const rows = [...(data ?? [])].sort((a: any, b: any) => {
    let av: any, bv: any;
    if (sortKey === "admission_no") { av = Number(a.admission_no) || 0; bv = Number(b.admission_no) || 0; }
    else if (sortKey === "class") { av = clsName(a); bv = clsName(b); }
    else if (sortKey === "status") { av = a.status ?? ""; bv = b.status ?? ""; }
    else { av = `${a.last_name} ${a.first_name}`.toLowerCase(); bv = `${b.last_name} ${b.first_name}`.toLowerCase(); }
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
  });

  const HeadBtn = ({ k, label }: { k: typeof sortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="uppercase tracking-wide hover:text-brand">{label}{arrow(k)}</button>
  );

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
          <Table head={[<HeadBtn k="admission_no" label="Adm. no" />, <HeadBtn k="name" label="Name" />, <HeadBtn k="class" label="Class" />, <HeadBtn k="status" label="Status" />, ""]}>
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-paper/60">
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{s.admission_no ?? "—"}</td>
                <td className="px-4 py-2.5">{s.last_name}, {s.first_name}</td>
                <td className="px-4 py-2.5">{(s as any).enrollments?.find((e: any) => e.status === "active")?.classes?.name ?? "—"}</td>
                <td className="px-4 py-2.5"><span className="text-xs uppercase tracking-wide text-muted">{s.status}</span></td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button className="text-sm text-brand hover:underline mr-3" onClick={() => openClassSubs(s)}>Class &amp; subjects</button>
                  <button className="text-sm text-brand hover:underline mr-3" onClick={() => startEdit(s)}>Edit</button>
                  <button className="text-sm text-danger hover:underline" onClick={() => archive(s)}>Archive</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={csOpen} onClose={() => setCsOpen(false)} title={`Class & subjects — ${csStudent?.first_name ?? ""}`}>
        <div className="space-y-3">
          <Field label="Class">
            <Select value={csClassId} onChange={(e) => onCsClass(e.target.value)}>
              <option value="">— none —</option>
              {csClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {csClassId !== csOrigClassId && csClassId && <p className="text-xs text-danger">Moving class will re-enrol the student and reset subjects to this class's list.</p>}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Subjects taken</div>
            <div className="max-h-56 overflow-y-auto border border-line rounded-lg divide-y">
              {csSubs.length === 0 ? <p className="p-2 text-sm text-muted">No subjects on this class.</p> :
                csSubs.map((x) => (
                  <label key={x.id} className="p-2 flex items-center gap-2 text-sm cursor-pointer hover:bg-paper">
                    <input type="checkbox" checked={csSel.has(x.id)} onChange={() => setCsSel((p) => { const n = new Set(p); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n; })} />
                    <span className="flex-1">{x.subjectName}</span>
                    <span className="text-xs text-muted">{x.teacherName}</span>
                  </label>
                ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCsOpen(false)}>Cancel</Button>
            <Button onClick={saveClassSubs} disabled={csBusy}>{csBusy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

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
