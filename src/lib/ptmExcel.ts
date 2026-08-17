import ExcelJS from "exceljs";
import { PTM_FIELDS, type PtmField } from "./ptm";
import { loadPtmReport, type PtmReportData } from "./ptmReport";

const COL_LABELS: Record<PtmField, string> = {
  foundation: "Foundation", motivation: "Motivation", preparation: "Class preparation",
  punctuality: "Punctuality", discipline: "Discipline", attention: "Attention",
  homework: "Homework", classwork: "Class work", test_score: "Test Scores",
};
const NAVY = "FF152253";
const HEADFILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
};

function safeSheetName(name: string, i: number): string {
  const cleaned = (name || `Student ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28);
  return `${i + 1}. ${cleaned}`.slice(0, 31);
}

// One workbook for a grade, one worksheet per student — mirrors the PTM report layout.
export function buildPtmWorkbook(d: PtmReportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const nCols = 2 + PTM_FIELDS.length; // Subject + 9 ratings + Remarks
  d.students.forEach((s, i) => {
    const ws = wb.addWorksheet(safeSheetName(s.name, i));
    ws.columns = [{ width: 18 }, ...PTM_FIELDS.map(() => ({ width: 6 })), { width: 42 }];

    // Title band
    ws.mergeCells(1, 1, 1, nCols);
    const t = ws.getCell(1, 1);
    t.value = `B.I.S. PTM REPORT   —   Year ${d.yearLabel}   —   ${d.ptmLabel}`;
    t.font = { bold: true, size: 14, color: { argb: NAVY } };
    t.alignment = { vertical: "middle" };

    ws.getCell(3, 1).value = "Name"; ws.getCell(3, 1).font = { bold: true };
    ws.mergeCells(3, 2, 3, nCols); ws.getCell(3, 2).value = s.name;

    // class / tardy / absent / class remark
    const hr = ws.getRow(5);
    hr.getCell(1).value = "Class"; hr.getCell(2).value = "Tardy"; hr.getCell(3).value = "Absent";
    ws.mergeCells(5, 4, 5, nCols); hr.getCell(4).value = "Class Teacher's Remarks";
    [1, 2, 3, 4].forEach((c) => { hr.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } }; hr.getCell(c).fill = HEADFILL; hr.getCell(c).alignment = { horizontal: "center" }; });
    const vr = ws.getRow(6);
    vr.getCell(1).value = d.className; vr.getCell(2).value = s.tardy ?? ""; vr.getCell(3).value = s.absent ?? "";
    ws.mergeCells(6, 4, 6, nCols); vr.getCell(4).value = s.classRemark;
    vr.getCell(4).alignment = { wrapText: true, vertical: "top" };
    [1, 2, 3].forEach((c) => (vr.getCell(c).alignment = { horizontal: "center" }));

    ws.mergeCells(8, 1, 8, nCols);
    ws.getCell(8, 1).value = "A = Excellent;  B = Good;  C = Average;  D = Improvement is required";
    ws.getCell(8, 1).font = { italic: true, color: { argb: NAVY } };

    // grid header
    const gh = ws.getRow(10);
    gh.getCell(1).value = "Subject";
    PTM_FIELDS.forEach((f, idx) => (gh.getCell(2 + idx).value = COL_LABELS[f]));
    gh.getCell(2 + PTM_FIELDS.length).value = "Additional Remarks by the subject teachers";
    for (let c = 1; c <= nCols; c++) {
      gh.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      gh.getCell(c).fill = HEADFILL;
      gh.getCell(c).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      gh.getCell(c).border = thin;
    }
    gh.height = 40;

    let r = 11;
    s.subjects.forEach((sub) => {
      const row = ws.getRow(r);
      row.getCell(1).value = sub.subjectName; row.getCell(1).font = { bold: true };
      PTM_FIELDS.forEach((f, idx) => {
        const cell = row.getCell(2 + idx);
        cell.value = sub.ratings[f] || "";
        cell.alignment = { horizontal: "center" };
      });
      row.getCell(2 + PTM_FIELDS.length).value = sub.remark;
      row.getCell(2 + PTM_FIELDS.length).alignment = { wrapText: true, vertical: "top" };
      for (let c = 1; c <= nCols; c++) row.getCell(c).border = thin;
      r++;
    });

    r += 2;
    ws.getCell(r, 1).value = "Signature of the Class Teacher";
    ws.getCell(r, Math.max(4, nCols - 3)).value = "Parent Signature";
  });

  if (d.students.length === 0) wb.addWorksheet("No PTM data");
  return wb;
}

export async function downloadPtmExcel(classId: string, eventId: string) {
  const data = await loadPtmReport(classId, eventId);
  const wb = buildPtmWorkbook(data);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PTM_${data.className}_${data.yearLabel}.xlsx`.replace(/[^\w.]+/g, "_");
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
