import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, useToast } from "../components/ui";
import { listHomeroomClasses, listTerms, type HomeroomClass } from "../lib/attendance";
import type { Term } from "../lib/marks";
import { loadClassReports, type ClassReportData } from "../lib/reportcards";
import { buildReportHtml } from "../lib/reportCardHtml";
import { loadClassResultsGrid, downloadResultsExcel } from "../lib/excelExport";
import { supabase } from "../lib/supabase";

export default function ReportCards() {
  const { profile } = useAuth();
  const toast = useToast();
  const uid = profile?.id as string;
  const role = (profile?.role as string) ?? "teacher";

  const [classes, setClasses] = useState<HomeroomClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<HomeroomClass | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [term, setTerm] = useState<Term | null>(null);
  const [data, setData] = useState<ClassReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setClasses(await listHomeroomClasses(uid, role)); }
      catch (e: any) { toast(e.message ?? "Could not load classes", "error"); }
      finally { setLoading(false); }
    })();
  }, [uid]);

  async function pickClass(c: HomeroomClass) {
    setCls(c); setTerm(null); setData(null);
    try { setTerms(await listTerms(c.academicYearId)); }
    catch (e: any) { toast(e.message ?? "Could not load terms", "error"); }
  }

  async function generate(t: Term) {
    setTerm(t); setBusy(true); setData(null);
    try { setData(await loadClassReports(cls!.id, t.id)); }
    catch (e: any) { toast(e.message ?? "Could not build report cards", "error"); }
    finally { setBusy(false); }
  }

  function openPrint() {
    if (!data) return;
    const html = buildReportHtml(data, `${window.location.origin}/Logo.svg`);
    const w = window.open("", "_blank");
    if (!w) { toast("Allow pop-ups to open the print view", "error"); return; }
    w.document.write(html); w.document.close();
  }

  async function downloadExcel() {
    if (!cls || !term) return;
    setXlsxBusy(true);
    try {
      const { data: sch } = await supabase.from("schools").select("name").limit(1).single();
      const sheet = await loadClassResultsGrid(cls.id, term.id);
      await downloadResultsExcel(sch?.name ?? "School", [sheet], `${cls.name}_${term.name}_results.xlsx`.replace(/[^\w.]+/g, "_"));
      toast("Excel downloaded");
    } catch (e: any) { toast(e.message ?? "Could not build the Excel file", "error"); }
    finally { setXlsxBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  if (classes.length === 0)
    return <Card><p className="p-4 text-muted text-sm">No classes available to you for report cards.</p></Card>;

  if (!cls) return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Generate report cards — choose a class.</p>
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
      <button onClick={() => setCls(null)} className="text-sm text-brand">‹ Back to classes</button>
      <p className="text-sm text-muted">{cls.name} — which term?</p>
      {terms.map((t) => (
        <button key={t.id} onClick={() => generate(t)}
          className="w-full text-left bg-white border rounded-xl p-4 flex items-center gap-3 hover:bg-paper">
          <span className="flex-1 font-semibold">{t.name}</span><span className="text-slate-300 text-xl">›</span>
        </button>
      ))}
    </div>
  );

  const withMarks = data ? data.students.filter((s) => s.subjects.some((x) => x.score !== null || x.status === "absent")).length : 0;
  const noRemark = data ? data.students.filter((s) => !s.remark).length : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => { setTerm(null); setData(null); }} className="text-sm text-brand">‹ Back</button>
      <h2 className="font-semibold text-lg">{cls.name} · {term.name}</h2>

      {busy ? <Card><p className="p-4 text-muted text-sm">Building report cards…</p></Card> :
       !data ? null :
       <>
        <Card>
          <div className="p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted">Students</span><span className="font-semibold">{data.students.length}</span></div>
            <div className="flex justify-between"><span className="text-muted">With marks entered</span><span className="font-semibold">{withMarks}</span></div>
            <div className="flex justify-between"><span className="text-muted">Missing a remark</span><span className={noRemark ? "font-semibold text-danger" : "font-semibold"}>{noRemark}</span></div>
            <div className="flex justify-between"><span className="text-muted">Grade scale</span><span className="font-semibold">{data.bands.length ? `${data.bands.length} bands` : "not set"}</span></div>
          </div>
        </Card>

        <div className="bg-white border rounded-xl p-4 space-y-3">
          <p className="text-sm">Opens a print-ready view of all {data.students.length} cards — one per page, in school colours. Use your browser's <b>Save as PDF</b> to get the whole class as one file, or print directly.</p>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={openPrint}>Open print view ({data.students.length} cards)</Button>
            <Button variant="ghost" onClick={downloadExcel} disabled={xlsxBusy}>{xlsxBusy ? "Building…" : "Download Excel sheet"}</Button>
          </div>
          {data.bands.length === 0 && <p className="text-xs text-danger">No grade scale is set for this school yet, so grade letters won't show. Set it on the school setup before generating.</p>}
        </div>
       </>}
    </div>
  );
}
