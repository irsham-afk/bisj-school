import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { AcademicYear, GradeLevel, Klass, Profile } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Select, Table, useToast } from "../components/ui";

export default function Classes() {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", grade_level_id: "", academic_year_id: "", homeroom_teacher_id: "" });
  const [busy, setBusy] = useState(false);

  const grades = useFetch<GradeLevel[]>(async () => (await supabase.from("grade_levels").select("*").order("level_order")).data as GradeLevel[] ?? []);
  const years = useFetch<AcademicYear[]>(async () => (await supabase.from("academic_years").select("*").order("name", { ascending: false })).data as AcademicYear[] ?? []);
  const teachers = useFetch<Profile[]>(async () => (await supabase.from("profiles").select("*").eq("role", "teacher").order("full_name")).data as Profile[] ?? []);
  const classes = useFetch<Klass[]>(async () => {
    const { data, error } = await supabase.from("classes").select("*").order("name");
    if (error) throw error;
    return data as Klass[];
  });

  const gradeOrder = (id: string) => grades.data?.find((g) => g.id === id)?.level_order ?? 999;
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? "—";
  const orderedClasses = [...(classes.data ?? [])].sort((a, b) => (gradeOrder(a.grade_level_id) - gradeOrder(b.grade_level_id)) || a.name.localeCompare(b.name));
  const teacherName = (id: string | null) => (id ? teachers.data?.find((t) => t.id === id)?.full_name ?? "—" : "—");

  async function save() {
    if (!profile) return;
    setBusy(true);
    const yearId = (years.data?.find((y) => (y as any).is_current) ?? years.data?.[0])?.id;
    if (!yearId) { setBusy(false); toast("No academic year exists yet.", "error"); return; }
    const { error } = await supabase.from("classes").insert({
      school_id: profile.school_id, name: form.name,
      grade_level_id: form.grade_level_id, academic_year_id: yearId,
      homeroom_teacher_id: form.homeroom_teacher_id || null,
    });
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Class added"); setOpen(false);
    setForm({ name: "", grade_level_id: "", academic_year_id: "", homeroom_teacher_id: "" });
    classes.refetch();
  }

  const canAdd = grades.data?.length && years.data?.length; // a year must exist (auto-assigned)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">
          {!canAdd ? "Add a grade level and an academic year first." : ""}
        </p>
        <Button onClick={() => setOpen(true)} disabled={!canAdd}>Add class</Button>
      </div>

      <Card>
        {classes.loading ? <Empty title="Loading…" hint="" />
          : !classes.data || classes.data.length === 0
            ? <Empty title="No classes yet" hint="Create a class to place students into." />
            : (
              <Table head={["Class", "Grade", "Homeroom", ""]}>
                {orderedClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-paper/60">
                    <td className="px-4 py-2.5 font-medium"><Link to={`/classes/${c.id}`} className="text-brand hover:underline">{c.name}</Link></td>
                    <td className="px-4 py-2.5">{gradeName(c.grade_level_id)}</td>
                    <td className="px-4 py-2.5">{teacherName(c.homeroom_teacher_id)}</td>
                    <td className="px-4 py-2.5 text-right"><Link to={`/classes/${c.id}`} className="text-sm text-brand hover:underline">Open ›</Link></td>
                  </tr>
                ))}
              </Table>
            )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add class">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="7A" /></Field>
          <Field label="Grade level">
            <Select value={form.grade_level_id} onChange={(e) => setForm({ ...form, grade_level_id: e.target.value })}>
              <option value="">Select…</option>
              {grades.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="Homeroom teacher (optional)">
            <Select value={form.homeroom_teacher_id} onChange={(e) => setForm({ ...form, homeroom_teacher_id: e.target.value })}>
              <option value="">None</option>
              {teachers.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name || !form.grade_level_id || !form.academic_year_id}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
