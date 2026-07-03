import { supabase } from "./supabase";
export { listTerms } from "./marks";

export type HomeroomClass = { id: string; name: string; academicYearId: string };
export type ClassStudent = { id: string; name: string; admissionNo: string | null };
export type Meta = {
  present: number | null; tardy: number | null; absent: number | null;
  remark: string; schoolDays: number | null;
};

// Classes where the user is the homeroom (class) teacher. Admins see all.
export async function listHomeroomClasses(uid: string, role: string): Promise<HomeroomClass[]> {
  let q = supabase.from("classes").select("id, name, academic_year_id");
  if (role !== "admin") q = q.eq("homeroom_teacher_id", uid);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.name, academicYearId: c.academic_year_id }));
}

export async function listClassStudents(classId: string): Promise<ClassStudent[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("status, student:students(id, first_name, last_name, admission_no)")
    .eq("class_id", classId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .map((e: any) => ({
      id: e.student.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      admissionNo: e.student.admission_no,
    }))
    .sort((a: ClassStudent, b: ClassStudent) => (a.admissionNo ?? "").localeCompare(b.admissionNo ?? ""));
}

// Existing attendance summary + remark per student for this term.
export async function loadReportMeta(termId: string, studentIds: string[]): Promise<Record<string, Meta>> {
  if (studentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("report_cards")
    .select("student_id, days_present, days_tardy, days_absent, days_total, homeroom_comment")
    .eq("term_id", termId)
    .in("student_id", studentIds);
  if (error) throw error;
  const out: Record<string, Meta> = {};
  (data ?? []).forEach((r: any) => {
    out[r.student_id] = {
      present: r.days_present, tardy: r.days_tardy, absent: r.days_absent,
      schoolDays: r.days_total, remark: r.homeroom_comment ?? "",
    };
  });
  return out;
}

// Upsert the class teacher's attendance counts + remark for the term.
export async function saveReportMeta(
  termId: string, schoolDays: number | null, classTeacherName: string,
  rows: { studentId: string; present: number | null; tardy: number | null; absent: number | null; remark: string }[],
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    student_id: r.studentId,
    term_id: termId,
    days_present: r.present,
    days_tardy: r.tardy,
    days_absent: r.absent,
    days_total: schoolDays,
    homeroom_comment: r.remark || null,
    class_teacher_name: classTeacherName || null,
  }));
  const { error } = await supabase.from("report_cards").upsert(payload, { onConflict: "student_id,term_id" });
  if (error) throw error;
}
