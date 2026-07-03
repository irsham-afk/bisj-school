import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Input, Modal, Select, useToast } from "../components/ui";
import { listEvents, createEvent, listYears, listTerms, type EventRow, type Pick, type EventKind } from "../lib/events";

function fmt(d: string | null) {
  if (!d) return "no deadline";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function Events() {
  const { profile } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [years, setYears] = useState<Pick[]>([]);
  const [terms, setTerms] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "exam" as EventKind, academic_year_id: "", term_id: "", deadline: "" });
  const [busy, setBusy] = useState(false);

  async function reload() { setEvents(await listEvents(profile!.school_id)); }
  useEffect(() => {
    (async () => {
      try { await reload(); setYears(await listYears(profile!.school_id)); }
      catch (e: any) { toast(e.message ?? "Could not load events", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    if (!form.name) return;
    setBusy(true);
    try {
      const iso = form.deadline ? new Date(form.deadline).toISOString() : null;
      await createEvent(profile!.school_id, form.name, form.kind, form.academic_year_id || null, iso, profile!.id, form.kind === "exam" ? (form.term_id || null) : null);
      toast("Event created"); setOpen(false);
      setForm({ name: "", kind: "exam", academic_year_id: "", term_id: "", deadline: "" }); setTerms([]);
      reload();
    } catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">Exam and PTM cycles. Teachers enter data until the deadline, then it locks.</p>
        <Button onClick={() => setOpen(true)}>New event</Button>
      </div>

      <Card>
        {loading ? <Empty title="Loading…" hint="" />
          : events.length === 0 ? <Empty title="No events yet" hint="Create an exam or PTM event to open data entry." />
          : <div className="divide-y">
            {events.map((e) => (
              <Link key={e.id} to={`/events/${e.id}`} className="flex items-center gap-3 p-3.5 hover:bg-paper">
                <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded ${e.kind === "exam" ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-600"}`}>{e.kind}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold">{e.name}</span>
                  <span className="block text-xs text-muted">Deadline: {fmt(e.deadline)}</span>
                </span>
                <span className={`text-xs uppercase tracking-wide ${e.open ? "text-ok" : "text-danger"}`}>{e.open ? "Open" : "Closed"}</span>
                <span className="text-slate-300 text-xl">›</span>
              </Link>
            ))}
          </div>}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New event">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Final Exam 2026/27 or PTM 1 2026/27" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}>
                <option value="exam">Exam → report cards</option>
                <option value="ptm">PTM → PTM sheets</option>
              </Select>
            </Field>
            <Field label="Academic year">
              <Select value={form.academic_year_id} onChange={async (e) => { const yid = e.target.value; setForm({ ...form, academic_year_id: yid, term_id: "" }); setTerms(yid ? await listTerms(yid) : []); }}>
                <option value="">—</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </Select>
            </Field>
          </div>
          {form.kind === "exam" && (
            <Field label="Term (which term these marks belong to)">
              <Select value={form.term_id} onChange={(e) => setForm({ ...form, term_id: e.target.value })}>
                <option value="">Choose a term…</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Deadline for teacher entry">
            <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <p className="text-xs text-muted">After the deadline, teacher entry locks until you reopen it. Leave blank for no deadline.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name}>{busy ? "Creating…" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}