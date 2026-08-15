import { supabase } from "./supabase";

// The grade ladder. Each grade promotes to the next; A-2 graduates (no next).
export const LADDER = ["NUR", "LKG", "UKG", "G-1", "G-2", "G-3", "G-4", "G-5", "G-6", "G-7", "O-1", "O-2", "O-3", "AS", "A-2"];
export function nextGrade(name: string): string | null {
  const i = LADDER.indexOf(name);
  if (i === -1 || i === LADDER.length - 1) return null; // unknown or A-2 → graduate
  return LADDER[i + 1];
}

export type YearRow = { id: string; name: string; isCurrent: boolean };
export type PromoStudent = { studentId: string; enrollmentId: string; name: string; admissionNo: string | null };
export type PromoClass = { classId: string; grade: string; nextGrade: string | null; graduates: boolean; students: PromoStudent[] };

export async function listYears(schoolId: string): Promise<YearRow[]> {
  const { data, error } = await supabase.from("academic_years").select("id, name, is_current").eq("school_id", schoolId).order("name");
  if (error) throw error;
  return (data ?? []).map((y: any) => ({ id: y.id, name: y.name, isCurrent: !!y.is_current }));
}

export async function createYear(schoolId: string, name: string): Promise<string> {
  const { data, error } = await supabase.from("academic_years").insert({ school_id: schoolId, name }).select("id").single();
  if (error) throw error;
  return (data as any).id;
}

// Group the source year's active students by class, with where each class promotes to.
export async function loadPromotion(schoolId: string, fromYearId: string): Promise<PromoClass[]> {
  const { data: classes } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).eq("academic_year_id", fromYearId);
  const out: PromoClass[] = [];
  for (const c of (classes ?? []) as any[]) {
    const { data: enrs } = await supabase.from("enrollments")
      .select("id, student:students(id, first_name, last_name, admission_no)")
      .eq("class_id", c.id).eq("status", "active");
    const students: PromoStudent[] = (enrs ?? []).map((e: any) => ({
      studentId: e.student.id, enrollmentId: e.id,
      name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(),
      admissionNo: e.student.admission_no,
    })).sort((a, b) => a.name.localeCompare(b.name));
    out.push({ classId: c.id, grade: c.name, nextGrade: nextGrade(c.name), graduates: nextGrade(c.name) === null, students });
  }
  return out.sort((a, b) => LADDER.indexOf(a.grade) - LADDER.indexOf(b.grade));
}

// Make sure the target year has every class the ladder needs, copying subjects/teachers/homeroom
// from the source year's same-named class. Returns a map gradeName -> target classId.
async function ensureYearStructure(schoolId: string, fromYearId: string, toYearId: string): Promise<Record<string, string>> {
  const { data: fromClasses } = await supabase.from("classes")
    .select("id, name, grade_level_id, homeroom_teacher_id").eq("school_id", schoolId).eq("academic_year_id", fromYearId);
  const { data: toClasses } = await supabase.from("classes").select("id, name").eq("school_id", schoolId).eq("academic_year_id", toYearId);
  const existing: Record<string, string> = {};
  (toClasses ?? []).forEach((c: any) => (existing[c.name] = c.id));

  const map: Record<string, string> = {};
  for (const fc of (fromClasses ?? []) as any[]) {
    let targetId = existing[fc.name];
    if (!targetId) {
      const { data: created, error } = await supabase.from("classes")
        .insert({ school_id: schoolId, academic_year_id: toYearId, grade_level_id: fc.grade_level_id, name: fc.name, homeroom_teacher_id: fc.homeroom_teacher_id })
        .select("id").single();
      if (error) throw error;
      targetId = (created as any).id;
      // copy class-subjects (subject + teacher) from the source class
      const { data: cs } = await supabase.from("class_subjects").select("subject_id, teacher_id").eq("class_id", fc.id).is("archived_at", null);
      if (cs && cs.length) {
        await supabase.from("class_subjects").insert(cs.map((r: any) => ({ class_id: targetId, subject_id: r.subject_id, teacher_id: r.teacher_id })));
      }
    }
    map[fc.name] = targetId;
  }
  return map;
}

export type PromoResult = { promoted: number; repeated: number; graduated: number };

// heldBack = student IDs to NOT advance (they repeat their current grade in the new year).
export async function runPromotion(schoolId: string, fromYearId: string, toYearId: string, heldBack: Set<string>): Promise<PromoResult> {
  const classMap = await ensureYearStructure(schoolId, fromYearId, toYearId);
  const source = await loadPromotion(schoolId, fromYearId);
  const res: PromoResult = { promoted: 0, repeated: 0, graduated: 0 };

  for (const cls of source) {
    for (const s of cls.students) {
      const hold = heldBack.has(s.studentId);
      // graduating class, and not held back → graduate out
      if (cls.graduates && !hold) {
        await supabase.from("students").update({ status: "graduated" }).eq("id", s.studentId);
        await supabase.from("enrollments").update({ status: "completed" }).eq("id", s.enrollmentId);
        res.graduated++;
        continue;
      }
      const targetGrade = hold ? cls.grade : (cls.nextGrade ?? cls.grade);
      const targetClassId = classMap[targetGrade];
      if (!targetClassId) continue;
      // new active enrollment in the target year
      const { data: ne, error } = await supabase.from("enrollments")
        .insert({ student_id: s.studentId, class_id: targetClassId, academic_year_id: toYearId, status: "active" })
        .select("id").single();
      if (error) throw error;
      // subjects = whatever the new class already offers
      const { data: cs } = await supabase.from("class_subjects").select("id").eq("class_id", targetClassId).is("archived_at", null);
      if (cs && cs.length) {
        await supabase.from("enrollment_subjects").insert(cs.map((r: any) => ({ enrollment_id: (ne as any).id, class_subject_id: r.id })));
      }
      await supabase.from("enrollments").update({ status: hold ? "repeated" : "promoted" }).eq("id", s.enrollmentId);
      if (hold) res.repeated++; else res.promoted++;
    }
  }
  return res;
}
