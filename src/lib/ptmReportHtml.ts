import { PTM_FIELDS, type PtmField } from "./ptm";
import type { PtmReportData, PtmReportStudent } from "./ptmReport";

const COL_LABELS: Record<PtmField, string> = {
  foundation: "Foundation",
  motivation: "Motivation",
  preparation: "Class preparation",
  punctuality: "Punctuality",
  discipline: "Discipline",
  attention: "Attention",
  homework: "Homework",
  classwork: "Class work",
  test_score: "Test Scores",
};

function esc(x: string | number | null | undefined): string {
  return String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sheet(s: PtmReportStudent, d: PtmReportData): string {
  const rows = s.subjects.map((sub) => `
    <tr>
      <td class="subj">${esc(sub.subjectName)}</td>
      ${PTM_FIELDS.map((f) => `<td class="rate">${esc(sub.ratings[f])}</td>`).join("")}
      <td class="srem">${esc(sub.remark) || "&nbsp;"}</td>
    </tr>`).join("");

  return `
  <div class="sheet"><div class="inner">
    <table class="hdr">
      <tr>
        <td class="title">B.I.S. PTM REPORT</td>
        <td class="yr"><span class="lbl">Year</span> ${esc(d.yearLabel)}</td>
        <td class="ptm">${esc(d.ptmLabel)}</td>
      </tr>
    </table>

    <table class="top">
      <tr>
        <td class="namecell" rowspan="2"><span class="lbl">Name</span><div class="name">${esc(s.name)}</div></td>
        <th>Class</th><th>Tardy</th><th>Absent</th>
        <th class="remh">Class Teacher's Remarks</th>
      </tr>
      <tr>
        <td class="c">${esc(d.className)}</td><td class="c">${s.tardy ?? "—"}</td><td class="c">${s.absent ?? "—"}</td>
        <td class="crem">${esc(s.classRemark) || "&nbsp;"}</td>
      </tr>
    </table>

    <div class="legend">A = Excellent; &nbsp; B = Good; &nbsp; C = Average; &nbsp; D = Improvement is required</div>

    <table class="grid">
      <thead>
        <tr>
          <th class="subjh">Subject</th>
          ${PTM_FIELDS.map((f) => `<th class="rh"><span>${COL_LABELS[f]}</span></th>`).join("")}
          <th class="aremh">Additional Remarks by the subject teachers</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="sign">
      <tr><td><div class="ln"></div>Signature of the Class Teacher</td><td><div class="ln"></div>Parent Signature</td></tr>
    </table>
  </div></div>`;
}

export function buildPtmHtml(d: PtmReportData): string {
  const sheets = d.students.map((s) => sheet(s, d)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.className)} — PTM Report</title>
<style>
  *{box-sizing:border-box;}
  @page{size:A4 landscape;margin:9mm;}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#1a1d1b;margin:0;font-size:11px;}
  .sheet{page-break-after:always;height:194mm;}
  .sheet:last-child{page-break-after:auto;}
  .inner{height:100%;display:flex;flex-direction:column;border:1.5px solid #152253;padding:6mm 6mm;}
  table{border-collapse:collapse;width:100%;}
  .hdr td{vertical-align:middle;padding:2px 4px;}
  .hdr .title{font-size:17px;font-weight:700;letter-spacing:.5px;color:#152253;}
  .hdr .yr{text-align:center;font-size:13px;}
  .hdr .ptm{text-align:right;font-size:11px;color:#444;white-space:nowrap;}
  .lbl{color:#8a8f86;font-size:9px;text-transform:uppercase;letter-spacing:.5px;margin-right:4px;}
  .top{margin-top:6px;border:1px solid #444;}
  .top th,.top td{border:1px solid #999;padding:3px 5px;font-size:10px;}
  .top th{background:#f0f1ee;font-weight:600;}
  .top .namecell{width:36%;vertical-align:top;border:1px solid #444;}
  .top .name{font-size:14px;font-weight:600;margin-top:2px;}
  .top .c{text-align:center;font-weight:600;}
  .top .remh{width:34%;}
  .top .crem{font-size:9.5px;line-height:1.3;}
  .legend{margin:7px 0 4px;font-size:9.5px;font-weight:600;color:#152253;}
  .grid{border:1px solid #444;table-layout:fixed;}
  .grid th,.grid td{border:1px solid #b9bdb5;}
  .grid .subjh{width:20mm;background:#152253;color:#fff;font-size:10px;padding:3px;}
  .grid .rh{width:8mm;height:26mm;background:#f0f1ee;vertical-align:bottom;padding:2px 0 4px;}
  .grid .rh span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:9px;font-weight:600;display:inline-block;}
  .grid .aremh{background:#152253;color:#fff;font-size:9.5px;padding:3px;}
  .grid .subj{font-weight:600;font-size:10px;padding:4px;}
  .grid .rate{text-align:center;font-weight:700;font-size:11px;}
  .grid .srem{font-size:9px;line-height:1.25;padding:3px 4px;}
  .sign{margin-top:auto;padding-top:16px;}
  .sign td{width:50%;text-align:center;font-size:10.5px;color:#4a4f46;padding-top:26px;}
  .sign .ln{border-top:1px solid #1a1d1b;margin:0 14px 5px;}
  @media print{ .sheet{break-after:page;} }
</style></head><body>${sheets}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
</body></html>`;
}
