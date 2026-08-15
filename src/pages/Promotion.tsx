import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Field, Input, Select, useToast } from "../components/ui";
import {
  listYears, createYear, loadPromotion, runPromotion,
  type YearRow, type PromoClass, type PromoResult,
} from "../lib/promotion";

export default function Promotion() {
  const { profile } = useAuth();
  const toast = useToast();
  const schoolId = profile!.school_id;

  const [years, setYears] = useState<YearRow[]>([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [newYearName, setNewYearName] = useState("");
  const [classes, setClasses] = useState<PromoClass[]>([]);
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PromoResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ys = await listYears(schoolId);
        setYears(ys);
        const cur = ys.find((y) => y.isCurrent) ?? ys[0];
        if (cur) { setFromYear(cur.id); }
      } catch (e: any) { toast(e.message ?? "Could not load years", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!fromYear) return;
    (async () => {
      try { setClasses(await loadPromotion(schoolId, fromYear)); setHeld(new Set()); setDone(null); }
      catch (e: any) { toast(e.message ?? "Could not load students", "error"); }
    })();
  }, [fromYear]);

  function toggle(id: string) {
    setHeld((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function holdWholeClass(c: PromoClass, hold: boolean) {
    setHeld((h) => { const n = new Set(h); c.students.forEach((s) => hold ? n.add(s.studentId) : n.delete(s.studentId)); return n; });
  }

  async function addYear() {
    if (!newYearName.trim()) return;
    try { const id = await createYear(schoolId, newYearName.trim()); setYears(await listYears(schoolId)); setToYear(id); setNewYearName(""); toast("Year created"); }
    catch (e: any) { toast(e.message ?? "Could not create year", "error"); }
  }

  async function promote() {
    if (!toYear) { toast("Choose the year to promote into", "error"); return; }
    if (toYear === fromYear) { toast("The two years must be different", "error"); return; }
    const total = classes.reduce((a, c) => a + c.students.length, 0);
    if (!confirm(`Promote ${total - held.size} students, hold back ${held.size}, into the new year? This creates their new enrolments.`)) return;
    setBusy(true);
    try { const r = await runPromotion(schoolId, fromYear, toYear, held); setDone(r); toast("Promotion complete"); }
    catch (e: any) { toast(e.message ?? "Promotion failed", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;

  const total = classes.reduce((a, c) => a + c.students.length, 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Move every student up to their next grade for a new year. Everyone is ticked to promote — untick anyone who should stay in their current grade. Graduating students (A-2) are marked as graduated.</p>

      <Card>
        <div className="p-4 grid gap-3 sm:grid-cols-2">
          <Field label="Promote FROM year">
            <Select value={fromYear} onChange={(e) => setFromYear(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? " (current)" : ""}</option>)}
            </Select>
          </Field>
          <Field label="Promote INTO year">
            <Select value={toYear} onChange={(e) => setToYear(e.target.value)}>
              <option value="">Choose…</option>
              {years.filter((y) => y.id !== fromYear).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="px-4 pb-4 flex items-end gap-2">
          <Field label="…or create the next year"><Input value={newYearName} onChange={(e) => setNewYearName(e.target.value)} placeholder="2027-2028" /></Field>
          <Button variant="ghost" onClick={addYear} disabled={!newYearName.trim()}>Create year</Button>
        </div>
      </Card>

      {done ? (
        <Card><div className="p-4 text-sm">
          <div className="font-semibold text-ok mb-1">Promotion complete</div>
          {done.promoted} promoted · {done.repeated} held back (repeating) · {done.graduated} graduated.
          <div className="text-muted mt-2">Set the new year as current under Years &amp; terms when you're ready.</div>
        </div></Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">{total - held.size} to promote · {held.size} held back</div>
            <Button onClick={promote} disabled={busy || total === 0}>{busy ? "Promoting…" : "Promote ticked students"}</Button>
          </div>

          {classes.map((c) => (
            <Card key={c.classId}>
              <div className="p-3 border-b flex items-center gap-2">
                <span className="font-semibold">{c.grade}</span>
                <span className="text-sm text-muted">→ {c.graduates ? "Graduate" : c.nextGrade}</span>
                <span className="text-xs text-muted ml-2">({c.students.length})</span>
                <div className="ml-auto flex gap-3 text-xs">
                  <button className="text-brand" onClick={() => holdWholeClass(c, false)}>Tick all</button>
                  <button className="text-danger" onClick={() => holdWholeClass(c, true)}>Hold all</button>
                </div>
              </div>
              <div className="divide-y">
                {c.students.map((s) => {
                  const hold = held.has(s.studentId);
                  return (
                    <label key={s.studentId} className="p-2.5 flex items-center gap-3 cursor-pointer hover:bg-paper">
                      <input type="checkbox" checked={!hold} onChange={() => toggle(s.studentId)} className="w-4 h-4" />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-muted font-mono">{s.admissionNo ?? ""}</span>
                      <span className={`text-xs ${hold ? "text-danger" : "text-ok"}`}>{hold ? `stays in ${c.grade}` : (c.graduates ? "graduates" : `→ ${c.nextGrade}`)}</span>
                    </label>
                  );
                })}
                {c.students.length === 0 && <p className="p-3 text-sm text-muted">No students.</p>}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
