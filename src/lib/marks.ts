import { supabase } from "./supabase";

// ---- types ----
export type Assignment = {
  classSubjectId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
};
export type Term = { id: string; name: string; sequence: number };
export type MarkStudent = { id: string; name: string; admissionNo: string | null; enrollmentId: string };
export type ResultStatus = "graded" | "absent" | "exempt";
export type ResultRow = { score: number | null; status: ResultStatus };
export type GradeBand = { min: number; max: number; grade: string; isPass: boolean };

// The class-subjects this teacher is assigned to (RLS also enforces this server-side).
export async function listAssignments(teacherId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class_id, subject_id, class:classes(name, academic_year_id), subject:subjects(name)")
    .is("archived_at", null)
    .eq("teacher_id", teacherId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    classSubjectId: r.id,
    classId: r.class_id,
    className: r.class?.name ?? "Class",
    subjectId: r.subject_id,
    subjectName: r.subject?.name ?? "Subject",
    academicYearId: r.class?.academic_year_id,
  })).sort((a, b) => a.className.localeCompare(b.className));
}

// Terms (exams) for the class's academic year.
export async function listTerms(academicYearId: string): Promise<Term[]> {
  const { data, error } = await supabase
    .from("terms")
    .select("id, name, sequence")
    .eq("academic_year_id", academicYearId)
    .order("sequence");
  if (error) throw error;
  return (data ?? []) as Term[];
}

// Look up the exam's assessment without creating it (used when just viewing).
export async function findAssessment(
  classSubjectId: string, termId: string, name: string,
): Promise<{ id: string; maxScore: number } | null> {
  const { data, error } = await supabase
    .from("assessments")
    .select("id, max_score, name")
    .eq("class_subject_id", classSubjectId)
    .eq("term_id", termId);
  if (error) throw error;
  const hit = (data ?? []).find((a: any) => a.name === name) ?? (data ?? [])[0];
  return hit ? { id: hit.id, maxScore: Number(hit.max_score) } : null;
}

// Find the exam's assessment for this class-subject + term, creating it if missing.
export async function getOrCreateAssessment(
  classSubjectId: string, termId: string, name: string, maxScore: number, createdBy: string,
): Promise<{ id: string; maxScore: number }> {
  const { data: found, error } = await supabase
    .from("assessments")
    .select("id, max_score, name")
    .eq("class_subject_id", classSubjectId)
    .eq("term_id", termId);
  if (error) throw error;
  const hit = (found ?? []).find((a: any) => a.name === name) ?? (found ?? [])[0];
  if (hit) return { id: hit.id, maxScore: Number(hit.max_score) };

  const { data: created, error: insErr } = await supabase
    .from("assessments")
    .insert({ class_subject_id: classSubjectId, term_id: termId, name, max_score: maxScore, created_by: createdBy })
    .select("id, max_score")
    .single();
  if (insErr) throw insErr;
  return { id: created!.id, maxScore: Number(created!.max_score) };
}

// Students enrolled in the class who actually take this subject (enrolment_subjects).
export async function listStudentsForSubject(classId: string, classSubjectId: string): Promise<MarkStudent[]> {
  const { data, error } = await supabase
    .from("enrollment_subjects")
    .select("enrollment:enrollments!inner(id, class_id, status, student:students(id, first_name, last_name, admission_no))")
    .eq("class_subject_id", classSubjectId);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.enrollment)
    .filter((e: any) => e && e.class_id === classId && e.status === "active")
    .map((e: any) => ({
      id: e.student.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      admissionNo: e.student.admission_no,
      enrollmentId: e.id,
    }))
    .sort((a: MarkStudent, b: MarkStudent) => (a.admissionNo ?? "").localeCompare(b.admissionNo ?? ""));
}

// Existing marks for the assessment, keyed by student id.
export async function listResults(assessmentId: string): Promise<Record<string, ResultRow>> {
  const { data, error } = await supabase
    .from("results")
    .select("student_id, score, status")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  const out: Record<string, ResultRow> = {};
  (data ?? []).forEach((r: any) => {
    out[r.student_id] = { score: r.score === null ? null : Number(r.score), status: (r.status ?? "graded") as ResultStatus };
  });
  return out;
}

// Save (upsert) the grid. Absent/exempt rows carry no score.
export async function saveResults(
  assessmentId: string, recordedBy: string,
  rows: { studentId: string; score: number | null; status: ResultStatus }[],
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    assessment_id: assessmentId,
    student_id: r.studentId,
    score: r.status === "graded" ? r.score : null,
    status: r.status,
    recorded_by: recordedBy,
  }));
  const { error } = await supabase.from("results").upsert(payload, { onConflict: "assessment_id,student_id" });
  if (error) throw error;
}

// School grade scale (for the live grade pill). Optional — empty if none set.
export async function listGradeBands(schoolId: string): Promise<GradeBand[]> {
  const { data, error } = await supabase
    .from("grading_scales")
    .select("min_score, max_score, grade, is_pass")
    .eq("school_id", schoolId)
    .order("min_score", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    min: Number(b.min_score), max: Number(b.max_score), grade: b.grade, isPass: b.is_pass,
  }));
}
export function gradeFor(pct: number, bands: GradeBand[]): string | null {
  const b = bands.find((x) => pct >= x.min && pct <= x.max);
  return b ? b.grade : null;
}

