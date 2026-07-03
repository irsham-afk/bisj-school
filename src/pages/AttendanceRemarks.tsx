import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, useToast } from "../components/ui";
import {
  listHomeroomClasses, listTerms, listClassStudents, loadReportMeta, saveReportMeta,
  type HomeroomClass, type ClassStudent, type Meta,
} from "../lib/attendance";
import type { Term } from "../lib/marks";

type Row = { present: string; tardy: string; absent: string; remark: string };
const blank = (): Row => ({ present: "", tardy: "", absent: "", remark: "" });
const numOrNull = (s: string) => (s === "" ? null : parseInt(s.replace(/[^0-9]/g, "") || "0", 10));

export default function AttendanceRemarks() {
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.id as string;
  const role = (profile?.role as string) ?? "teacher";

  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<HomeroomClass | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [term, setTerm] = useState<Term | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [schoolDays, setSchoolDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cs = await listHomeroomClasses(uid, role);
        setClasses(cs);
        if (cs.length === 1) pickClass(cs[0]);
      } catch (e: any) { toast(e.message ?? "Could not load your class", "error"); }
      finally { setLoading(false); }
    })();
  }, [uid]);

  async function pickClass(c: HomeroomClass) {
    setCls(c); setTerm(null); setStudents([]); setRows({});
    try { setTerms(await listTerms(c.academicYearId)); }
    catch (e: any) { toast(e.message ?? "Could not load terms", "error"); }
  }

  async function pickTerm(t: Term) {
    setTerm(t); setBusy(true);
    try {
      const stu = await listClassStudents(cls!.id);
      setStudents(stu);
      const meta = await loadReportMeta(t.id, stu.map((s) => s.id));
      const r: Record<string, Row> = {};
      let sd = "";
      stu.forEach((s) => {
        const m: Meta | undefined = meta[s.id];
        r[s.id] = m
          ? { present: m.present?.toString() ?? "", tardy: m.tardy?.toString() ?? "", absent: m.absent?.toString() ?? "", remark: m.remark ?? "" }
          : blank();
        if (m?.schoolDays != null && sd === "") sd = m.schoolDays.toString();
      });
      setRows(r); setSchoolDays(sd); setDirty(false);
    } catch (e: any) { toast(e.message ?? "Could not load attendance", "error"); }
    finally { setBusy(false); }
  }

  function edit(id: string, field: keyof Row, val: string) {
    setRows((r) => ({ ...r, [id]: { ...r[id], [field]: val } }));
    setDirty(true);
  }

  async function save() {
    if (!term) return;
    setBusy(true);
    try {
      await saveReportMeta(term.id, numOrNull(schoolDays), profile?.full_name ?? "",
        students.map((s) => ({
          studentId: s.id,
          present: numOrNull(rows[s.id].present), tardy: numOrNull(rows[s.id].tardy),
          absent: numOrNull(rows[s.id].absent), remark: rows[s.id].remark,
        })));
      setDirty(false);
      toast("Attendance & remarks saved");
    } catch (e: any) { toast(e.message ?? "Could not save", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;

  if (classes.length === 0)
    return <Card><p className="p-4 text-muted text-sm">
      Only a class teacher enters attendance and remarks, and you're not set as the homeroom teacher of any class. An admin can set this on the Classes screen.
    </p></Card>;

  // class picker (admins / multi-class)
  if (!cls) return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Choose a class.</p>
      {classes.map((c) => (
        <button key={c.id} onClick={() => pickClass(c)}
          className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
          <span className="flex-1 font-semibold">{c.name}</span><span className="text-slate-300 text-xl">›</span>
        </button>
      ))}
    </div>
  );

  if (!term) return (
    <div className="space-y-3">
      {classes.length > 1 && <button onClick={() => setCls(null)} className="text-sm text-brand">‹ Back to classes</button>}
      <p className="text-sm text-muted">{cls.name} — which term?</p>
      {terms.map((t) => (
        <button key={t.id} onClick={() => pickTerm(t)}
          className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
          <span className="flex-1 font-semibold">{t.name}</span><span className="text-slate-300 text-xl">›</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setTerm(null)} className="text-sm text-brand">‹ Back</button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">School days</span>
          <input inputMode="numeric" value={schoolDays}
            onChange={(e) => { setSchoolDays(e.target.value.replace(/[^0-9]/g, "")); setDirty(true); }}
            className="w-16 h-9 text-center border rounded-lg" placeholder="91" />
        </div>
      </div>
      <p className="text-sm text-muted">{cls.name} · {term.name} — present, tardy, absent &amp; remark per student</p>

      <Card>
        {busy && students.length === 0 ? <p className="p-4 text-muted text-sm">Loading…</p> :
         students.length === 0 ? <p className="p-4 text-muted text-sm">No active students in this class.</p> :
         <div className="divide-y">
          {students.map((s) => {
            const r = rows[s.id] ?? blank();
            return (
              <div key={s.id} className="p-3 space-y-2">
                <div className="font-semibold">{s.name} <span className="text-xs text-muted font-normal">· Roll {s.admissionNo ?? "—"}</span></div>
                <div className="flex gap-2">
                  {(["present", "tardy", "absent"] as const).map((f) => (
                    <label key={f} className="flex-1">
                      <span className="block text-[11px] uppercase tracking-wide text-muted mb-0.5">{f}</span>
                      <input inputMode="numeric" value={r[f]} onChange={(e) => edit(s.id, f, e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full h-10 text-center border rounded-lg" placeholder="0" />
                    </label>
                  ))}
                </div>
                <input value={r.remark} onChange={(e) => edit(s.id, "remark", e.target.value)}
                  placeholder="Remark (appears on the report card)"
                  className="w-full h-10 px-3 border rounded-lg text-sm" />
              </div>
            );
          })}
         </div>}
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex items-center gap-3">
        <span className="flex-1 text-sm text-muted">{students.length} students</span>
        <Button onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
