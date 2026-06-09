// ============================================================
// PRINT - دوال الطباعة منفصلة عن باقي المنطق
// ============================================================

import { type Employee } from "../data/employees";
import { getCustomFields } from "../lib/storage";
import { getMissingFields } from "./index";
import { NACC_LOGO, LIBYA_FLAG, SYSTEM_NAME } from "../constants";

// ──────────────────────────────────────────────
// HTML مشترك - الترويسة والتذييل
// ──────────────────────────────────────────────
function getHeaderHTML(): string {
  return `
  <div style="display:flex;align-items:center;gap:14px;padding:8px 0 14px;border-bottom:3px double #b8860b;margin-bottom:14px;">
    <div style="flex:0 0 80px;text-align:center;">
      <img src="${NACC_LOGO}" width="80" height="80" alt="شعار" style="display:block;margin:0 auto;object-fit:contain;"/>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:8px;color:#64748b;letter-spacing:1px;margin-bottom:2px;">NATIONAL ANTI-CORRUPTION COMMISSION</div>
      <div style="font-size:11px;font-weight:bold;color:#1e3a8a;margin:1px 0;">WESTERN REGION OFFICE</div>
      <div style="font-size:16px;font-weight:bold;color:#1e3a8a;margin:4px 0;">الهيئة الوطنية لمكافحة الفساد</div>
      <div style="font-size:13px;font-weight:bold;color:#1e3a8a;">ديوان المنطقة الغربية</div>
    </div>
    <div style="flex:0 0 80px;text-align:center;">
      <img src="${LIBYA_FLAG}" width="80" height="50" alt="ليبيا" style="display:block;margin:0 auto;object-fit:contain;border:1px solid #ddd;border-radius:2px;"/>
    </div>
  </div>`;
}

function getFooterHTML(): string {
  return `<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:8px;color:#94a3b8;">
    تصميم وتطوير المنظومة: <strong style="color:#b8860b;letter-spacing:1px;">${SYSTEM_NAME}</strong>
    &nbsp;|&nbsp; الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
  </div>`;
}

const PRINT_STYLES = `<style>
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color: #222; margin: 0; padding: 25px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  td, th { border: 1px solid #cbd5e1; padding: 5px 7px; }
  .label { background: #f1f5f9; font-weight: bold; color: #334155; width: 35%; font-size: 10px; }
  .value { color: #1e293b; font-size: 11px; }
  .mono { font-family: monospace; direction: ltr; text-align: left; }
  .section-title { background: #1e3a8a; color: white; padding: 5px 8px; font-size: 10px; font-weight: bold; }
  .emp-page { page-break-after: always; padding-bottom: 15px; }
  .emp-page:last-of-type { page-break-after: auto; }
  @media print {
    body { padding: 15px; }
    .no-print { display: none !important; }
  }
</style>`;

const PRINT_BTN = (label: string) =>
  `<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ ${label}</button>`;

