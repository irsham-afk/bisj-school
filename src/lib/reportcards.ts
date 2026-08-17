import { supabase } from "./supabase";
import { listGradeBands, type GradeBand } from "./marks";

export type SubjectMark = { subject: string; score: number | null; status: "graded" | "absent" | "exempt"; max: number };
export type StudentReport = {
  roll: string | null; name: string;
  subjects: SubjectMark[];
  present: number | null; tardy: number | null; absent: number | null; schoolDays: number | null;
  remark: string;
};
export type ClassReportData = {
  schoolName: string; className: string; termName: string; classTeacherName: string;
  bands: GradeBand[]; students: StudentReport[];
};

export async function loadClassReports(classId: string, termId: string, eventId?: string): Promise<ClassReportData> {
  // class + school + term
  const { data: cls, error: cErr } = await supabase
    .from("classes").select("name, school_id, homeroom_teacher_id").eq("id", classId).single();
  if (cErr) throw cErr;
  const { data: evLabels } = eventId
    ? await supabase.from("events").select("exam_label, year_label, name, school_days").eq("id", eventId).single()
    : { data: null as any };
  const [{ data: school }, { data: term }, bands] = await Promise.all([
    supabase.from("schools").select("name").eq("id", cls!.school_id).single(),
    supabase.from("terms").select("name").eq("id", termId).single(),
    listGradeBands(cls!.school_id),
  ]);

  // subjects offered in the class
  const { data: csRows, error: csErr } = await supabase
    .from("class_subjects").select("id, subject:subjects(name)").eq("class_id", classId).is("archived_at", null);
  if (csErr) throw csErr;
  const csIds = (csRows ?? []).map((r: any) => r.id);
  const subjectName: Record<string, string> = {};
  (csRows ?? []).forEach((r: any) => { subjectName[r.id] = r.subject?.name ?? "Subject"; });

  // the term's assessment per class-subject (one exam mark per subject)
  const { data: asmts } = csIds.length
    ? await (eventId
        ? supabase.from("assessments").select("id, class_subject_id, max_score").eq("event_id", eventId).in("class_subject_id", csIds)
        : supabase.from("assessments").select("id, class_subject_id, max_score").eq("term_id", termId).in("class_subject_id", csIds))
    : { data: [] as any[] };
  const asmtByCs: Record<string, { id: string; max: number }> = {};
  (asmts ?? []).forEach((a: any) => { if (!asmtByCs[a.class_subject_id]) asmtByCs[a.class_subject_id] = { id: a.id, max: Number(a.max_score) }; });
  const asmtIds = Object.values(asmtByCs).map((a) => a.id);

  // results for those assessments
  const { data: results } = asmtIds.length
    ? await supabase.from("results").select("assessment_id, student_id, score, status").in("assessment_id", asmtIds)
    : { data: [] as any[] };
  const resByAsmtStu: Record<string, { score: number | null; status: string }> = {};
  (results ?? []).forEach((r: any) => { resByAsmtStu[`${r.assessment_id}:${r.student_id}`] = { score: r.score === null ? null : Number(r.score), status: r.status ?? "graded" }; });

  // enrolled students + which subjects each takes
  const { data: enrs, error: eErr } = await supabase
    .from("enrollments")
    .select("id, student:students(id, first_name, last_name, admission_no), status")
    .eq("class_id", classId).eq("status", "active");
  if (eErr) throw eErr;
  const enrIds = (enrs ?? []).map((e: any) => e.id);
  const { data: esRows } = enrIds.length
    ? await supabase.from("enrollment_subjects").select("enrollment_id, class_subject_id").in("enrollment_id", enrIds)
    : { data: [] as any[] };
  const takesByEnr: Record<string, string[]> = {};
  (esRows ?? []).forEach((r: any) => { (takesByEnr[r.enrollment_id] ??= []).push(r.class_subject_id); });

  // attendance + remark per student
  const stuIds = (enrs ?? []).map((e: any) => e.student.id);
  const { data: rcs } = stuIds.length
    ? await (eventId
        ? supabase.from("report_cards").select("student_id, days_present, days_tardy, days_absent, days_total, homeroom_comment, class_teacher_name").eq("event_id", eventId).in("student_id", stuIds)
        : supabase.from("report_cards").select("student_id, days_present, days_tardy, days_absent, days_total, homeroom_comment, class_teacher_name").eq("term_id", termId).in("student_id", stuIds))
    : { data: [] as any[] };
  const rcByStu: Record<string, any> = {};
  (rcs ?? []).forEach((r: any) => { rcByStu[r.student_id] = r; });

  let classTeacherName = "";
  const students: StudentReport[] = (enrs ?? []).map((e: any) => {
    const sid = e.student.id;
    const takes = takesByEnr[e.id] ?? csIds; // if no explicit list, assume all offered
    const subjects: SubjectMark[] = takes
      .filter((csId: string) => asmtByCs[csId])
      .map((csId: string) => {
        const a = asmtByCs[csId];
        const res = resByAsmtStu[`${a.id}:${sid}`];
        return { subject: subjectName[csId], score: res ? res.score : null, status: (res?.status ?? "graded") as any, max: a.max };
      })
      .sort((x, y) => x.subject.localeCompare(y.subject));
    const rc = rcByStu[sid];
    if (rc?.class_teacher_name && !classTeacherName) classTeacherName = rc.class_teacher_name;
    return {
      roll: e.student.admission_no,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      subjects,
      present: rc?.days_present ?? null, tardy: rc?.days_tardy ?? null,
      absent: rc?.days_absent ?? null, schoolDays: (evLabels as any)?.school_days ?? rc?.days_total ?? null,
      remark: rc?.homeroom_comment ?? "",
    };
  }).sort((a, b) => (a.roll ?? "").localeCompare(b.roll ?? ""));

  return {
    schoolName: school?.name ?? "School",
    className: cls!.name,
    termName: evLabels ? (`${(evLabels as any).exam_label ?? ""} ${(evLabels as any).year_label ?? ""}`.trim() || (evLabels as any).name || (term?.name ?? "")) : (term?.name ?? ""),
    classTeacherName,
    bands, students,
  };
}
