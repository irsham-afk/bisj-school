import type { ClassReportData, StudentReport } from "./reportcards";
import { gradeFor, type GradeBand } from "./marks";

const ABSENT_COUNTS_AS_ZERO = false; // false = absent excluded from %, true = counts as 0

const PILL: Record<string, string> = {
  "A*": "#b8862c", A: "#1f4e8f", B: "#2f6bb0", C: "#4a82c0",
  D: "#8a6a2a", E: "#8a6a2a", F: "#a23b32", G: "#a23b32", U: "#a23b32",
};
const pill = (g: string | null) =>
  g ? `<span class="pill" style="background:${PILL[g] ?? "#555"}">${g}</span>` : "";

function card(s: StudentReport, d: ClassReportData, logoUrl: string): string {
  const bands: GradeBand[] = d.bands;
  let rows = "";
  const graded: number[] = [];
  let nAbsent = 0;
  for (const sub of s.subjects) {
    if (sub.status === "absent") {
      nAbsent++;
      rows += `<tr><td>${sub.subject}</td><td class="n">${sub.max}</td>
        <td class="n" style="color:#a23b32;font-style:italic">Absent</td><td class="n">&ndash;</td>
        <td class="n"><span class="pill" style="background:#8a8f86">Ab</span></td></tr>`;
    } else if (sub.score !== null) {
      const pct = (sub.score / sub.max) * 100;
      graded.push(pct);
      rows += `<tr><td>${sub.subject}</td><td class="n">${sub.max}</td><td class="n">${sub.score}</td>
        <td class="n">${pct.toFixed(1)}</td><td class="n">${pill(gradeFor(pct, bands))}</td></tr>`;
    } else {
      rows += `<tr><td>${sub.subject}</td><td class="n">${sub.max}</td>
        <td class="n" style="color:#c4c4bd">&middot;</td><td class="n">&ndash;</td><td class="n"></td></tr>`;
    }
  }
  const denom = ABSENT_COUNTS_AS_ZERO ? graded.length + nAbsent : graded.length;
  const overall = graded.length ? graded.reduce((a, b) => a + b, 0) / denom : 0;
  const og = graded.length ? gradeFor(overall, bands) : null;
  const absnote = nAbsent
    ? `<div class="scale">Absent in ${nAbsent} subject(s) — ${ABSENT_COUNTS_AS_ZERO ? "counted as 0" : "not counted in the %"}.</div>`
    : "";

  return `
  <div class="rcard"><div class="inner">
    <div class="head">
      <div class="badge"><img src="${logoUrl}"/></div>
      <div><div class="school">${d.schoolName}</div><div class="exam">${d.termName} &middot; 2026&ndash;2027</div></div>
      <div class="doc">Progress<br/>Report</div>
    </div>
    <table class="meta">
      <tr><td class="k">Roll No</td><td class="v">${s.roll ?? "—"}</td><td class="gap"></td><td class="k">School Days</td><td class="v">${s.schoolDays ?? "—"}</td></tr>
      <tr><td class="k">Name</td><td class="v">${s.name}</td><td></td><td class="k">Present</td><td class="v">${s.present ?? "—"}</td></tr>
      <tr><td class="k">Class</td><td class="v">${d.className}</td><td></td><td class="k">Tardy</td><td class="v">${s.tardy ?? "—"}</td></tr>
      <tr><td class="k">Class Teacher</td><td class="v">${d.classTeacherName || "—"}</td><td></td><td class="k">Absent</td><td class="v">${s.absent ?? "—"}</td></tr>
    </table>
    <table class="marks">
      <tr><th>Subject</th><th class="n">Total</th><th class="n">Obtained</th><th class="n">%</th><th class="n">Grade</th></tr>
      ${rows}
      <tr class="tot"><td>Total</td><td class="n">${graded.length * 100}</td>
        <td class="n">${graded.length ? Math.round(graded.reduce((a, b) => a + b, 0)) : 0}</td>
        <td class="n">${graded.length ? overall.toFixed(1) : "—"}</td><td class="n">${pill(og)}</td></tr>
    </table>
    <div class="remark"><div class="l">Class Teacher's Remarks</div><div class="t">${s.remark || "&nbsp;"}</div></div>
    ${absnote}
    <div class="scale">Grade scale&nbsp; ${bands.map((b) => `${b.grade} ${b.min}–${b.max}`).join(" · ")}</div>
    <table class="sign"><tr><td><div class="ln"></div>Class Teacher</td><td><div class="ln"></div>Principal</td></tr></table>
  </div></div>`;
}

export function buildReportHtml(d: ClassReportData, logoUrl: string): string {
  const cards = d.students.map((s) => card(s, d, logoUrl)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${d.className} — Report Cards</title>
<style>
@page{size:A4;margin:10mm;}
*{box-sizing:border-box;}
body{margin:0;font-family:"Segoe UI",Arial,sans-serif;color:#1a1d1b;}
.rcard{border:6px solid #152253;padding:4px;page-break-after:always;height:273mm;}
.rcard:last-child{page-break-after:auto;}
.inner{border:1.5px solid #b8862c;height:100%;padding:10mm 9mm;display:flex;flex-direction:column;}
.head{background:#152253;color:#fff;border-radius:4px;padding:10px 14px;display:flex;align-items:center;}
.badge{width:88px;height:88px;background:#fff;border:2.5px solid #b8862c;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:16px;overflow:hidden;}
.badge img{width:108px;height:108px;object-fit:cover;}
.school{font-size:20px;font-weight:700;}
.exam{font-size:11px;opacity:.85;margin-top:2px;}
.doc{margin-left:auto;text-align:right;font-size:10px;letter-spacing:.18em;text-transform:uppercase;opacity:.9;}
.meta{width:100%;margin:14px 0 4px;border-collapse:collapse;font-size:12.5px;}
.meta td{padding:4px 0;border-bottom:1px solid #e2e2db;}
.meta .k{color:#6b7066;width:120px;} .meta .v{font-weight:600;} .gap{width:34px;}
table.marks{width:100%;border-collapse:collapse;margin-top:14px;font-size:12.5px;}
table.marks th{background:#152253;color:#fff;text-align:left;padding:7px 10px;font-size:10px;letter-spacing:.05em;text-transform:uppercase;}
table.marks th.n,table.marks td.n{text-align:center;}
table.marks td{padding:6px 10px;border-bottom:1px solid #e6e6df;}
table.marks tr:nth-child(even) td{background:#f3f6fb;}
tr.tot td{border-top:2px solid #152253;font-weight:700;background:#eaeff7 !important;}
.pill{display:inline-block;min-width:26px;padding:1px 7px;border-radius:9px;color:#fff;font-weight:700;font-size:11px;}
.remark{margin-top:14px;border:1px solid #e2e2db;border-left:4px solid #b8862c;border-radius:4px;padding:10px 12px;}
.remark .l{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#6b7066;}
.remark .t{font-size:14px;margin-top:3px;}
.scale{margin-top:12px;font-size:9.5px;color:#6b7066;}
.sign{margin-top:auto;width:100%;padding-top:20px;}
.sign td{width:50%;text-align:center;font-size:11px;color:#6b7066;padding-top:30px;}
.sign .ln{border-top:1px solid #1a1d1b;margin:0 18px 5px;}
@media print{ .rcard{break-after:page;} }
</style></head><body>${cards}
<script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;
}