// ──────────────────────────────────────────────
// بناء نموذج موظف واحد
// ──────────────────────────────────────────────
function buildFormHTML(emp: Employee, index?: number, total?: number): string {
  const missing = getMissingFields(emp);
  const customFields = getCustomFields();
  const e = emp as Record<string, string>;
  const idxLabel =
    index !== undefined && total !== undefined ? ` (${index + 1}/${total})` : "";
  const dt = new Date().toLocaleString("ar-LY");

  const customRows =
    customFields.length > 0
      ? `<table><tr><td class="section-title" colspan="2">بيانات إضافية</td></tr>
          ${customFields.map((cf) => `<tr><td class="label">${cf.label}</td><td class="value">${e[cf.key] || "-"}</td></tr>`).join("")}
         </table>`
      : "";

  const missingBlock =
    missing.length > 0
      ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:6px 10px;margin-top:4px;">
           <div style="color:#b91c1c;font-weight:bold;font-size:10px;margin-bottom:3px;">⚠️ النواقص (${missing.length} حقل):</div>
           <ul style="margin:0;padding:0 16px;list-style:none;font-size:9px;column-count:2;">
             ${missing.map((m) => `<li style="color:#991b1b;padding:1px 0;">• ${m}</li>`).join("")}
           </ul>
         </div>`
      : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:5px 10px;">
           <div style="color:#166534;font-weight:bold;font-size:10px;">✅ جميع البيانات مكتملة</div>
         </div>`;

  return `
<div class="emp-page">
  ${getHeaderHTML()}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <h2 style="margin:0;color:#1e3a8a;font-size:14px;">نموذج بيانات الموظف${idxLabel}</h2>
    <div style="font-size:9px;color:#94a3b8;">تاريخ الطباعة: ${dt}</div>
  </div>
  <table>
    <tr><td class="section-title" colspan="2">البيانات الأساسية</td></tr>
    <tr><td class="label">الاسم رباعي</td><td class="value">${e.fullName || "-"}</td></tr>
    <tr><td class="label">الرقم الوطني</td><td class="value mono">${e.nationalNumber || "-"}</td></tr>
    <tr><td class="label">الرقم الوظيفي</td><td class="value mono">${e.jobNumber || "-"}</td></tr>
    <tr><td class="label">الحالة الوظيفية</td><td class="value">${e.jobStatus || "-"}</td></tr>
    <tr><td class="label">نوع التوظيف</td><td class="value">${e.employmentType || "-"}</td></tr>
    <tr><td class="label">الجنس</td><td class="value">${e.gender || "-"}</td></tr>
  </table>
  <table>
    <tr><td class="section-title" colspan="2">البيانات الأكاديمية والوظيفية</td></tr>
    <tr><td class="label">الدرجة الوظيفية</td><td class="value">${e.jobGrade || "-"}</td></tr>
    <tr><td class="label">المؤهل العلمي</td><td class="value">${e.qualification || "-"}</td></tr>
    <tr><td class="label">التخصص</td><td class="value">${e.specialization || "-"}</td></tr>
    <tr><td class="label">التقدير</td><td class="value">${e.grade || "-"}</td></tr>
    <tr><td class="label">أصل المؤهل / مكان الحصول</td><td class="value">${e.qualificationOrigin || "-"}</td></tr>
  </table>
  <table>
    <tr><td class="section-title" colspan="2">البيانات الإدارية والمالية</td></tr>
    <tr><td class="label">اسم المصرف</td><td class="value">${e.bankName || "-"}</td></tr>
    <tr><td class="label">رقم الحساب (IBAN)</td><td class="value mono">${e.iban || "-"}</td></tr>
    <tr><td class="label">يتقاضى معاش</td><td class="value">${e.receivesPension || "-"}</td></tr>
    <tr><td class="label">رقم قرار التعيين</td><td class="value mono">${e.appointmentDecision || "-"}</td></tr>
    <tr><td class="label">تاريخ المباشرة</td><td class="value">${e.startDate || "-"}</td></tr>
    <tr><td class="label">آخر ترقية</td><td class="value">${e.promotionDate || "-"}</td></tr>
  </table>
  <table>
    <tr><td class="section-title" colspan="2">بيانات الاتصال والتنظيم</td></tr>
    <tr><td class="label">الإدارة</td><td class="value">${e.department || "-"}</td></tr>
    <tr><td class="label">القسم</td><td class="value">${e.section || "-"}</td></tr>
    <tr><td class="label">رقم الهاتف</td><td class="value mono">${e.phone || "-"}</td></tr>
  </table>
  ${customRows}
  ${missingBlock}
  <table>
    <tr><td class="section-title" colspan="2">ملاحظات وإجراءات</td></tr>
    <tr><td class="label">ملاحظات</td><td class="value">${e.notes || "-"}</td></tr>
    <tr><td class="label">الإجراء المطلوب</td><td class="value">${e.requiredAction || "-"}</td></tr>
  </table>
  <div style="margin-top:25px;display:flex;justify-content:space-between;">
    <div style="text-align:center;min-width:130px;">
      <p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / الموظف</p>
      <div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div>
    </div>
    <div style="text-align:center;min-width:130px;">
      <p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / المدير</p>
      <div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div>
    </div>
    <div style="text-align:center;min-width:130px;">
      <p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / الموارد البشرية</p>
      <div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div>
    </div>
  </div>
  ${getFooterHTML()}
</div>`;
}

// ──────────────────────────────────────────────
// الدوال العامة للطباعة
// ──────────────────────────────────────────────
function openPrintWindow(width = 900, height = 750): Window | null {
  const w = window.open("", "_blank", `width=${width},height=${height},scrollbars=yes`);
  if (!w) alert("يرجى السماح بالنوافذ المنبثقة في المتصفح");
  return w;
}

export function printIndividualForm(emp: Employee): void {
  const w = openPrintWindow();
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>نموذج - ${(emp as Record<string,string>).fullName}</title>${PRINT_STYLES}</head>
<body>
  ${buildFormHTML(emp)}
  ${PRINT_BTN("طباعة")}
</body>
</html>`);
  w.document.close();
}

export function printAllForms(data: Employee[]): void {
  const w = openPrintWindow();
  if (!w) return;
  const forms = data.map((emp, idx) => buildFormHTML(emp, idx, data.length)).join("");
  w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head><meta charset="UTF-8"><title>تقرير (${data.length})</title>${PRINT_STYLES}</head>
<body>
  ${forms}
  ${PRINT_BTN(`طباعة (${data.length})`)}
</body>
</html>`);
  w.document.close();
}

