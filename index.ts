import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, useToast } from "../components/ui";
import {
  listAssignments, listStudentsForSubject, listResults, saveResults,
  listGradeBands, gradeFor, listExamEvents, examOpenForSubject,
  findEventAssessment, getOrCreateEventAssessment,
  type Assignment, type MarkStudent, type ResultStatus, type GradeBand, type ExamEvent,
} from "../lib/marks";

type Draft = { score: number | null; status: ResultStatus };

function deadlineLabel(d: string | null) {
  if (!d) return "no deadline";
  const dt = new Date(d);
  const past = dt < new Date();
  return `${past ? "closed" : "closes"} ${dt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

export default function MarksEntry() {
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.id as string;

  const [events, setEvents] = useState<ExamEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [bands, setBands] = useState<GradeBand[]>([]);
  const [loading, setLoading] = useState(true);

  const [ev, setEv] = useState<ExamEvent | null>(null);
  const [asg, setAsg] = useState<Assignment | null>(null);
  const [open, setOpen] = useState(true);

  const [students, setStudents] = useState<MarkStudent[]>([]);
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [maxScore, setMaxScore] = useState(100);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [e, a, b] = await Promise.all([
          listExamEvents(profile!.school_id), listAssignments(uid), listGradeBands(profile!.school_id),
        ]);
        setEvents(e); setAssignments(a); setBands(b);
      } catch (e: any) { toast(e.message ?? "Could not load your exams", "error"); }
      finally { setLoading(false); }
    })();
  }, [uid]);

  async function pickAssignment(a: Assignment) {
    setAsg(a); setBusy(true);
    try {
      const isOpen = await examOpenForSubject(ev!.id, a.classSubjectId, ev!.deadline);
      setOpen(isOpen);
      const [stu, found] = await Promise.all([
        listStudentsForSubject(a.classId, a.classSubjectId),
        findEventAssessment(a.classSubjectId, ev!.id),
      ]);
      setStudents(stu);
      if (found) {
        setAssessmentId(found.id); setMaxScore(found.maxScore);
        const res = await listResults(found.id);
        const d: Record<string, Draft> = {};
        stu.forEach((s) => { d[s.id] = res[s.id] ?? { score: null, status: "graded" }; });
        setDraft(d);
      } else {
        setAssessmentId(null); setMaxScore(100);
        const d: Record<string, Draft> = {};
        stu.forEach((s) => { d[s.id] = { score: null, status: "graded" }; });
        setDraft(d);
      }
      setDirty(false);
    } catch (e: any) { toast(e.message ?? "Could not load the marks", "error"); }
    finally { setBusy(false); }
  }

  function setScore(id: string, raw: string) {
    const n: number | null = raw === "" ? null : Math.min(maxScore, Math.max(0, parseInt(raw.replace(/[^0-9]/g, "") || "0", 10)));
    setDraft((d) => ({ ...d, [id]: { score: n, status: "graded" } }));
    setDirty(true);
  }
  function toggleAbsent(id: string) {
    setDraft((d) => {
      const cur = d[id];
      const next: Draft = cur.status === "absent" ? { score: null, status: "graded" } : { score: null, status: "absent" };
      return { ...d, [id]: next };
    });
    setDirty(true);
  }

  async function save() {
    if (!asg || !ev) return;
    setBusy(true);
    try {
      let aId = assessmentId;
      if (!aId) {
        const created = await getOrCreateEventAssessment(asg.classSubjectId, ev, uid);
        aId = created.id; setAssessmentId(aId);
      }
      await saveResults(aId, uid, students.map((s) => ({
        studentId: s.id, score: draft[s.id].score, status: draft[s.id].status,
      })));
      setDirty(false);
      toast("Marks saved");
    } catch (e: any) {
      const m = e.message ?? "";
      toast(m.includes("closed") ? "This exam is closed — the deadline passed. Ask an admin to reopen it." : (m || "Could not save"), "error");
    } finally { setBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading your exams…</p></Card>;

  if (!ev) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Choose an exam to enter marks for.</p>
        {events.length === 0
          ? <Card><p className="p-4 text-muted text-sm">No exams yet. An admin creates these under Events.</p></Card>
          : events.map((e) => (
            <button key={e.id} onClick={() => { setEv(e); setAsg(null); }}
              className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
              <span className="flex-1 min-w-0"><span className="block font-semibold">{e.name}</span>
                <span className="block text-xs text-muted">{deadlineLabel(e.deadline)}</span></span>
              <span className="text-slate-300 text-xl">›</span>
            </button>
          ))}
      </div>
    );
  }

  if (!asg) {
    return (
      <div className="space-y-3">
        <button onClick={() => setEv(null)} className="text-sm text-brand">‹ Back to exams</button>
        <p className="text-sm text-muted">{ev.name}. Which of your classes?</p>
        {assignments.length === 0
          ? <Card><p className="p-4 text-muted text-sm">You have no classes assigned yet.</p></Card>
          : assignments.map((a) => (
            <button key={a.classSubjectId} onClick={() => pickAssignment(a)}
              className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
              <span className="w-10 h-10 rounded-lg bg-brand text-white grid place-items-center font-semibold text-sm shrink-0">
                {a.className.replace(/[^0-9A-Za-z]/g, "").slice(-2) || "·"}
              </span>
              <span className="flex-1 min-w-0"><span className="block font-semibold">{a.className} — {a.subjectName}</span></span>
              <span className="text-slate-300 text-xl">›</span>
            </button>
          ))}
      </div>
    );
  }

  const entered = students.filter((s) => draft[s.id]?.status === "graded" && draft[s.id]?.score !== null).length;
  const absent = students.filter((s) => draft[s.id]?.status === "absent").length;
  const left = students.length - entered - absent;

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setAsg(null)} className="text-sm text-brand">‹ Back</button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Out of</span>
          <input type="number" value={maxScore} min={1} max={1000}
            onChange={(e) => setMaxScore(Math.max(1, parseInt(e.target.value || "100", 10)))}
            className="w-16 h-9 text-center border rounded-lg" disabled={!!assessmentId || !open} />
        </div>
      </div>
      <p className="text-sm text-muted">{asg.className} — {asg.subjectName} · {ev.name}</p>

      {!open && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm p-3">
          This exam is closed — the deadline passed and this subject hasn't been reopened. Marks are read-only.
        </div>
      )}

      <Card>
        {busy && students.length === 0 ? <p className="p-4 text-muted text-sm">Loading…</p> :
         students.length === 0 ? <p className="p-4 text-muted text-sm">No students take this subject in this class.</p> :
         <div className="divide-y">
          {students.map((s) => {
            const d = draft[s.id] ?? { score: null, status: "graded" as ResultStatus };
            const isAbsent = d.status === "absent";
            const pct = d.score !== null ? (d.score / maxScore) * 100 : null;
            const g = pct !== null ? gradeFor(pct, bands) : null;
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-muted">Roll {s.admissionNo ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <input inputMode="numeric" value={isAbsent ? "" : (d.score ?? "")}
                    onChange={(e) => setScore(s.id, e.target.value)} disabled={isAbsent || !open} placeholder="–"
                    className="w-[74px] h-11 text-center text-lg border rounded-lg disabled:bg-paper disabled:text-slate-300" />
                  <button onClick={() => toggleAbsent(s.id)} disabled={!open}
                    className={`h-11 w-[92px] rounded-lg border text-sm disabled:opacity-50 ${isAbsent ? "bg-slate-500 text-white border-slate-500" : "text-muted"}`}>
                    {isAbsent ? "Absent" : "Absent?"}
                  </button>
                  <span className="w-[34px] text-center">
                    {isAbsent ? <span className="inline-block px-2 h-7 leading-7 rounded-lg bg-slate-500 text-white text-xs font-bold">Ab</span>
                      : g ? <span className="inline-block px-2 h-7 leading-7 rounded-lg bg-brand text-white text-xs font-bold">{g}</span> : null}
                  </span>
                </div>
              </div>
            );
          })}
         </div>}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex items-center gap-3">
        <span className="flex-1 text-sm text-muted">
          {entered} of {students.length} entered{absent ? ` · ${absent} absent` : ""}{left ? ` · ${left} left` : ""}
        </span>
        <Button onClick={save} disabled={busy || !dirty || !open}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
