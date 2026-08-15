import { supabase } from "./supabase";

export type EventKind = "exam" | "ptm";
export type EventRow = {
  id: string; name: string; kind: EventKind; deadline: string | null;
  academicYearId: string | null; termId: string | null; open: boolean;
};
export type UnlockRow = { id: string; kind: "subject" | "class"; label: string };
export type Pick = { id: string; name: string };

function isOpen(deadline: string | null): boolean {
  return !deadline || new Date(deadline).getTime() > Date.now();
}

export async function listEvents(schoolId: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events").select("id, name, kind, deadline, academic_year_id, term_id")
    .eq("school_id", schoolId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id, name: e.name, kind: e.kind, deadline: e.deadline,
    academicYearId: e.academic_year_id, termId: e.term_id, open: isOpen(e.deadline),
  }));
}

export async function getEvent(id: string): Promise<EventRow> {
  const { data, error } = await supabase.from("events").select("id, name, kind, deadline, academic_year_id, term_id").eq("id", id).single();
  if (error) throw error;
  const e: any = data;
  return { id: e.id, name: e.name, kind: e.kind, deadline: e.deadline, academicYearId: e.academic_year_id, termId: e.term_id, open: isOpen(e.deadline) };
}

export async function createEvent(schoolId: string, name: string, kind: EventKind, academicYearId: string | null, deadline: string | null, createdBy: string, termId: string | null = null) {
  const { error } = await supabase.from("events").insert({
    school_id: schoolId, name, kind, academic_year_id: academicYearId || null, term_id: termId || null, deadline: deadline || null, created_by: createdBy,
  });
  if (error) throw error;
}
export async function updateDeadline(id: string, deadline: string | null) {
  const { error } = await supabase.from("events").update({ deadline: deadline || null }).eq("id", id);
  if (error) throw error;
}
export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function listYears(schoolId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("academic_years").select("id, name").eq("school_id", schoolId).order("name", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((y: any) => ({ id: y.id, name: y.name }));
}
export async function listTerms(academicYearId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("terms").select("id, name, sequence").eq("academic_year_id", academicYearId).order("sequence");
  if (error) throw error;
  return (data ?? []).map((t: any) => ({ id: t.id, name: t.name }));
}
export async function listClassesInYear(academicYearId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("classes").select("id, name").eq("academic_year_id", academicYearId).order("name");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}
export async function listClasses(schoolId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}

export async function listUnlocks(eventId: string): Promise<UnlockRow[]> {
  const { data, error } = await supabase
    .from("event_unlocks")
    .select("id, class_subject_id, class_id, cs:class_subjects(subject:subjects(name), class:classes(name)), cls:classes(name)")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.class_subject_id
    ? { id: r.id, kind: "subject", label: `${r.cs?.class?.name ?? "Class"} — ${r.cs?.subject?.name ?? "Subject"}` }
    : { id: r.id, kind: "class", label: `Homeroom: ${r.cls?.name ?? "Class"}` });
}
export async function reopenSubject(eventId: string, classSubjectId: string) {
  const { error } = await supabase.from("event_unlocks").insert({ event_id: eventId, class_subject_id: classSubjectId });
  if (error) throw error;
}
export async function reopenClass(eventId: string, classId: string) {
  const { error } = await supabase.from("event_unlocks").insert({ event_id: eventId, class_id: classId });
  if (error) throw error;
}
export async function relock(unlockId: string) {
  const { error } = await supabase.from("event_unlocks").delete().eq("id", unlockId);
  if (error) throw error;
}

export type EntryRow = { className: string; subjectName: string; teacherName: string; entered: boolean };
// Which class-subjects have marks entered under this event, and which don't.
export async function listEntryProgress(eventId: string, academicYearId: string | null, schoolId: string): Promise<EntryRow[]> {
  const { data: cs } = await supabase.from("class_subjects")
    .select("id, class:classes!inner(name, academic_year_id, school_id), subject:subjects(name), teacher:profiles(full_name)")
    .is("archived_at", null);
  const rows = (cs ?? []).filter((r: any) => r.class?.school_id === schoolId && (!academicYearId || r.class?.academic_year_id === academicYearId));
  const { data: asmts } = await supabase.from("assessments").select("id, class_subject_id").eq("event_id", eventId);
  const byId = new Map((asmts ?? []).map((a: any) => [a.id, a.class_subject_id]));
  const entered = new Set<string>();
  const ids = (asmts ?? []).map((a: any) => a.id);
  if (ids.length) {
    const { data: res } = await supabase.from("results").select("assessment_id").in("assessment_id", ids);
    (res ?? []).forEach((r: any) => { const c = byId.get(r.assessment_id); if (c) entered.add(c); });
  }
  return rows.map((r: any) => ({
    className: r.class?.name ?? "—", subjectName: r.subject?.name ?? "—",
    teacherName: r.teacher?.full_name ?? "—", entered: entered.has(r.id),
  })).sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));
}
