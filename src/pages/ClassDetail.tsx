import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button, Card, Empty, Field, Input, Modal, Select, useToast } from "../components/ui";
import {
  getClassInfo, listTeachers, listSubjects, listClassSubjects, addClassSubject,
  setClassSubjectTeacher, removeClassSubject, setHomeroom, listEnrolled,
  listEnrollableStudents, enrolStudent, unenrolStudent,
  listEnrollmentSubjects, setEnrollmentSubjects,
  type ClassInfo, type CsRow, type EnrolledStudent, type Pick,
} from "../lib/classadmin";
import { supabase } from "../lib/supabase";

export default function ClassDetail() {
  const { id = "" } = useParams();
  const toast = useToast();

  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [subjects, setSubjects] = useState<Pick[]>([]);
  const [teachers, setTeachers] = useState<Pick[]>([]);
  const [cs, setCs] = useState<CsRow[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newSub, setNewSub] = useState({ subjectId: "", teacherId: "" });
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrollable, setEnrollable] = useState<Pick[]>([]);
  const [pickStudent, setPickStudent] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // per-student subject editor
  const [subjFor, setSubjFor] = useState<EnrolledStudent | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [subjBusy, setSubjBusy] = useState(false);

  async function reload() {
    const [i, c, e] = await Promise.all([getClassInfo(id), listClassSubjects(id), listEnrolled(id)]);
    setInfo(i); setCs(c); setEnrolled(e);
    return i;
  }
  useEffect(() => {
    (async () => {
      try {
        const i = await reload();
        const [subs, ts] = await Promise.all([listSubjects(i.schoolId), listTeachers(i.schoolId)]);
        setSubjects(subs); setTeachers(ts);
      } catch (e: any) { toast(e.message ?? "Could not load class", "error"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const teacherName = (tid: string) => teachers.find((t) => t.id === tid)?.name ?? "—";

  async function saveName() {
    if (!nameDraft.trim() || !info) { setRenaming(false); return; }
    try {
      const { error } = await supabase.from("classes").update({ name: nameDraft.trim() }).eq("id", id);
      if (error) throw error;
      setInfo({ ...info, name: nameDraft.trim() }); setRenaming(false); toast("Class renamed");
    } catch (e: any) { toast(e.message ?? "Could not rename", "error"); }
  }

  async function doAddSubject() {
    if (!newSub.subjectId) return;
    setBusy(true);
    try {
      await addClassSubject(id, newSub.subjectId, newSub.teacherId);
      toast("Subject added"); setAddSubOpen(false); setNewSub({ subjectId: "", teacherId: "" });
      setCs(await listClassSubjects(id));
    } catch (e: any) { toast(e.message?.includes("duplicate") ? "That subject is already on this class." : (e.message ?? "Failed"), "error"); }
    finally { setBusy(false); }
  }
  async function changeTeacher(row: CsRow, teacherId: string) {
    try { await setClassSubjectTeacher(row.id, teacherId); setCs((p) => p.map((r) => r.id === row.id ? { ...r, teacherId: teacherId || null, teacherName: teacherId ? teacherName(teacherId) : "Unassigned" } : r)); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function dropSubject(row: CsRow) {
    if (!confirm(`Remove ${row.subjectName} from this class?`)) return;
    try { await removeClassSubject(row.id); setCs((p) => p.filter((r) => r.id !== row.id)); toast("Subject removed"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function changeHomeroom(teacherId: string) {
    try { await setHomeroom(id, teacherId); setInfo((i) => i ? { ...i, homeroomId: teacherId || null } : i); toast("Homeroom teacher updated"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function openEnrol() {
    setEnrolOpen(true); setPickStudent("");
    try { setEnrollable(await listEnrollableStudents(info!.schoolId, id)); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function doEnrol() {
    if (!pickStudent) return;
    setBusy(true);
    try { await enrolStudent(pickStudent, id); toast("Student enrolled"); setEnrolOpen(false); setEnrolled(await listEnrolled(id)); }
    catch (e: any) { toast(e.message?.includes("active") || e.message?.includes("unique") ? "That student is already enrolled in a class this year." : (e.message ?? "Failed"), "error"); }
    finally { setBusy(false); }
  }
  async function removeStudent(s: EnrolledStudent) {
    if (!confirm(`Remove ${s.name} from ${info?.name}?`)) return;
    try { await unenrolStudent(s.enrollmentId); setEnrolled((p) => p.filter((x) => x.enrollmentId !== s.enrollmentId)); toast("Student removed"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }

  async function openSubjects(s: EnrolledStudent) {
    setSubjFor(s); setSubjBusy(true); setSel(new Set());
    try {
      const taken = await listEnrollmentSubjects(s.enrollmentId);
      // no explicit selection yet → default to all offered (matches the "takes all" fallback)
      setSel(new Set(taken.length ? taken : cs.map((r) => r.id)));
    } catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setSubjBusy(false); }
  }
  function toggleSubj(csId: string) {
    setSel((prev) => { const n = new Set(prev); n.has(csId) ? n.delete(csId) : n.add(csId); return n; });
  }
  async function saveSubjects() {
    if (!subjFor) return;
    setSubjBusy(true);
    try { await setEnrollmentSubjects(subjFor.enrollmentId, [...sel]); toast(`Subjects updated for ${subjFor.name}`); setSubjFor(null); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setSubjBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  if (!info) return <Card><p className="p-4 text-muted text-sm">Class not found.</p></Card>;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/classes" className="text-sm text-brand">‹ All classes</Link>
        {renaming ? (
          <div className="flex items-center gap-2 mt-1">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="max-w-[200px]" />
            <Button onClick={saveName}>Save</Button>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-semibold">{info.name}</h1>
            <button className="text-sm text-brand hover:underline" onClick={() => { setNameDraft(info.name); setRenaming(true); }}>Rename</button>
          </div>
        )}
        <p className="text-sm text-muted">{info.gradeName} · {info.yearName}</p>
      </div>

      <Card>
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted">Class (homeroom) teacher</span>
          <Select value={info.homeroomId ?? ""} onChange={(e) => changeHomeroom(e.target.value)} className="min-w-[180px]">
            <option value="">— none —</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <span className="text-xs text-muted">Owns attendance &amp; remarks for this class.</span>
        </div>
      </Card>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Subjects &amp; teachers</h2>
          <Button onClick={() => setAddSubOpen(true)}>Add subject</Button>
        </div>
        <Card>
          {cs.length === 0 ? <Empty title="No subjects yet" hint="Add the subjects this class is taught." />
            : <div className="divide-y">
              {cs.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
                  <span className="font-medium flex-1 min-w-[120px]">{r.subjectName}</span>
                  <Select value={r.teacherId ?? ""} onChange={(e) => changeTeacher(r, e.target.value)} className="min-w-[160px]">
                    <option value="">Unassigned</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <button onClick={() => dropSubject(r)} className="text-sm text-danger">Remove</button>
                </div>
              ))}
            </div>}
        </Card>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Students <span className="text-muted font-normal text-sm">· {enrolled.length}</span></h2>
          <Button onClick={openEnrol}>Enrol student</Button>
        </div>
        <Card>
          {enrolled.length === 0 ? <Empty title="No students enrolled" hint="Enrol students into this class." />
            : <div className="divide-y">
              {enrolled.map((s) => (
                <div key={s.enrollmentId} className="p-3 flex items-center gap-3">
                  <span className="text-xs text-muted font-mono w-14">{s.roll ?? "—"}</span>
                  <span className="flex-1">{s.name}</span>
                  <button onClick={() => openSubjects(s)} className="text-sm text-brand">Subjects</button>
                  <button onClick={() => removeStudent(s)} className="text-sm text-danger">Remove</button>
                </div>
              ))}
            </div>}
        </Card>
      </div>

      <Modal open={addSubOpen} onClose={() => setAddSubOpen(false)} title="Add subject to class">
        <div className="space-y-3">
          <Field label="Subject">
            <Select value={newSub.subjectId} onChange={(e) => setNewSub({ ...newSub, subjectId: e.target.value })}>
              <option value="">Choose a subject…</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Teacher (optional)">
            <Select value={newSub.teacherId} onChange={(e) => setNewSub({ ...newSub, teacherId: e.target.value })}>
              <option value="">Unassigned for now</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddSubOpen(false)}>Cancel</Button>
            <Button onClick={doAddSubject} disabled={busy || !newSub.subjectId}>{busy ? "Adding…" : "Add"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={enrolOpen} onClose={() => setEnrolOpen(false)} title={`Enrol a student in ${info.name}`}>
        <div className="space-y-3">
          <Field label="Student">
            <Select value={pickStudent} onChange={(e) => setPickStudent(e.target.value)}>
              <option value="">Choose a student…</option>
              {enrollable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          {enrollable.length === 0 && <p className="text-xs text-muted">No unenrolled active students. Add students on the Students screen first.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEnrolOpen(false)}>Cancel</Button>
            <Button onClick={doEnrol} disabled={busy || !pickStudent}>{busy ? "Enrolling…" : "Enrol"}</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!subjFor} onClose={() => setSubjFor(null)} title={`Subjects — ${subjFor?.name ?? ""}`}>
        <div className="space-y-3">
          <p className="text-xs text-muted">Tick the subjects this student takes and uncheck the ones they don't — for example a language they don't take, or an option block they didn't choose.</p>
          {subjBusy && sel.size === 0 ? <p className="text-sm text-muted">Loading…</p> :
           cs.length === 0 ? <p className="text-sm text-muted">Add subjects to the class first.</p> :
           <div className="max-h-72 overflow-y-auto divide-y border rounded-lg">
            {cs.map((r) => (
              <label key={r.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-paper">
                <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSubj(r.id)} className="w-4 h-4" />
                <span className="flex-1">{r.subjectName}</span>
                <span className="text-xs text-muted">{r.teacherName}</span>
              </label>
            ))}
           </div>}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted">{sel.size} of {cs.length} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSubjFor(null)}>Cancel</Button>
              <Button onClick={saveSubjects} disabled={subjBusy}>{subjBusy ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
