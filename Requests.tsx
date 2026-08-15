import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, Empty, Field, Modal, Select, useToast } from "../components/ui";
import { listClassesForSchool, listClassSubjects, type Pick, type CsRow } from "../lib/classadmin";
import {
  createRequest, listMyRequests, listPendingRequests, decideRequest,
  type MyRequest, type PendingRequest,
} from "../lib/requests";

function StatusPill({ s }: { s: string }) {
  const c = s === "approved" ? "bg-ok/15 text-ok" : s === "denied" ? "bg-danger/15 text-danger" : "bg-paper text-muted";
  return <span className={`text-xs px-2 py-0.5 rounded ${c}`}>{s}</span>;
}

export default function Requests() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  if (isAdmin) return <AdminInbox schoolId={profile!.school_id} adminId={profile!.id} />;
  return <TeacherRequest teacherId={profile!.id} schoolId={profile!.school_id} />;
}

function AdminInbox({ schoolId, adminId }: { schoolId: string; adminId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() { setLoading(true); try { setRows(await listPendingRequests(schoolId)); } catch (e: any) { toast(e.message ?? "Could not load", "error"); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);

  async function decide(r: PendingRequest, approve: boolean) {
    setBusy(r.id);
    try { await decideRequest(r, approve, adminId); toast(approve ? "Approved" : "Denied"); await load(); }
    catch (e: any) { toast(e.message ?? "Failed", "error"); }
    finally { setBusy(null); }
  }

  if (loading) return <Card><p className="p-4 text-muted text-sm">Loading…</p></Card>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Teachers who request access to a class-subject appear here. Approving assigns them to it.</p>
      <Card>
        {rows.length === 0 ? <Empty title="No pending requests" hint="You're all caught up." />
          : <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium">{r.teacherName}</div>
                  <div className="text-sm text-muted">{r.className} — {r.subjectName}</div>
                  {r.note && <div className="text-xs text-muted mt-0.5 italic">“{r.note}”</div>}
                </div>
                <Button onClick={() => decide(r, true)} disabled={busy === r.id}>Approve</Button>
                <Button variant="ghost" onClick={() => decide(r, false)} disabled={busy === r.id}>Deny</Button>
              </div>
            ))}
          </div>}
      </Card>
    </div>
  );
}

function TeacherRequest({ teacherId, schoolId }: { teacherId: string; schoolId: string }) {
  const toast = useToast();
  const [mine, setMine] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<Pick[]>([]);
  const [pickClass, setPickClass] = useState("");
  const [subs, setSubs] = useState<CsRow[]>([]);
  const [pickCs, setPickCs] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() { setLoading(true); try { setMine(await listMyRequests(teacherId)); } catch (e: any) { toast(e.message ?? "Could not load", "error"); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);

  async function openForm() { setPickClass(""); setPickCs(""); setNote(""); setSubs([]); setClasses(await listClassesForSchool(schoolId)); setOpen(true); }
  async function onClass(cid: string) { setPickClass(cid); setPickCs(""); setSubs(cid ? await listClassSubjects(cid) : []); }
  async function submit() {
    if (!pickCs) return;
    setBusy(true);
    try { await createRequest(pickCs, teacherId, schoolId, note); setOpen(false); toast("Request sent"); await load(); }
    catch (e: any) { toast(e.message ?? "Could not send", "error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Ask an admin for access to a class-subject if one is missing from your list.</p>
        <Button onClick={openForm}>Request access</Button>
      </div>
      <Card>
        {loading ? <p className="p-4 text-muted text-sm">Loading…</p>
          : mine.length === 0 ? <Empty title="No requests yet" hint="Use “Request access” if you're missing a class." />
          : <div className="divide-y">
            {mine.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <div className="flex-1"><span className="font-medium">{r.className} — {r.subjectName}</span></div>
                <StatusPill s={r.status} />
              </div>
            ))}
          </div>}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Request subject access">
        <div className="space-y-3">
          <Field label="Class">
            <Select value={pickClass} onChange={(e) => onClass(e.target.value)}>
              <option value="">Choose a class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {pickClass && (
            <Field label="Subject">
              <Select value={pickCs} onChange={(e) => setPickCs(e.target.value)}>
                <option value="">Choose a subject…</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.subjectName}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you need it" className="w-full h-10 rounded-lg border border-line px-3 text-sm" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !pickCs}>{busy ? "Sending…" : "Send request"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
