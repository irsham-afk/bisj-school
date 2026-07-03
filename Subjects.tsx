import { supabase } from "./supabase";

export type PtmEvent = { id: string; name: string; deadline: string | null; open: boolean };
export type Rating = "A" | "B" | "C" | "D" | "";
export const PTM_FIELDS = [
  "foundation", "motivation", "preparation",
  "punctuality", "discipline", "attention",
  "homework", "classwork", "test_score",
] as const;
export type PtmField = (typeof PTM_FIELDS)[number];
export const PTM_LABELS: Record<PtmField, string> = {
  foundation: "Subject foundation", motivation: "Motivation", preparation: "Class preparation",
  punctuality: "Punctuality", discipline: "Discipline", attention: "Attention",
  homework: "Homework", classwork: "Class work", test_score: "Test score",
};
export const PTM_GROUPS: { label: string; fields: PtmField[] }[] = [
  { label: "Ability", fields: ["foundation", "motivation", "preparation"] },
  { label: "Attitude", fields: ["punctuality", "discipline", "attention"] },
  { label: "Performance", fields: ["homework", "classwork", "test_score"] },
];

export type SubjectEntry = Record<PtmField, Rating> & { remark: string };
export type ClassEntry = { tardy: number | null; absent: number | null; overall_remark: string };

function isOpen(deadline: string | null) { return !deadline || new Date(deadline).getTime() > Date.now(); }

export async function listPtmEvents(schoolId: string): Promise<PtmEvent[]> {
  const { data, error } = await supabase.from("events")
    .select("id, name, deadline").eq("school_id", schoolId).eq("kind", "ptm")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({ id: e.id, name: e.name, deadline: e.deadline, open: isOpen(e.deadline) }));
}

const BLANK: SubjectEntry = { foundation: "", motivation: "", preparation: "", punctuality: "", discipline: "", attention: "", homework: "", classwork: "", test_score: "", remark: "" };

export async function listPtmSubject(eventId: string, classSubjectId: string): Promise<Record<string, SubjectEntry>> {
  const { data, error } = await supabase.from("ptm_subject")
    .select("student_id, foundation, motivation, preparation, punctuality, discipline, attention, homework, classwork, test_score, remark")
    .eq("event_id", eventId).eq("class_subject_id", classSubjectId);
  if (error) throw error;
  const out: Record<string, SubjectEntry> = {};
  for (const r of (data ?? []) as any[]) {
    out[r.student_id] = {
      foundation: r.foundation ?? "", motivation: r.motivation ?? "", preparation: r.preparation ?? "",
      punctuality: r.punctuality ?? "", discipline: r.discipline ?? "", attention: r.attention ?? "",
      homework: r.homework ?? "", classwork: r.classwork ?? "", test_score: r.test_score ?? "", remark: r.remark ?? "",
    };
  }
  return out;
}

export async function savePtmSubject(eventId: string, classSubjectId: string, recordedBy: string, rows: { studentId: string; entry: SubjectEntry }[]) {
  const payload = rows.map(({ studentId, entry }) => {
    const row: any = { event_id: eventId, class_subject_id: classSubjectId, student_id: studentId, recorded_by: recordedBy, remark: entry.remark || null, updated_at: new Date().toISOString() };
    for (const f of PTM_FIELDS) row[f] = entry[f] || null;
    return row;
  });
  const { error } = await supabase.from("ptm_subject").upsert(payload, { onConflict: "event_id,student_id,class_subject_id" });
  if (error) throw error;
}

export function blankSubjectEntry(): SubjectEntry { return { ...BLANK }; }

export async function listPtmClass(eventId: string, classId: string): Promise<Record<string, ClassEntry>> {
  const { data, error } = await supabase.from("ptm_class")
    .select("student_id, tardy, absent, overall_remark").eq("event_id", eventId).eq("class_id", classId);
  if (error) throw error;
  const out: Record<string, ClassEntry> = {};
  for (const r of (data ?? []) as any[]) out[r.student_id] = { tardy: r.tardy, absent: r.absent, overall_remark: r.overall_remark ?? "" };
  return out;
}

export async function savePtmClass(eventId: string, classId: string, recordedBy: string, rows: { studentId: string; entry: ClassEntry }[]) {
  const payload = rows.map(({ studentId, entry }) => ({
    event_id: eventId, class_id: classId, student_id: studentId, recorded_by: recordedBy,
    tardy: entry.tardy, absent: entry.absent, overall_remark: entry.overall_remark || null, updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("ptm_class").upsert(payload, { onConflict: "event_id,student_id" });
  if (error) throw error;
}