export function printSummaryTable(data: Employee[]): void {
  const w = openPrintWindow(1100, 800);
  if (!w) return;

  const dt = new Date().toLocaleString("ar-LY");

  const rows = data.map((emp, i) => {
    const e = emp as Record<string, string>;
    return `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "white"};">
      <td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding:3px 5px;font-family:monospace;direction:ltr;font-size:9px;border:1px solid #e2e8f0;">${e.nationalNumber}</td>
      <td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.fullName}</td>
      <td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.jobGrade || "-"}</td>
      <td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.qualification || "-"}</td>
      <td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.bankName || "-"}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${e.status || "-"}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${e.dataComplete || "-"}</td>
      <td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;color:#b91c1c;font-weight:bold;">${getMissingFields(emp).length}</td>
    </tr>`;
  }).join("");

  w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ملخص بيانات الموظفين</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color: #222; margin: 0; padding: 15px 20px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1e3a8a; color: white; padding: 5px 4px; font-size: 9px; border: 1px solid #1e3a8a; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 8px 12px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${getHeaderHTML()}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div>
      <h2 style="margin:0;color:#1e3a8a;font-size:13px;">ملخص بيانات الموظفين</h2>
      <p style="margin:2px 0 0;font-size:8px;color:#94a3b8;">تاريخ: ${dt}</p>
    </div>
    <div style="font-size:9px;color:#64748b;">العدد: <strong style="color:#1e3a8a;">${data.length}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        ${["#","الرقم الوطني","الاسم","الدرجة","المؤهل","المصرف","الحالة","البيانات","النواقص"].map((h) => `<th>${h}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${getFooterHTML()}
  ${PRINT_BTN("طباعة")}
</body>
</html>`);
  w.document.close();
}

// ──────────────────────────────────────────────
// طباعة تنبيهات الموظفين الناقصين — مستقلة
// ──────────────────────────────────────────────
export function printAlertTable(alertEmps: Employee[]): void {
  const w = openPrintWindow(1100, 800);
  if (!w) return;

  const dt = new Date().toLocaleString("ar-LY");
  const CHUNK = 25;
  const chunks: Employee[][] = [];
  for (let i = 0; i < alertEmps.length; i += CHUNK) {
    chunks.push(alertEmps.slice(i, i + CHUNK));
  }

  const chunksHTML = chunks.map((chunk, ci) => `
    <div style="margin-bottom:20px;page-break-inside:avoid;page-break-before:${ci === 0 ? "auto" : "always"};">
      ${ci === 0 ? "" : getHeaderHTML()}
      <h3 style="color:#92400e;font-size:12px;margin:0 0 8px;background:#fef3c7;padding:8px;border-radius:6px;border:1px solid #f59e0b;">
        ⚠️ موظفون بحاجة لمراجعة الإدارة — (${alertEmps.length}) موظف
        ${chunks.length > 1 ? `— صفحة ${ci + 1} من ${chunks.length}` : ""}
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr>
            ${["#","الرقم الوطني","الاسم","الدرجة","الإدارة","عدد النواقص","الملاحظات","الإجراء المطلوب"]
              .map((h) => `<th style="background:#f59e0b;color:white;padding:6px;border:1px solid #f59e0b;text-align:right;">${h}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${chunk.map((emp, i) => {
            const e = emp as Record<string, string>;
            const missing = getMissingFields(emp).length;
            return `<tr style="background:${i % 2 === 0 ? "#fffbeb" : "white"};">
              <td style="padding:4px 6px;border:1px solid #fcd34d;text-align:center;">${ci * CHUNK + i + 1}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;font-family:monospace;direction:ltr;">${e.nationalNumber}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;font-weight:bold;">${e.fullName}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;">${e.jobGrade || "-"}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;">${e.department || "-"}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;text-align:center;color:#b91c1c;font-weight:bold;">${missing}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;max-width:200px;">${e.notes || "-"}</td>
              <td style="padding:4px 6px;border:1px solid #fcd34d;max-width:200px;">${e.requiredAction || "-"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`).join("");

  w.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تنبيهات الموظفين الناقصين</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color: #222; margin: 0; padding: 15px 20px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    @media print {
      .no-print { display: none !important; }
      body { padding: 8px 12px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${getHeaderHTML()}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div>
      <h2 style="margin:0;color:#92400e;font-size:13px;">⚠️ تقرير الموظفين بحاجة لمراجعة الإدارة</h2>
      <p style="margin:2px 0 0;font-size:8px;color:#94a3b8;">تاريخ: ${dt}</p>
    </div>
    <div style="font-size:9px;color:#64748b;">العدد: <strong style="color:#b91c1c;">${alertEmps.length}</strong></div>
  </div>
  ${chunksHTML}
  ${getFooterHTML()}
  ${PRINT_BTN("طباعة التنبيهات")}
</body>
</html>`);
  w.document.close();
}
