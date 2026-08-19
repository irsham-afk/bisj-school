import { supabase } from "./supabase";

// The grade ladder. Each grade promotes to the next; A-2 graduates (no next).
export const LADDER = ["NUR", "LKG", "UKG", "G-1", "G-2", "G-3", "G-4", "G-5", "G-6", "G-7", "O-1", "O-2", "O-3", "AS", "A-2"];
export function gradeRank(name: string): number { const i = LADDER.indexOf(name); return i === -1 ? 999 : i; }
export function nextGrade(name: string): string | null {
  const i = LADDER.indexOf(name);
  if (i === -1 || i === LADDER.length - 1) return null;
  return LADDER[i + 1];
}

export type PromoStudent = { studentId: string; enrollmentId: string; name: string; admissionNo: string | null };
export type PromoClass = { classId: string; grade: string; nextGrade: string | null; graduates: boolean; students: PromoStudent[] };
export type PromoResult = { promoted: number; repeated: number; graduated: number };

// All classes (fixed) and their current active students, grouped and ordered by grade.
export async function loadPromotion(schoolId: string): Promise<PromoClass[]> {
  const { data: classes } = await supabase.from("classes").select("id, name").eq("school_id", schoolId);
  const out: PromoClass[] = [];
  for (const c of (classes ?? []) as any[]) {
    const { data: enrs } = await supabase.from("enrollments")
      .select("id, student:students(id, first_name, last_name, admission_no)")
      .eq("class_id", c.id).eq("status", "active");
    const students: PromoStudent[] = (enrs ?? []).map((e: any) => ({
      studentId: e.student.id, enrollmentId: e.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      admissionNo: e.student.admission_no,
    })).sort((a, b) => (a.admissionNo ?? "").localeCompare(b.admissionNo ?? "") || a.name.localeCompare(b.name));
    out.push({ classId: c.id, grade: c.name, nextGrade: nextGrade(c.name), graduates: nextGrade(c.name) === null, students });
  }
  return out.sort((a, b) => LADDER.indexOf(a.grade) - LADDER.indexOf(b.grade));
}

// Move students up one grade, in place, between the fixed classes.
// heldBack = student IDs who stay in their current grade. A-2 (not held) graduate.
export async function runPromotion(schoolId: string, heldBack: Set<string>): Promise<PromoResult> {
  const source = await loadPromotion(schoolId); // snapshot BEFORE any moves — each student processed once, by original grade
  const byGrade: Record<string, string> = {};
  source.forEach((c) => (byGrade[c.grade] = c.classId));
  const res: PromoResult = { promoted: 0, repeated: 0, graduated: 0 };

  for (const cls of source) {
    for (const s of cls.students) {
      const hold = heldBack.has(s.studentId);
      if (hold) { res.repeated++; continue; }                 // stays in place — nothing to change
      if (cls.graduates) {                                     // A-2 → graduate out
        await supabase.from("students").update({ status: "graduated" }).eq("id", s.studentId);
        await supabase.from("enrollments").update({ status: "completed" }).eq("id", s.enrollmentId);
        res.graduated++;
        continue;
      }
      const targetClassId = byGrade[cls.nextGrade!];
      if (!targetClassId) continue;
      // move this student's enrolment into the next grade's fixed class
      await supabase.from("enrollments").update({ class_id: targetClassId }).eq("id", s.enrollmentId);
      // reset their subjects to whatever the new class offers
      await supabase.from("enrollment_subjects").delete().eq("enrollment_id", s.enrollmentId);
      const { data: cs } = await supabase.from("class_subjects").select("id").eq("class_id", targetClassId).is("archived_at", null);
      if (cs && cs.length) {
        await supabase.from("enrollment_subjects").insert(cs.map((r: any) => ({ enrollment_id: s.enrollmentId, class_subject_id: r.id })));
      }
      res.promoted++;
    }
  }
  return res;
}
