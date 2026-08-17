import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Input, Select, useToast } from "../components/ui";
import {
  getEvent, updateDeadline, listClasses, listClassesInYear, listUnlocks, reopenSubject, reopenClass, relock, listEntryProgress, updateSchoolDays,
  type EventRow, type UnlockRow, type Pick, type EntryRow,
} from "../lib/events";
import { listClassSubjects, type CsRow } from "../lib/classadmin";
import { loadClassReports } from "../lib/reportcards";
import { buildReportHtml } from "../lib/reportCardHtml";
import { loadClassResultsGrid, downloadResultsExcel, type ResultSheet } from "../lib/excelExport";
import { supabase } from "../lib/supabase";

function fmtLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventDetail() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const [ev, setEv] = useState<EventRow | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [classes, setClasses] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [genClasses, setGenClasses] = useState<Pick[]>([]);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [progress, setProgress] = useState<EntryRow[]>([]);
  const [schoolDays, setSchoolDays] = useState<string>("");
  const [sdBusy, setSdBusy] = useState(false);

  // reopen picker
  const [cls, setCls] = useState("");
  const [cs, setCs] = useState<CsRow[]>([]);
  const [subj, setSubj] = useState("");
  const [busy, setBusy] = useState(false);

  async function reloadUnlocks() { setUnlocks(await listUnlocks(id)); }
  useEffect(() => {
    (async () => {
      try {
        const e = await getEvent(id);
        setEv(e); setSchoolDays(e.schoolDays != null ? String(e.schoolDays) : ""); setDeadline(fmtLocalInput(e.deadline));
        await reloadUnlocks();
        setClasses(await listClasses(profile!.school_id));
        const inYear = e.academicYearId ? await listClassesInYear(e.academicYearId) : await listClasses(profile!.school_id);
        setGenClasses(inYear);
        try { setProgress(await listEntryProgress(id, e.academicYearId, profile!.school_id)); } catch { /* ignore */ }
      } catch (e: any) { toast(e.message ?? "Could not load event", "error"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  async function pickClass(cid: string) {
    setCls(cid); setSubj("");
    if (cid) { try { setCs(await listClassSubjects(cid)); } catch (e: any) { toast(e.message ?? "Failed", "error"); } }
    else setCs([]);
  }
  async function saveDeadline() {
    setBusy(true);
    try { const iso = deadline ? new Date(deadline).toISOString() : null; await updateDeadline(id, iso); setEv(await getEvent(id)); toast("Deadline updated"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); } finally { setBusy(false); }
  }
  async function doReopenSubject() {
    if (!subj) return;
    try { await reopenSubject(id, subj); toast("Subject reopened"); setSubj(""); reloadUnlocks(); }
    catch (e: any) { toast(e.message?.includes("duplicate") ? "Already reopened." : (e.message ?? "Failed"), "error"); }
  }
  async function doReopenClass() {
    if (!cls) return;
    try { await reopenClass(id, cls); toast("Homeroom reopened"); reloadUnlocks(); }
    catch (e: any) { toast(e.message?.includes("duplicate") ? "Already reopened." : (e.message ?? "Failed"), "error"); }
  }
  async function doRelock(u: UnlockRow) {
    try { await relock(u.id); setUnlocks((p) => p.filter((x) => x.id !== u.id)); toast("Re-locked"); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
  }

  async function saveSchoolDays() {
    setSdBusy(true);
    try { await updateSchoolDays(id, schoolDays === "" ? null : parseInt(schoolDays, 10)); toast("School days saved"); }
    catch (e: any) { toast(e.message ?? "Could not save", "error"); }
    finally { setSdBusy(false); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  if (!ev) return <Card><p className="p-4 text-muted text-sm">Event not found.</p></Card>;

  async function generateClass(classId: string) {
    if (!ev?.termId) { toast("This exam event has no term set — recreate it with a term.", "error"); return; }
    setGenBusy(classId);
    try {
      const data = await loadClassReports(classId, ev.termId, ev.id);
      const html = buildReportHtml(data, `${window.location.origin}/Logo.svg`);
      const w = window.open("", "_blank");
      if (!w) { toast("Allow pop-ups to open the print view", "error"); return; }
      w.document.write(html); w.document.close();
    } catch (e: any) { toast(e.message ?? "Could not build report cards", "error"); }
    finally { setGenBusy(null); }
  }

  async function downloadExcel() {
    if (!ev?.termId) { toast("This exam event has no term set.", "error"); return; }
    if (genClasses.length === 0) { toast("No classes in this year.", "error"); return; }
    setXlsxBusy(true);
    try {
      const { data: sch } = await supabase.from("schools").select("name").limit(1).single();
      const sheets: ResultSheet[] = [];
      for (const c of genClasses) sheets.push(await loadClassResultsGrid(c.id, ev.termId, ev.id));
      await downloadResultsExcel(sch?.name ?? "School", sheets, `${ev.name.replace(/[^\w]+/g, "_")}_results.xlsx`);
      toast("Excel downloaded");
    } catch (e: any) { toast(e.message ?? "Could not build the Excel file", "error"); }
    finally { setXlsxBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/events" className="text-sm text-brand">‹ All events</Link>
        <h1 className="text-xl font-semibold mt-1">{ev.name}</h1>
        <p className="text-sm text-muted">
          <span className="uppercase">{ev.kind}</span> · {ev.open ? <span className="text-ok">Open for entry</span> : <span className="text-danger">Closed (deadline passed)</span>}
        </p>
      </div>

      <Card>
        <div className="p-4 flex items-end gap-3 flex-wrap">
          <Field label="School days (shown on report cards)">
            <Input inputMode="numeric" value={schoolDays} onChange={(e) => setSchoolDays(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 91" />
          </Field>
          <Button onClick={saveSchoolDays} disabled={sdBusy}>{sdBusy ? "Saving…" : "Save"}</Button>
        </div>
      </Card>

      <div>
        <h2 className="font-semibold mb-2">Entry progress</h2>
        <Card>
          <div className="p-3 text-sm flex gap-4 border-b">
            <span className="text-ok font-semibold">{progress.filter((r) => r.entered).length} entered</span>
            <span className="text-danger font-semibold">{progress.filter((r) => !r.entered).length} not entered</span>
            <span className="text-muted ml-auto">{progress.length} class-subjects</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {progress.map((r, i) => (
              <div key={i} className="p-2.5 flex items-center gap-3 text-sm">
                <span className={`text-[11px] px-2 py-0.5 rounded ${r.entered ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>{r.entered ? "in" : "—"}</span>
                <span className="w-14 font-medium">{r.className}</span>
                <span className="flex-1">{r.subjectName}</span>
                <span className="text-xs text-muted">{r.teacherName}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 space-y-2">
          <Field label="Deadline for teacher entry">
            <div className="flex gap-2">
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              <Button onClick={saveDeadline} disabled={busy}>Save</Button>
            </div>
          </Field>
          <p className="text-xs text-muted">{ev.open ? "Entry is open." : "Entry is locked. Reopen specific subjects or a class's homeroom below, or push the deadline out."}</p>
        </div>
      </Card>

      <div>
        <h2 className="font-semibold mb-2">Reopen entry (override the lock)</h2>
        <Card>
          <div className="p-4 space-y-3">
            <Field label="Class">
              <Select value={cls} onChange={(e) => pickClass(e.target.value)}>
                <option value="">Choose a class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            {cls && (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="A subject (for the subject teacher)">
                  <Select value={subj} onChange={(e) => setSubj(e.target.value)}>
                    <option value="">Choose a subject…</option>
                    {cs.map((r) => <option key={r.id} value={r.id}>{r.subjectName} — {r.teacherName}</option>)}
                  </Select>
                </Field>
                <Button onClick={doReopenSubject} disabled={!subj}>Reopen subject</Button>
                <Button variant="ghost" onClick={doReopenClass}>Reopen homeroom (attendance/remarks)</Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Currently reopened</h2>
        <Card>
          {unlocks.length === 0 ? <Empty title="Nothing reopened" hint="The deadline governs everything." />
            : <div className="divide-y">
              {unlocks.map((u) => (
                <div key={u.id} className="p-3 flex items-center gap-3">
                  <span className={`text-[11px] uppercase px-2 py-0.5 rounded ${u.kind === "subject" ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-600"}`}>{u.kind}</span>
                  <span className="flex-1">{u.label}</span>
                  <button onClick={() => doRelock(u)} className="text-sm text-danger">Re-lock</button>
                </div>
              ))}
            </div>}
        </Card>
      </div>

      {ev.kind === "exam" && !ev.open && (
        <div>
          <h2 className="font-semibold mb-2">Generate report cards</h2>
          {!ev.termId
            ? <Card><p className="p-4 text-sm text-danger">This exam event has no term set, so report cards can't be built. Recreate the event with a term.</p></Card>
            : <Card>
                <div className="p-3 flex items-center gap-2 border-b">
                  <span className="flex-1 text-sm text-muted">Download all classes as one Excel workbook (same layout as the school sheet).</span>
                  <button onClick={downloadExcel} disabled={xlsxBusy} className="text-sm font-semibold text-brand disabled:opacity-50">{xlsxBusy ? "Building…" : "Download Excel"}</button>
                </div>
                <div className="p-3 text-sm text-muted">Or pick a class to open its print-ready report cards.</div>
                <div className="divide-y">
                  {genClasses.length === 0
                    ? <p className="p-3 text-sm text-muted">No classes in this year.</p>
                    : genClasses.map((c) => (
                      <button key={c.id} onClick={() => generateClass(c.id)} disabled={genBusy === c.id}
                        className="w-full text-left p-3 flex items-center gap-3 hover:bg-paper disabled:opacity-50">
                        <span className="flex-1 font-medium">{c.name}</span>
                        <span className="text-sm text-brand">{genBusy === c.id ? "Building…" : "Open print view ›"}</span>
                      </button>
                    ))}
                </div>
              </Card>}
        </div>
      )}
    </div>
  );
}
