import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Input, Modal, Select, useToast } from "../components/ui";
import { listEvents, createEvent, deleteEvent, type EventRow, type EventKind } from "../lib/events";

function fmt(d: string | null) {
  if (!d) return "no deadline";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const EXAM_OPTIONS = ["Mid-Year Exam", "Final Exam"];

export default function Events() {
  const { profile } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "exam" as EventKind, examLabel: "Mid-Year Exam", yearLabel: "", deadline: "", schoolDays: "" });
  const [busy, setBusy] = useState(false);
  const [delBusy, setDelBusy] = useState<string | null>(null);

  async function reload() { setEvents(await listEvents(profile!.school_id)); }
  useEffect(() => {
    (async () => {
      try { await reload(); }
      catch (e: any) { toast(e.message ?? "Could not load events", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    if (!form.yearLabel.trim()) { toast("Enter the academic year", "error"); return; }
    setBusy(true);
    try {
      const iso = form.deadline ? new Date(form.deadline).toISOString() : null;
      await createEvent(profile!.school_id, form.kind, form.yearLabel.trim(), form.kind === "exam" ? form.examLabel : "", iso, profile!.id, form.schoolDays === "" ? null : parseInt(form.schoolDays, 10));
      toast("Event created"); setOpen(false);
      setForm({ kind: "exam", examLabel: "Mid-Year Exam", yearLabel: "", deadline: "", schoolDays: "" });
      reload();
    } catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setBusy(false); }
  }

  async function remove(e: EventRow) {
    if (!confirm(`Delete "${e.name}"? This permanently removes the event and any marks or attendance entered under it. This cannot be undone.`)) return;
    setDelBusy(e.id);
    try { await deleteEvent(e.id); toast("Event deleted"); await reload(); }
    catch (err: any) { toast(err.message ?? "Could not delete", "error"); }
    finally { setDelBusy(null); }
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
              <div key={e.id} className="flex items-center gap-3 p-3.5 hover:bg-paper">
                <Link to={`/events/${e.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded ${e.kind === "exam" ? "bg-brand/10 text-brand" : "bg-slate-200 text-slate-600"}`}>{e.kind}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{e.name}</span>
                    <span className="block text-xs text-muted">Deadline: {fmt(e.deadline)}</span>
                  </span>
                  <span className={`text-xs uppercase tracking-wide ${e.open ? "text-ok" : "text-danger"}`}>{e.open ? "Open" : "Closed"}</span>
                </Link>
                <button onClick={() => remove(e)} disabled={delBusy === e.id}
                  className="text-sm text-danger hover:underline shrink-0">{delBusy === e.id ? "Deleting…" : "Delete"}</button>
              </div>
            ))}
          </div>}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New event">
        <div className="space-y-3">
          <Field label="Type">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}>
              <option value="exam">Exam → report cards</option>
              <option value="ptm">PTM → PTM sheets</option>
            </Select>
          </Field>
          {form.kind === "exam" && (
            <Field label="Exam">
              <Select value={form.examLabel} onChange={(e) => setForm({ ...form, examLabel: e.target.value })}>
                {EXAM_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Academic year">
              <Input value={form.yearLabel} onChange={(e) => setForm({ ...form, yearLabel: e.target.value })} placeholder="2026/2027" />
            </Field>
            <Field label="School days (for reports)">
              <Input inputMode="numeric" value={form.schoolDays} onChange={(e) => setForm({ ...form, schoolDays: e.target.value.replace(/[^0-9]/g, "") })} placeholder="e.g. 91" />
            </Field>
          </div>
          <Field label="Deadline for teacher entry">
            <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <p className="text-xs text-muted">
            {form.kind === "exam"
              ? `Reports will show "${form.examLabel} ${form.yearLabel || "…"}".`
              : `PTM sheets for "${form.yearLabel || "…"}".`}
            {" "}After the deadline, teacher entry locks until you reopen it. Leave blank for no deadline.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.yearLabel.trim()}>{busy ? "Creating…" : "Create"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
