import { supabase } from "./supabase";
import { PTM_FIELDS, type PtmField, type Rating } from "./ptm";

export type PtmReportSubject = { subjectName: string; ratings: Record<PtmField, Rating>; remark: string };
export type PtmReportStudent = {
  name: string; roll: string | null;
  tardy: number | null; absent: number | null; classRemark: string;
  subjects: PtmReportSubject[];
};
export type PtmReportData = {
  schoolName: string; className: string; yearLabel: string; ptmLabel: string;
  students: PtmReportStudent[];
};

export async function loadPtmReport(classId: string, eventId: string): Promise<PtmReportData> {
  const [{ data: school }, { data: cls }, { data: ev }] = await Promise.all([
    supabase.from("schools").select("name").limit(1).single(),
    supabase.from("classes").select("name").eq("id", classId).single(),
    supabase.from("events").select("name, year_label").eq("id", eventId).single(),
  ]);

  // active students in the class
  const { data: enrs } = await supabase
    .from("enrollments")
    .select("student:students(id, first_name, last_name, admission_no)")
    .eq("class_id", classId).eq("status", "active");
  const students = (enrs ?? [])
    .map((e: any) => e.student)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.admission_no ?? "").localeCompare(b.admission_no ?? "") || `${a.last_name}`.localeCompare(`${b.last_name}`));
  const stuIds = students.map((s: any) => s.id);

  // subjects of this class
  const { data: cs } = await supabase
    .from("class_subjects")
    .select("id, subject:subjects(name)")
    .eq("class_id", classId).is("archived_at", null);
  const csList = (cs ?? []).map((r: any) => ({ id: r.id, name: r.subject?.name ?? "—" }));
  const csIds = csList.map((c) => c.id);

  // class-teacher portion (tardy / absent / overall remark)
  const { data: pc } = stuIds.length
    ? await supabase.from("ptm_class").select("student_id, tardy, absent, overall_remark").eq("event_id", eventId).in("student_id", stuIds)
    : { data: [] as any[] };
  const classByStu = new Map((pc ?? []).map((r: any) => [r.student_id, r]));

  // subject-teacher portion (ratings + remark)
  const { data: ps } = csIds.length && stuIds.length
    ? await supabase.from("ptm_subject")
        .select("student_id, class_subject_id, foundation, motivation, preparation, punctuality, discipline, attention, homework, classwork, test_score, remark")
        .eq("event_id", eventId).in("class_subject_id", csIds).in("student_id", stuIds)
    : { data: [] as any[] };
  // key: student_id -> class_subject_id -> row
  const subjByStu = new Map<string, Map<string, any>>();
  (ps ?? []).forEach((r: any) => {
    if (!subjByStu.has(r.student_id)) subjByStu.set(r.student_id, new Map());
    subjByStu.get(r.student_id)!.set(r.class_subject_id, r);
  });

  const reportStudents: PtmReportStudent[] = students.map((s: any) => {
    const pcRow = classByStu.get(s.id);
    const subjMap = subjByStu.get(s.id);
    const subjects: PtmReportSubject[] = csList.map((c) => {
      const row = subjMap?.get(c.id);
      const ratings = {} as Record<PtmField, Rating>;
      for (const f of PTM_FIELDS) ratings[f] = (row?.[f] ?? "") as Rating;
      return { subjectName: c.name, ratings, remark: row?.remark ?? "" };
    });
    return {
      name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
      roll: s.admission_no,
      tardy: pcRow?.tardy ?? null,
      absent: pcRow?.absent ?? null,
      classRemark: pcRow?.overall_remark ?? "",
      subjects,
    };
  });

  return {
    schoolName: school?.name ?? "School",
    className: cls?.name ?? "",
    yearLabel: (ev as any)?.year_label ?? "",
    ptmLabel: (ev as any)?.name ?? "PTM",
    students: reportStudents,
  };
}
