import ExcelJS from "exceljs";
import { supabase } from "./supabase";

export type ResultRow = {
  roll: string | number | null;
  name: string;
  marks: (number | "ABS" | null)[]; // aligned to `subjects`
  present: number | null; tardy: number | null; absent: number | null;
};
export type ResultSheet = {
  grade: string; classTeacher: string; schoolDays: number | null;
  subjects: string[]; rows: ResultRow[];
};

const GREY = "FFD8D8D8";
const colL = (n: number) => { let s = ""; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
const thin = { style: "thin" as const, color: { argb: "FF999999" } };
const border = { top: thin, left: thin, right: thin, bottom: thin };
const gradeFormula = (p: string) =>
  `IF(${p}>=90,"A*",IF(${p}>=80,"A",IF(${p}>=70,"B",IF(${p}>=60,"C",IF(${p}>=50,"D",IF(${p}>=40,"E",IF(${p}>=30,"F",IF(${p}>=20,"G","U"))))))))`;

export function buildResultsWorkbook(school: string, sheets: ResultSheet[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BIS School System";
  for (const sh of sheets) {
    const S = sh.subjects.length;
    const cTotal = 3 + S, cPct = 4 + S, cGrade = 5 + S, cPres = 6 + S, cTardy = 7 + S, cAbs = 8 + S, last = cAbs;
    const ws = wb.addWorksheet((sh.grade || "Class").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    ws.getColumn(1).width = 5.2; ws.getColumn(2).width = 28;
    for (let c = 3; c <= 2 + S; c++) ws.getColumn(c).width = 6.2;
    ws.getColumn(cTotal).width = 9; ws.getColumn(cPct).width = 9; ws.getColumn(cGrade).width = 7;
    ws.getColumn(cPres).width = 7; ws.getColumn(cTardy).width = 7; ws.getColumn(cAbs).width = 7;
    ws.mergeCells(1, 1, 1, 2); ws.getCell(1, 1).value = sh.grade;
    ws.mergeCells(1, 3, 1, last); ws.getCell(1, 3).value = school;
    ws.mergeCells(2, 1, 2, 2); ws.getCell(2, 1).value = `Class Teacher: ${sh.classTeacher || ""}`;
    for (let i = 0; i < S; i++) ws.getCell(2, 3 + i).value = i + 1;
    ws.mergeCells(2, cTotal, 3, cTotal); ws.getCell(2, cTotal).value = "Total  Marks";
    ws.mergeCells(2, cPct, 3, cPct); ws.getCell(2, cPct).value = "Percent %";
    ws.mergeCells(2, cGrade, 2, cPres); ws.getCell(2, cGrade).value = "School days";
    ws.mergeCells(2, cTardy, 2, cAbs); ws.getCell(2, cTardy).value = sh.schoolDays ?? "";
    ws.mergeCells(3, 1, 3, 2); ws.getCell(3, 1).value = "Student Name";
    sh.subjects.forEach((nm, i) => (ws.getCell(3, 3 + i).value = nm));
    ws.getCell(3, cGrade).value = "Grade"; ws.getCell(3, cPres).value = "Present";
    ws.getCell(3, cTardy).value = "Tardy"; ws.getCell(3, cAbs).value = "Absent";
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= last; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
      cell.font = { bold: true, size: r === 1 ? (c < 3 ? 20 : 18) : 11 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: r === 3 };
      cell.border = border;
    }
    sh.rows.forEach((row, ri) => {
      const r = 4 + ri;
      ws.getCell(r, 1).value = row.roll as any;
      ws.getCell(r, 2).value = row.name;
      row.marks.forEach((m, i) => { ws.getCell(r, 3 + i).value = (m === null ? null : m) as any; });
      const first = colL(3) + r, lastSub = colL(2 + S) + r;
      ws.getCell(r, cTotal).value = { formula: `SUM(${first}:${lastSub})` };
      ws.getCell(r, cPct).value = { formula: `ROUND(${colL(cTotal)}${r}/${S},1)` };
      ws.getCell(r, cGrade).value = { formula: gradeFormula(`${colL(cPct)}${r}`) };
      ws.getCell(r, cPres).value = row.present ?? null;
      ws.getCell(r, cTardy).value = row.tardy ?? null;
      ws.getCell(r, cAbs).value = row.absent ?? null;
      for (let c = 1; c <= last; c++) { const cell = ws.getCell(r, c); cell.border = border; cell.alignment = { horizontal: c === 2 ? "left" : "center" }; }
    });
    ws.getRow(1).height = 30; ws.getRow(3).height = 42;
    ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
  }
  return wb;
}

export async function loadClassResultsGrid(classId: string, termId: string, eventId?: string): Promise<ResultSheet> {
  const { data: cls } = await supabase.from("classes").select("name, school_id, homeroom_teacher_id").eq("id", classId).single();
  const { data: csRows } = await supabase.from("class_subjects").select("id, subject:subjects(name)").eq("class_id", classId).is("archived_at", null);
  const cols = (csRows ?? []).map((r: any) => ({ id: r.id, name: r.subject?.name ?? "Subject" })).sort((a, b) => a.name.localeCompare(b.name));
  const csIds = cols.map((c) => c.id);
  const { data: asmts } = csIds.length
    ? await (eventId
        ? supabase.from("assessments").select("id, class_subject_id").eq("event_id", eventId).in("class_subject_id", csIds)
        : supabase.from("assessments").select("id, class_subject_id").eq("term_id", termId).in("class_subject_id", csIds))
    : { data: [] as any[] };
  const asmtByCs: Record<string, string> = {};
  (asmts ?? []).forEach((a: any) => { if (!asmtByCs[a.class_subject_id]) asmtByCs[a.class_subject_id] = a.id; });
  const asmtIds = Object.values(asmtByCs);
  const { data: results } = asmtIds.length
    ? await supabase.from("results").select("assessment_id, student_id, score, status").in("assessment_id", asmtIds)
    : { data: [] as any[] };
  const resByAsmtStu: Record<string, { score: number | null; status: string }> = {};
  (results ?? []).forEach((r: any) => { resByAsmtStu[`${r.assessment_id}:${r.student_id}`] = { score: r.score === null ? null : Number(r.score), status: r.status ?? "graded" }; });
  const { data: enrs } = await supabase.from("enrollments")
    .select("id, student:students(id, first_name, last_name, admission_no)")
    .eq("class_id", classId).eq("status", "active");
  const enrIds = (enrs ?? []).map((e: any) => e.id);
  const { data: esRows } = enrIds.length
    ? await supabase.from("enrollment_subjects").select("enrollment_id, class_subject_id").in("enrollment_id", enrIds)
    : { data: [] as any[] };
  const takesByEnr: Record<string, Set<string>> = {};
  (esRows ?? []).forEach((r: any) => { (takesByEnr[r.enrollment_id] ??= new Set()).add(r.class_subject_id); });
  const stuIds = (enrs ?? []).map((e: any) => e.student.id);
  const { data: rcs } = stuIds.length
    ? await supabase.from("report_cards").select("student_id, days_present, days_tardy, days_absent, days_total, class_teacher_name").eq("term_id", termId).in("student_id", stuIds)
    : { data: [] as any[] };
  const rcByStu: Record<string, any> = {};
  (rcs ?? []).forEach((r: any) => { rcByStu[r.student_id] = r; });
  let classTeacher = ""; let schoolDays: number | null = null;
  const rows: ResultRow[] = (enrs ?? []).map((e: any) => {
    const sid = e.student.id;
    const takes = takesByEnr[e.id];
    const marks = cols.map((c) => {
      if (takes && !takes.has(c.id)) return null;
      const aid = asmtByCs[c.id];
      const res = aid ? resByAsmtStu[`${aid}:${sid}`] : undefined;
      if (!res) return null;
      if (res.status === "absent") return "ABS" as const;
      return res.score;
    });
    const rc = rcByStu[sid];
    if (rc?.class_teacher_name && !classTeacher) classTeacher = rc.class_teacher_name;
    if (rc?.days_total != null && schoolDays == null) schoolDays = rc.days_total;
    return { roll: e.student.admission_no, name: `${e.student.first_name ?? ""} ${e.student.last_name ?? ""}`.trim(), marks, present: rc?.days_present ?? null, tardy: rc?.days_tardy ?? null, absent: rc?.days_absent ?? null };
  }).sort((a, b) => String(a.roll ?? "").localeCompare(String(b.roll ?? "")));
  return { grade: cls?.name ?? "Class", classTeacher, schoolDays, subjects: cols.map((c) => c.name), rows };
}

export async function downloadResultsExcel(school: string, sheets: ResultSheet[], filename: string) {
  const wb = buildResultsWorkbook(school, sheets);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
