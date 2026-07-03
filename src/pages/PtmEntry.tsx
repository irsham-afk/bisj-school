import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Select, useToast } from "../components/ui";
import { listAssignments, listStudentsForSubject, type Assignment, type MarkStudent } from "../lib/marks";
import { listHomeroomClasses, listClassStudents, type HomeroomClass, type ClassStudent } from "../lib/attendance";
import {
  listPtmEvents, listPtmSubject, savePtmSubject, listPtmClass, savePtmClass,
  blankSubjectEntry, PTM_GROUPS, PTM_LABELS,
  type PtmEvent, type SubjectEntry, type ClassEntry, type Rating, type PtmField,
} from "../lib/ptm";

const RATINGS: Rating[] = ["A", "B", "C", "D"];

function RatingSelect({ value, onChange, disabled }: { value: Rating; onChange: (v: Rating) => void; disabled?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Rating)}
      className="w-full h-9 border border-line rounded-md text-center text-sm bg-white disabled:bg-paper">
      <option value="">–</option>
      {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

export default function PtmEntry() {
  const { profile } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState<PtmEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const ev = events.find((e) => e.id === eventId) || null;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [homerooms, setHomerooms] = useState<HomeroomClass[]>([]);
  const [mode, setMode] = useState<"subject" | "class">("subject");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // subject mode
  const [csId, setCsId] = useState("");
  const [subjStudents, setSubjStudents] = useState<MarkStudent[]>([]);
  const [subjEntries, setSubjEntries] = useState<Record<string, SubjectEntry>>({});

  // class mode
  const [classId, setClassId] = useState("");
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [classEntries, setClassEntries] = useState<Record<string, ClassEntry>>({});

  useEffect(() => {
    (async () => {
      try {
        const [evs, asg, hr] = await Promise.all([
          listPtmEvents(profile!.school_id),
          listAssignments(profile!.id),
          listHomeroomClasses(profile!.id, profile!.role),
        ]);
        setEvents(evs); setAssignments(asg); setHomerooms(hr);
        if (evs[0]) setEventId(evs[0].id);
        setMode(asg.length ? "subject" : "class");
      } catch (e: any) { toast(e.message ?? "Could not load", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function loadSubject(cs: string) {
    setCsId(cs);
    const a = assignments.find((x) => x.classSubjectId === cs);
    if (!a || !eventId) { setSubjStudents([]); return; }
    try {
      const [studs, existing] = await Promise.all([listStudentsForSubject(a.classId, cs), listPtmSubject(eventId, cs)]);
      setSubjStudents(studs);
      const e: Record<string, SubjectEntry> = {};
      studs.forEach((s) => { e[s.id] = existing[s.id] ?? blankSubjectEntry(); });
      setSubjEntries(e);
    } catch (er: any) { toast(er.message ?? "Failed", "error"); }
  }
  async function loadClass(cid: string) {
    setClassId(cid);
    if (!cid || !eventId) { setClassStudents([]); return; }
    try {
      const [studs, existing] = await Promise.all([listClassStudents(cid), listPtmClass(eventId, cid)]);
      setClassStudents(studs);
      const e: Record<string, ClassEntry> = {};
      studs.forEach((s) => { e[s.id] = existing[s.id] ?? { tardy: null, absent: null, overall_remark: "" }; });
      setClassEntries(e);
    } catch (er: any) { toast(er.message ?? "Failed", "error"); }
  }
  // reset selections when the event changes
  useEffect(() => { setCsId(""); setSubjStudents([]); setClassId(""); setClassStudents([]); }, [eventId]);

  function setRating(sid: string, f: PtmField, v: Rating) {
    setSubjEntries((p) => ({ ...p, [sid]: { ...p[sid], [f]: v } }));
  }
  function setRemark(sid: string, v: string) {
    setSubjEntries((p) => ({ ...p, [sid]: { ...p[sid], remark: v } }));
  }

  async function saveSubject() {
    setSaving(true);
    try {
      await savePtmSubject(eventId, csId, profile!.id, subjStudents.map((s) => ({ studentId: s.id, entry: subjEntries[s.id] })));
      toast("PTM ratings saved");
    } catch (e: any) { toast(lockMsg(e.message), "error"); }
    finally { setSaving(false); }
  }
  async function saveClass() {
    setSaving(true);
    try {
      await savePtmClass(eventId, classId, profile!.id, classStudents.map((s) => ({ studentId: s.id, entry: classEntries[s.id] })));
      toast("Saved");
    } catch (e: any) { toast(lockMsg(e.message), "error"); }
    finally { setSaving(false); }
  }
  const lockMsg = (m?: string) => (m && m.toLowerCase().includes("closed")) ? "This PTM is closed (deadline passed). Ask an admin to reopen it." : (m ?? "Failed");

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  if (events.length === 0) return <Card><Empty title="No PTM events" hint="An admin needs to create a PTM event first." /></Card>;

  const showModeTabs = assignments.length > 0 && homerooms.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Field label="PTM event">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)} className="min-w-[200px]">
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}{e.open ? "" : " (closed)"}</option>)}
          </Select>
        </Field>
        {ev && !ev.open && <span className="text-xs text-danger pb-2">Deadline passed — entry is locked unless an admin reopened your part.</span>}
      </div>

      {showModeTabs && (
        <div className="flex gap-2">
          <Button variant={mode === "subject" ? "primary" : "ghost"} onClick={() => setMode("subject")}>My subjects</Button>
          <Button variant={mode === "class" ? "primary" : "ghost"} onClick={() => setMode("class")}>My class (homeroom)</Button>
        </div>
      )}

      {mode === "subject" ? (
        assignments.length === 0 ? <Card><Empty title="No subjects assigned to you" hint="" /></Card> : (
          <>
            <Field label="Subject">
              <Select value={csId} onChange={(e) => loadSubject(e.target.value)} className="min-w-[220px]">
                <option value="">Choose one of your subjects…</option>
                {assignments.map((a) => <option key={a.classSubjectId} value={a.classSubjectId}>{a.className} — {a.subjectName}</option>)}
              </Select>
            </Field>

            {csId && (subjStudents.length === 0 ? <Card><Empty title="No students take this subject" hint="" /></Card> : (
              <>
                <div className="space-y-3">
                  {subjStudents.map((s) => (
                    <Card key={s.id}>
                      <div className="p-3 space-y-3">
                        <div className="font-semibold">{s.name} <span className="text-xs text-muted font-normal">· {s.admissionNo ?? "—"}</span></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {PTM_GROUPS.map((g) => (
                            <div key={g.label}>
                              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">{g.label}</div>
                              <div className="space-y-1.5">
                                {g.fields.map((f) => (
                                  <div key={f} className="flex items-center gap-2">
                                    <span className="text-xs text-ink flex-1">{PTM_LABELS[f]}</span>
                                    <div className="w-16"><RatingSelect value={subjEntries[s.id]?.[f] ?? ""} onChange={(v) => setRating(s.id, f, v)} /></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <textarea
                          value={subjEntries[s.id]?.remark ?? ""} onChange={(e) => setRemark(s.id, e.target.value)}
                          placeholder="Remark for this student (shown on the PTM sheet)…"
                          className="w-full border border-line rounded-md p-2 text-sm min-h-[58px]" />
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="sticky bottom-0 bg-white border-t border-line p-3 flex justify-end rounded-b-lg">
                  <Button onClick={saveSubject} disabled={saving}>{saving ? "Saving…" : "Save ratings"}</Button>
                </div>
              </>
            ))}
          </>
        )
      ) : (
        homerooms.length === 0 ? <Card><Empty title="You're not a class teacher" hint="" /></Card> : (
          <>
            <Field label="Class">
              <Select value={classId} onChange={(e) => loadClass(e.target.value)} className="min-w-[200px]">
                <option value="">Choose your class…</option>
                {homerooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {classId && (classStudents.length === 0 ? <Card><Empty title="No students in this class" hint="" /></Card> : (
              <>
                <Card>
                  <div className="divide-y">
                    {classStudents.map((s) => {
                      const e = classEntries[s.id] ?? { tardy: null, absent: null, overall_remark: "" };
                      const upd = (patch: Partial<ClassEntry>) => setClassEntries((p) => ({ ...p, [s.id]: { ...e, ...patch } }));
                      return (
                        <div key={s.id} className="p-3 space-y-2">
                          <div className="font-semibold">{s.name} <span className="text-xs text-muted font-normal">· {s.admissionNo ?? "—"}</span></div>
                          <div className="flex gap-2">
                            <label className="flex-1"><span className="text-[11px] uppercase text-muted">Tardy</span>
                              <input type="number" min={0} value={e.tardy ?? ""} onChange={(ev) => upd({ tardy: ev.target.value === "" ? null : +ev.target.value })}
                                className="w-full h-9 border border-line rounded-md text-center" /></label>
                            <label className="flex-1"><span className="text-[11px] uppercase text-muted">Absent</span>
                              <input type="number" min={0} value={e.absent ?? ""} onChange={(ev) => upd({ absent: ev.target.value === "" ? null : +ev.target.value })}
                                className="w-full h-9 border border-line rounded-md text-center" /></label>
                          </div>
                          <textarea value={e.overall_remark} onChange={(ev) => upd({ overall_remark: ev.target.value })}
                            placeholder="Class teacher's overall remark…" className="w-full border border-line rounded-md p-2 text-sm min-h-[58px]" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
                <div className="sticky bottom-0 bg-white border-t border-line p-3 flex justify-end rounded-b-lg">
                  <Button onClick={saveClass} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </div>
              </>
            ))}
          </>
        )
      )}
    </div>
  );
}
