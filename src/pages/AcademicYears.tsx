import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { AcademicYear, Term } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, useToast } from "../components/ui";

export default function AcademicYears() {
  const { profile } = useAuth();
  const toast = useToast();
  const [yearOpen, setYearOpen] = useState(false);
  const [yearForm, setYearForm] = useState({ name: "", start_date: "", end_date: "" });
  const [termFor, setTermFor] = useState<AcademicYear | null>(null);
  const [termForm, setTermForm] = useState({ name: "", sequence: "1", start_date: "", end_date: "" });
  const [busy, setBusy] = useState(false);

  const years = useFetch<AcademicYear[]>(async () => {
    const { data, error } = await supabase.from("academic_years").select("*").order("name", { ascending: false });
    if (error) throw error;
    return data as AcademicYear[];
  });
  const terms = useFetch<Term[]>(async () => {
    const { data, error } = await supabase.from("terms").select("*").order("sequence");
    if (error) throw error;
    return data as Term[];
  });

  async function saveYear() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("academic_years").insert({
      school_id: profile.school_id, name: yearForm.name,
      start_date: yearForm.start_date || null, end_date: yearForm.end_date || null,
    });
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Year added"); setYearOpen(false); setYearForm({ name: "", start_date: "", end_date: "" }); years.refetch();
  }

  async function saveTerm() {
    if (!termFor) return;
    setBusy(true);
    const { error } = await supabase.from("terms").insert({
      academic_year_id: termFor.id, name: termForm.name, sequence: Number(termForm.sequence) || 1,
      start_date: termForm.start_date || null, end_date: termForm.end_date || null,
    });
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Term added"); setTermFor(null); setTermForm({ name: "", sequence: "1", start_date: "", end_date: "" }); terms.refetch();
  }

  async function makeCurrentYear(y: AcademicYear) {
    // only one current year per school — clear others first (DB also enforces this)
    await supabase.from("academic_years").update({ is_current: false }).eq("school_id", y.school_id);
    const { error } = await supabase.from("academic_years").update({ is_current: true }).eq("id", y.id);
    if (error) { toast(error.message, "error"); return; }
    toast(`${y.name} set as current`); years.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setYearOpen(true)}>Add year</Button></div>

      {years.loading ? <Empty title="Loading…" hint="" />
        : !years.data || years.data.length === 0 ? (
          <Card><Empty title="No academic years yet" hint="Add a year, then its terms." /></Card>
        ) : years.data.map((y) => (
          <Card key={y.id} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg text-ink">{y.name}</span>
                  {y.is_current && <span className="font-mono text-[10px] uppercase tracking-wide text-brand bg-brand-50 px-2 py-0.5 rounded">Current</span>}
                </div>
                <div className="font-mono text-xs text-muted mt-0.5">{y.start_date ?? "?"} → {y.end_date ?? "?"}</div>
              </div>
              <div className="flex gap-2">
                {!y.is_current && <Button variant="ghost" onClick={() => makeCurrentYear(y)}>Set current</Button>}
                <Button variant="ghost" onClick={() => setTermFor(y)}>Add term</Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(terms.data ?? []).filter((t) => t.academic_year_id === y.id).map((t) => (
                <span key={t.id} className="text-xs border border-line rounded px-2.5 py-1">
                  {t.name}{t.is_current && <span className="text-brand"> ·current</span>}
                </span>
              ))}
            </div>
          </Card>
        ))}

      <Modal open={yearOpen} onClose={() => setYearOpen(false)} title="Add academic year">
        <div className="space-y-3">
          <Field label="Name"><Input value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} placeholder="2025-2026" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setYearOpen(false)}>Cancel</Button>
            <Button onClick={saveYear} disabled={busy || !yearForm.name}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!termFor} onClose={() => setTermFor(null)} title={`Add term — ${termFor?.name ?? ""}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} placeholder="Term 1" /></Field>
            <Field label="Sequence"><Input type="number" value={termForm.sequence} onChange={(e) => setTermForm({ ...termForm, sequence: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><Input type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} /></Field>
            <Field label="End"><Input type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setTermFor(null)}>Cancel</Button>
            <Button onClick={saveTerm} disabled={busy || !termForm.name}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