// ---- exam events ----
export type ExamEvent = { id: string; name: string; termId: string | null; deadline: string | null };

export async function listExamEvents(schoolId: string): Promise<ExamEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, term_id, deadline, created_at")
    .eq("school_id", schoolId).eq("kind", "exam")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({ id: e.id, name: e.name, termId: e.term_id, deadline: e.deadline }));
}

export async function examOpenForSubject(eventId: string, classSubjectId: string, deadline: string | null): Promise<boolean> {
  if (!deadline || new Date(deadline) > new Date()) return true;
  const { data, error } = await supabase
    .from("event_unlocks").select("id").eq("event_id", eventId).eq("class_subject_id", classSubjectId).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function findEventAssessment(classSubjectId: string, eventId: string): Promise<{ id: string; maxScore: number } | null> {
  const { data, error } = await supabase
    .from("assessments").select("id, max_score").eq("class_subject_id", classSubjectId).eq("event_id", eventId);
  if (error) throw error;
  return data && data.length ? { id: data[0].id, maxScore: Number(data[0].max_score) } : null;
}

export async function getOrCreateEventAssessment(
  classSubjectId: string, ev: { id: string; name: string; termId: string | null }, createdBy: string,
): Promise<{ id: string; maxScore: number }> {
  if (!ev.termId) throw new Error("This exam event has no term set — ask an admin to set the term on the event.");
  const existing = await findEventAssessment(classSubjectId, ev.id);
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from("assessments")
    .insert({ class_subject_id: classSubjectId, event_id: ev.id, term_id: ev.termId, name: ev.name, created_by: createdBy })
    .select("id, max_score").single();
  if (error) throw error;
  return { id: created!.id, maxScore: Number(created!.max_score) };
}

// For a given event, how many marks are entered vs total students, per class-subject the teacher has.
export async function listEntryStatusForEvent(
  eventId: string, classSubjectIds: string[],
): Promise<Record<string, { entered: number; total: number }>> {
  const out: Record<string, { entered: number; total: number }> = {};
  if (classSubjectIds.length === 0) return out;
  classSubjectIds.forEach((id) => (out[id] = { entered: 0, total: 0 }));

  // totals: active enrolments taking each subject
  const { data: es } = await supabase
    .from("enrollment_subjects")
    .select("class_subject_id, enrollment:enrollments!inner(status)")
    .in("class_subject_id", classSubjectIds);
  (es ?? []).forEach((r: any) => {
    if (r.enrollment?.status === "active" && out[r.class_subject_id]) out[r.class_subject_id].total++;
  });

  // entered: results recorded under this event
  const { data: asmts } = await supabase
    .from("assessments").select("id, class_subject_id").eq("event_id", eventId).in("class_subject_id", classSubjectIds);
  const byAsmt = new Map((asmts ?? []).map((a: any) => [a.id, a.class_subject_id]));
  const ids = (asmts ?? []).map((a: any) => a.id);
  if (ids.length) {
    const { data: res } = await supabase.from("results").select("assessment_id").in("assessment_id", ids);
    (res ?? []).forEach((r: any) => { const cs = byAsmt.get(r.assessment_id); if (cs && out[cs]) out[cs].entered++; });
  }
  return out;
}


// Teacher roster fixes on the marks screen (their own subjects only; enforced by RLS).
export async function removeStudentFromSubject(enrollmentId: string, classSubjectId: string): Promise<void> {
  const { error } = await supabase.from("enrollment_subjects").delete()
    .eq("enrollment_id", enrollmentId).eq("class_subject_id", classSubjectId);
  if (error) throw error;
}

export async function addStudentToSubject(enrollmentId: string, classSubjectId: string): Promise<void> {
  const { error } = await supabase.from("enrollment_subjects")
    .insert({ enrollment_id: enrollmentId, class_subject_id: classSubjectId });
  if (error) throw error;
}

// Active students in the class who are NOT currently taking this subject.
export async function listAddableStudents(classId: string, classSubjectId: string): Promise<MarkStudent[]> {
  const [{ data: enrs }, { data: taken }] = await Promise.all([
    supabase.from("enrollments").select("id, status, student:students(id, first_name, last_name, admission_no)").eq("class_id", classId).eq("status", "active"),
    supabase.from("enrollment_subjects").select("enrollment_id").eq("class_subject_id", classSubjectId),
  ]);
  const has = new Set((taken ?? []).map((t: any) => t.enrollment_id));
  return (enrs ?? [])
    .filter((e: any) => e.student && !has.has(e.id))
    .map((e: any) => ({
      id: e.student.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      admissionNo: e.student.admission_no,
      enrollmentId: e.id,
    }))
    .sort((a: MarkStudent, b: MarkStudent) => (a.admissionNo ?? "").localeCompare(b.admissionNo ?? ""));
}
