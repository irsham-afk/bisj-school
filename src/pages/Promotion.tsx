import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, useToast } from "../components/ui";
import { loadPromotion, runPromotion, type PromoClass, type PromoResult } from "../lib/promotion";

export default function Promotion() {
  const { profile } = useAuth();
  const toast = useToast();
  const schoolId = profile!.school_id;

  const [classes, setClasses] = useState<PromoClass[]>([]);
  const [held, setHeld] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<PromoResult | null>(null);

  async function reload() {
    setClasses(await loadPromotion(schoolId)); setHeld(new Set()); setDone(null);
  }
  useEffect(() => {
    (async () => {
      try { await reload(); }
      catch (e: any) { toast(e.message ?? "Could not load students", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  function toggle(id: string) {
    setHeld((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function holdWholeClass(c: PromoClass, hold: boolean) {
    setHeld((h) => { const n = new Set(h); c.students.forEach((s) => hold ? n.add(s.studentId) : n.delete(s.studentId)); return n; });
  }

  async function promote() {
    const total = classes.reduce((a, c) => a + c.students.length, 0);
    const gradCount = classes.filter((c) => c.graduates).reduce((a, c) => a + c.students.filter((s) => !held.has(s.studentId)).length, 0);
    if (!confirm(`Move ${total - held.size} students up one grade and hold ${held.size} in place? ${gradCount ? `${gradCount} A-2 student(s) will graduate. ` : ""}This updates who is in each class now.`)) return;
    setBusy(true);
    try { const r = await runPromotion(schoolId, held); setDone(r); toast("Promotion complete"); }
    catch (e: any) { toast(e.message ?? "Promotion failed", "error"); }
    finally { setBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  const total = classes.reduce((a, c) => a + c.students.length, 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Move every student up to their next grade. Everyone is ticked to promote — untick anyone who should stay in their current grade. A-2 students are marked as graduated. Classes stay fixed; only who's in them changes.</p>

      {done ? (
        <Card><div className="p-4 text-sm">
          <div className="font-semibold text-ok mb-1">Promotion complete</div>
          {done.promoted} moved up · {done.repeated} held back · {done.graduated} graduated.
          <div className="mt-3"><Button variant="ghost" onClick={reload}>Done</Button></div>
        </div></Card>
      ) : (
        <>
          <div className="flex items-center justify-between sticky top-14 bg-paper py-2 z-10">
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
