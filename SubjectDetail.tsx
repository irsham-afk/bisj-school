import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Modal, Select, useToast } from "../components/ui";
import {
  getSubjectInfo, listSubjectClasses, listClassesWithoutSubject, listTeachers,
  setClassSubjectTeacher, removeClassSubject, addClassSubject,
  type SubjectClass, type Pick,
} from "../lib/classadmin";

export default function SubjectDetail() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const toast = useToast();

  const [info, setInfo] = useState<{ name: string; isElective: boolean; schoolId: string } | null>(null);
  const [rows, setRows] = useState<SubjectClass[]>([]);
  const [teachers, setTeachers] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [freeClasses, setFreeClasses] = useState<Pick[]>([]);
  const [pickClass, setPickClass] = useState("");
  const [pickTeacher, setPickTeacher] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const nfo = await getSubjectInfo(id);
      const [r, t] = await Promise.all([listSubjectClasses(id), listTeachers(nfo.schoolId)]);
      setInfo(nfo); setRows(r); setTeachers(t);
    } catch (e: any) { toast(e.message ?? "Could not load", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function changeTeacher(r: SubjectClass, teacherId: string) {
    try { await setClassSubjectTeacher(r.csId, teacherId); setRows((rs) => rs.map((x) => x.csId === r.csId ? { ...x, teacherId: teacherId || null, teacherName: teachers.find((t) => t.id === teacherId)?.name ?? "Unassigned" } : x)); toast("Teacher updated"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function remove(r: SubjectClass) {
    if (!confirm(`Remove ${info?.name} from ${r.className}?`)) return;
    try { await removeClassSubject(r.csId); toast("Removed"); await load(); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }
  async function openAdd() {
    setPickClass(""); setPickTeacher("");
    setFreeClasses(await listClassesWithoutSubject(profile!.school_id, id));
    setOpen(true);
  }
  async function doAdd() {
    if (!pickClass) return;
    setBusy(true);
    try { await addClassSubject(pickClass, id, pickTeacher); setOpen(false); toast("Added to class"); await load(); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/subjects" className="text-sm text-brand">‹ Subjects</Link>
          <h2 className="font-display text-2xl mt-1">{info?.name}</h2>
          <div className="font-mono text-[11px] uppercase text-muted">{info?.isElective ? "Elective" : "Core"}</div>
        </div>
        <Button onClick={openAdd}>Add to a class</Button>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Taught in ({rows.length})</h3>
        <Card>
          {rows.length === 0
            ? <Empty title="Not taught in any class yet" hint="Use “Add to a class” to offer this subject." />
            : <div className="divide-y">
              {rows.map((r) => (
                <div key={r.csId} className="p-3 flex items-center gap-3 flex-wrap">
                  <Link to={`/classes/${r.classId}`} className="w-16 font-medium text-brand">{r.className}</Link>
                  <Select value={r.teacherId ?? ""} onChange={(e) => changeTeacher(r, e.target.value)} className="min-w-[170px]">
                    <option value="">Unassigned</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                  <button onClick={() => remove(r)} className="text-sm text-danger ml-auto">Remove</button>
                </div>
              ))}
            </div>}
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Add ${info?.name} to a class`}>
        <div className="space-y-3">
          <Field label="Class">
            <Select value={pickClass} onChange={(e) => setPickClass(e.target.value)}>
              <option value="">Choose a class…</option>
              {freeClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Teacher (optional)">
            <Select value={pickTeacher} onChange={(e) => setPickTeacher(e.target.value)}>
              <option value="">Unassigned for now</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={doAdd} disabled={busy || !pickClass}>{busy ? "Adding…" : "Add"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
