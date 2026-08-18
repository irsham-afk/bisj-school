import { supabase } from "./supabase";

export type ClassInfo = {
  id: string; name: string; gradeName: string; yearName: string;
  homeroomId: string | null; schoolId: string; academicYearId: string;
};
export type CsRow = { id: string; subjectId: string; subjectName: string; teacherId: string | null; teacherName: string };
export type EnrolledStudent = { enrollmentId: string; studentId: string; name: string; roll: string | null };
export type Pick = { id: string; name: string };

export async function getClassInfo(classId: string): Promise<ClassInfo> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, school_id, academic_year_id, homeroom_teacher_id, grade:grade_levels(name), year:academic_years(name)")
    .eq("id", classId).single();
  if (error) throw error;
  const d: any = data;
  return {
    id: d.id, name: d.name, gradeName: d.grade?.name ?? "—", yearName: d.year?.name ?? "—",
    homeroomId: d.homeroom_teacher_id, schoolId: d.school_id, academicYearId: d.academic_year_id,
  };
}

export async function listTeachers(schoolId: string): Promise<Pick[]> {
  const { data, error } = await supabase
    .from("profiles").select("id, full_name")
    .eq("school_id", schoolId).in("role", ["teacher", "admin"]).eq("is_active", true).order("full_name");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.full_name }));
}

export async function listSubjects(schoolId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({ id: s.id, name: s.name }));
}

export async function listClassSubjects(classId: string): Promise<CsRow[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, subject_id, teacher_id, subject:subjects(name), teacher:profiles(full_name)")
    .eq("class_id", classId).is("archived_at", null);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({
      id: r.id, subjectId: r.subject_id, subjectName: r.subject?.name ?? "—",
      teacherId: r.teacher_id, teacherName: r.teacher?.full_name ?? "Unassigned",
    }))
    .sort((a: CsRow, b: CsRow) => a.subjectName.localeCompare(b.subjectName));
}

export async function addClassSubject(classId: string, subjectId: string, teacherId: string) {
  const { error } = await supabase.from("class_subjects").insert({ class_id: classId, subject_id: subjectId, teacher_id: teacherId || null });
  if (error) throw error;
}
export async function setClassSubjectTeacher(csId: string, teacherId: string) {
  const { error } = await supabase.from("class_subjects").update({ teacher_id: teacherId || null }).eq("id", csId);
  if (error) throw error;
}
export async function removeClassSubject(csId: string) {
  const { error } = await supabase.from("class_subjects").update({ archived_at: new Date().toISOString() }).eq("id", csId);
  if (error) throw error;
}
export async function setHomeroom(classId: string, teacherId: string) {
  const { error } = await supabase.from("classes").update({ homeroom_teacher_id: teacherId || null }).eq("id", classId);
  if (error) throw error;
}

export async function listEnrolled(classId: string): Promise<EnrolledStudent[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student:students(id, first_name, last_name, admission_no)")
    .eq("class_id", classId).eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .map((e: any) => ({
      enrollmentId: e.id, studentId: e.student.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(), roll: e.student.admission_no,
    }))
    .sort((a: EnrolledStudent, b: EnrolledStudent) => (a.roll ?? "").localeCompare(b.roll ?? ""));
}

