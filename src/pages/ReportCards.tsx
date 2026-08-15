import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, useToast } from "../components/ui";
import { listEvents, listClassesInYear, listClasses, type EventRow, type Pick } from "../lib/events";
import { loadClassReports, type ClassReportData } from "../lib/reportcards";
import { buildReportHtml } from "../lib/reportCardHtml";
import { downloadAllGradesExcel } from "../lib/excelExport";
import { supabase } from "../lib/supabase";

export default function ReportCards() {
  const { profile } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ev, setEv] = useState<EventRow | null>(null);
  const [classes, setClasses] = useState<Pick[]>([]);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setEvents(await listEvents(profile!.school_id)); }
      catch (e: any) { toast(e.message ?? "Could not load events", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function pickEvent(e: EventRow) {
    setEv(e);
    try { setClasses(e.academicYearId ? await listClassesInYear(e.academicYearId) : await listClasses(profile!.school_id)); }
    catch (err: any) { toast(err.message ?? "Could not load classes", "error"); }
  }

  async function downloadAll() {
    if (!ev) return;
    setXlsxBusy(true);
    try {
      const { data: sch } = await supabase.from("schools").select("id, name").limit(1).single();
      await downloadAllGradesExcel((sch as any).id, (sch as any).name ?? "School", ev.id);
      toast("Excel downloaded");
    } catch (e: any) { toast(e.message ?? "Could not build the Excel file", "error"); }
    finally { setXlsxBusy(false); }
  }

  async function generateClass(classId: string) {
    if (!ev) return;
    setGenBusy(classId);
    try {
      const data: ClassReportData = await loadClassReports(classId, ev.termId ?? "", ev.id);
      const html = buildReportHtml(data, `${window.location.origin}/Logo.svg`);
      const w = window.open("", "_blank");
      if (!w) { toast("Allow pop-ups to open the print view", "error"); return; }
      w.document.write(html); w.document.close();
    } catch (e: any) { toast(e.message ?? "Could not build report cards", "error"); }
    finally { setGenBusy(null); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;

  // 1) choose an event
  if (!ev) return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Choose an exam or PTM event to download its reports or Excel — current and past events are listed.</p>
      {events.length === 0
        ? <Card><p className="p-4 text-muted text-sm">No events yet. Create one under Exams & PTM.</p></Card>
        : events.map((e) => (
          <button key={e.id} onClick={() => pickEvent(e)}
            className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
            <span className="text-[11px] uppercase px-2 py-0.5 rounded bg-brand/10 text-brand">{e.kind}</span>
            <span className="flex-1 font-semibold">{e.name}</span>
            <span className={`text-xs ${e.open ? "text-ok" : "text-muted"}`}>{e.open ? "open" : "closed"}</span>
            <span className="text-slate-300 text-xl">›</span>
          </button>
        ))}
    </div>
  );

  // 2) event chosen — download all-grades Excel, or a class's report cards
  return (
    <div className="space-y-4">
      <button onClick={() => { setEv(null); setClasses([]); }} className="text-sm text-brand">‹ Back to events</button>
      <h2 className="font-semibold text-lg">{ev.name}</h2>

      <Card>
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="font-medium">Whole-school Excel</div>
            <div className="text-xs text-muted">One file, one sheet per grade — marks from this event.</div>
          </div>
          <Button onClick={downloadAll} disabled={xlsxBusy}>{xlsxBusy ? "Building…" : "Download Excel (all grades)"}</Button>
        </div>
      </Card>

      <div>
        <h3 className="font-semibold mb-2">Report cards by class</h3>
        <Card>
          <div className="divide-y">
            {classes.length === 0
              ? <p className="p-3 text-sm text-muted">No classes in this event's year.</p>
              : classes.map((c) => (
                <button key={c.id} onClick={() => generateClass(c.id)} disabled={genBusy === c.id}
                  className="w-full text-left p-3 flex items-center gap-3 hover:bg-paper disabled:opacity-50">
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-brand">{genBusy === c.id ? "Building…" : "Open print view ›"}</span>
                </button>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
