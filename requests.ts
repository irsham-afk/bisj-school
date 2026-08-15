import { supabase } from "./supabase";

export type MyRequest = {
  id: string; className: string; subjectName: string;
  status: "pending" | "approved" | "denied"; note: string | null; createdAt: string;
};
export type PendingRequest = MyRequest & { teacherId: string; teacherName: string; classSubjectId: string };

export async function createRequest(classSubjectId: string, teacherId: string, schoolId: string, note: string) {
  const { error } = await supabase.from("subject_access_requests")
    .insert({ class_subject_id: classSubjectId, teacher_id: teacherId, school_id: schoolId, note: note || null });
  if (error) throw error;
}

const SELECT = "id, status, note, created_at, teacher_id, class_subject_id, cs:class_subjects(class:classes(name), subject:subjects(name)), teacher:profiles!subject_access_requests_teacher_id_fkey(full_name)";

export async function listMyRequests(teacherId: string): Promise<MyRequest[]> {
  const { data, error } = await supabase.from("subject_access_requests")
    .select(SELECT).eq("teacher_id", teacherId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function listPendingRequests(schoolId: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase.from("subject_access_requests")
    .select(SELECT).eq("school_id", schoolId).eq("status", "pending").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...map(r), teacherId: r.teacher_id, teacherName: r.teacher?.full_name ?? "—", classSubjectId: r.class_subject_id }));
}

function map(r: any): MyRequest {
  return { id: r.id, className: r.cs?.class?.name ?? "—", subjectName: r.cs?.subject?.name ?? "—", status: r.status, note: r.note, createdAt: r.created_at };
}

export async function decideRequest(req: PendingRequest, approve: boolean, adminId: string) {
  if (approve) {
    const { error: e1 } = await supabase.from("class_subjects").update({ teacher_id: req.teacherId }).eq("id", req.classSubjectId);
    if (e1) throw e1;
  }
  const { error } = await supabase.from("subject_access_requests")
    .update({ status: approve ? "approved" : "denied", decided_by: adminId, decided_at: new Date().toISOString() })
    .eq("id", req.id);
  if (error) throw error;
}