// active students not already in this class (candidates to enrol)
export async function listEnrollableStudents(schoolId: string, classId: string): Promise<Pick[]> {
  const { data: enrolled } = await supabase.from("enrollments").select("student_id").eq("class_id", classId).eq("status", "active");
  const taken = new Set((enrolled ?? []).map((e: any) => e.student_id));
  const { data, error } = await supabase
    .from("students").select("id, first_name, last_name, admission_no")
    .eq("school_id", schoolId).eq("status", "active").is("archived_at", null).order("admission_no");
  if (error) throw error;
  return (data ?? [])
    .filter((s: any) => !taken.has(s.id))
    .map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}${s.admission_no ? ` (${s.admission_no})` : ""}` }));
}
export async function enrolStudent(studentId: string, classId: string): Promise<{ id: string }> {
  const { data, error } = await supabase.from("enrollments").insert({ student_id: studentId, class_id: classId }).select("id").single();
  if (error) throw error;
  return data as { id: string };
}
export async function unenrolStudent(enrollmentId: string) {
  const { error } = await supabase.from("enrollments").update({ status: "withdrawn" }).eq("id", enrollmentId);
  if (error) throw error;
}

// ---- which subjects a student actually takes (enrolment_subjects) ----
export async function listEnrollmentSubjects(enrollmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("enrollment_subjects").select("class_subject_id").eq("enrollment_id", enrollmentId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.class_subject_id);
}

// Replace a student's subject set with `selected` (diffed, so only changes are written).
export async function setEnrollmentSubjects(enrollmentId: string, selected: string[]) {
  const current = await listEnrollmentSubjects(enrollmentId);
  const toAdd = selected.filter((x) => !current.includes(x));
  const toRemove = current.filter((x) => !selected.includes(x));
  if (toAdd.length) {
    const { error } = await supabase.from("enrollment_subjects")
      .insert(toAdd.map((csId) => ({ enrollment_id: enrollmentId, class_subject_id: csId })));
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase.from("enrollment_subjects")
      .delete().eq("enrollment_id", enrollmentId).in("class_subject_id", toRemove);
    if (error) throw error;
  }
}

// ---- per-teacher views ----
export type TeacherAssignment = { csId: string; classId: string; className: string; subjectName: string };

export async function listTeacherAssignments(teacherId: string): Promise<TeacherAssignment[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class:classes(id, name), subject:subjects(name)")
    .eq("teacher_id", teacherId).is("archived_at", null);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({ csId: r.id, classId: r.class?.id ?? "", className: r.class?.name ?? "—", subjectName: r.subject?.name ?? "—" }))
    .sort((a: TeacherAssignment, b: TeacherAssignment) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));
}

export async function listHomeroomClasses(teacherId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("classes").select("id, name").eq("homeroom_teacher_id", teacherId);
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}

export async function listClassesForSchool(schoolId: string): Promise<Pick[]> {
  const { data, error } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
}

export async function getProfileName(id: string): Promise<{ name: string; role: string }> {
  const { data, error } = await supabase.from("profiles").select("full_name, role").eq("id", id).single();
  if (error) throw error;
  return { name: (data as any)?.full_name ?? "—", role: (data as any)?.role ?? "" };
}

// ---- per-subject views ----
export type SubjectClass = { csId: string; classId: string; className: string; teacherId: string | null; teacherName: string };

export async function getSubjectInfo(id: string): Promise<{ name: string; isElective: boolean; schoolId: string }> {
  const { data, error } = await supabase.from("subjects").select("name, is_elective, school_id").eq("id", id).single();
  if (error) throw error;
  return { name: (data as any).name, isElective: !!(data as any).is_elective, schoolId: (data as any).school_id };
}

export async function listSubjectClasses(subjectId: string): Promise<SubjectClass[]> {
  const { data, error } = await supabase
    .from("class_subjects")
    .select("id, class:classes(id, name), teacher_id, teacher:profiles(full_name)")
    .eq("subject_id", subjectId).is("archived_at", null);
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => ({ csId: r.id, classId: r.class?.id ?? "", className: r.class?.name ?? "—", teacherId: r.teacher_id, teacherName: r.teacher?.full_name ?? "Unassigned" }))
    .sort((a: SubjectClass, b: SubjectClass) => a.className.localeCompare(b.className));
}

export async function listClassesWithoutSubject(schoolId: string, subjectId: string): Promise<Pick[]> {
  const [{ data: allC }, { data: has }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
    supabase.from("class_subjects").select("class_id").eq("subject_id", subjectId).is("archived_at", null),
  ]);
  const taken = new Set((has ?? []).map((r: any) => r.class_id));
  return (allC ?? []).filter((c: any) => !taken.has(c.id)).map((c: any) => ({ id: c.id, name: c.name }));
}

export async function renameSubject(id: string, name: string) {
  const { error } = await supabase.from("subjects").update({ name }).eq("id", id);
  if (error) throw error;
}

// Which enrolments currently take a given class-subject.
export async function listCsRoster(csId: string): Promise<string[]> {
  const { data, error } = await supabase.from("enrollment_subjects").select("enrollment_id").eq("class_subject_id", csId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.enrollment_id);
}

// Replace the set of students taking a class-subject (used by the per-subject editor).
export async function setCsRoster(csId: string, enrollmentIds: string[]): Promise<void> {
  const { data: cur, error: e1 } = await supabase.from("enrollment_subjects").select("enrollment_id").eq("class_subject_id", csId);
  if (e1) throw e1;
  const current = new Set((cur ?? []).map((r: any) => r.enrollment_id));
  const target = new Set(enrollmentIds);
  const toAdd = enrollmentIds.filter((e) => !current.has(e));
  const toRemove = [...current].filter((e) => !target.has(e));
  if (toRemove.length) {
    const { error } = await supabase.from("enrollment_subjects").delete().eq("class_subject_id", csId).in("enrollment_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase.from("enrollment_subjects").insert(toAdd.map((e) => ({ enrollment_id: e, class_subject_id: csId })));
    if (error) throw error;
  }
}

// Delete a subject entirely (removes it from every class and any stored report items).
export async function deleteSubject(id: string): Promise<void> {
  await supabase.from("report_card_items").delete().eq("subject_id", id);
  await supabase.from("class_subjects").delete().eq("subject_id", id); // cascades enrolment-subjects, assessments, results
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw error;
}
