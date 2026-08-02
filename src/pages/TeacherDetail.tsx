import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Modal, Select, useToast } from "../components/ui";
import {
  listTeacherAssignments, listHomeroomClasses, listClassesForSchool,
  listClassSubjects, setClassSubjectTeacher, getProfileName,
  type TeacherAssignment, type Pick, type CsRow,
} from "../lib/classadmin";

export default function TeacherDetail() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const toast = useToast();

  const [who, setWho] = useState<{ name: string; role: string } | null>(null);
  const [rows, setRows] = useState<TeacherAssignment[]>([]);
  const [homeroom, setHomeroom] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // assign modal
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<Pick[]>([]);
  const [pickClass, setPickClass] = useState("");
  const [classSubs, setClassSubs] = useState<CsRow[]>([]);
  const [pickCs, setPickCs] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [w, a, h] = await Promise.all([getProfileName(id), listTeacherAssignments(id), listHomeroomClasses(id)]);
      setWho(w); setRows(a); setHomeroom(h);
    } catch (e: any) { toast(e.message ?? "Could not load", "error"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function openAssign() {
    setPickClass(""); setPickCs(""); setClassSubs([]);
    setClasses(await listClassesForSchool(profile!.school_id));
    setOpen(true);
  }
  async function onPickClass(cid: string) {
    setPickClass(cid); setPickCs("");
    setClassSubs(cid ? await listClassSubjects(cid) : []);
  }
  async function doAssign() {
    if (!pickCs) return;
    setBusy(true);
    try { await setClassSubjectTeacher(pickCs, id); setOpen(false); toast("Assigned"); await load(); }
    catch (e: any) { toast(e.message ?? "Could not assign", "error"); }
    finally { setBusy(false); }
  }
  async function unassign(r: TeacherAssignment) {
    if (!confirm(`Remove ${who?.name} from ${r.className} — ${r.subjectName}?`)) return;
    try { await setClassSubjectTeacher(r.csId, ""); toast("Unassigned"); await load(); }
    catch (e: any) { toast(e.message ?? "Could not unassign", "error"); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/users" className="text-sm text-brand">‹ Teachers &amp; staff</Link>
          <h2 className="font-display text-2xl mt-1">{who?.name}</h2>
          <div className="font-mono text-[11px] uppercase text-muted">{who?.role}</div>
        </div>
        <Button onClick={openAssign}>Assign a subject</Button>
      </div>

      {homeroom.length > 0 && (
        <div className="text-sm text-muted">
          Homeroom of: {homeroom.map((h) => <span key={h.id} className="inline-block bg-paper rounded px-2 py-0.5 mr-1">{h.name}</span>)}
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-2">Teaches ({rows.length})</h3>
        <Card>
          {rows.length === 0
            ? <Empty title="No subjects assigned" hint="Use “Assign a subject” to give this teacher a class-subject." />
            : <div className="divide-y">
              {rows.map((r) => (
                <div key={r.csId} className="p-3 flex items-center gap-3">
                  <Link to={`/classes/${r.classId}`} className="w-16 font-medium text-brand">{r.className}</Link>
                  <span className="flex-1">{r.subjectName}</span>
                  <button onClick={() => unassign(r)} className="text-sm text-danger">Unassign</button>
                </div>
              ))}
            </div>}
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Assign a subject to ${who?.name}`}>
        <div className="space-y-3">
          <Field label="Class">
            <Select value={pickClass} onChange={(e) => onPickClass(e.target.value)}>
              <option value="">Choose a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {pickClass && (
            <Field label="Subject in that class">
              <Select value={pickCs} onChange={(e) => setPickCs(e.target.value)}>
                <option value="">Choose a subject…</option>
                {classSubs.map((s) => (
                  <option key={s.id} value={s.id}>{s.subjectName}{s.teacherName !== "Unassigned" ? ` (now: ${s.teacherName})` : ""}</option>
                ))}
              </Select>
            </Field>
          )}
          <p className="text-xs text-muted">Assigning moves this subject to this teacher — if someone else had it, they’re replaced.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={doAssign} disabled={busy || !pickCs}>{busy ? "Assigning…" : "Assign"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
