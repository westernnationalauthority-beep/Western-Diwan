const NACC_LOGO = "/images/nacc-logo.png";
const LIBYA_FLAG = "/images/libya-flag.png";
const SYSTEM_NAME = "منظومة بيانات موظفي ديوان الغربية";

// Mock getMissingFields and getCustomFields to avoid circular deps, they will be passed or imported properly in App.tsx
// For now, we assume they are available or we pass them. 
// Actually, let's just define the print functions here and import helpers in App.tsx

export function getHeaderHTML(): string {
  return `
  <div style="display:flex;align-items:center;gap:14px;padding:8px 0 14px;border-bottom:3px double #b8860b;margin-bottom:14px;">
    <div style="flex:0 0 110px;text-align:center;"><img src="${NACC_LOGO}" width="110" height="110" alt="شعار" style="display:block;margin:0 auto;object-fit:contain;"/></div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:10px;color:#64748b;letter-spacing:1px;margin-bottom:2px;">NATIONAL ANTI-CORRUPTION COMMISSION</div>
      <div style="font-size:14px;font-weight:bold;color:#1e3a8a;margin:2px 0;">WESTERN REGION OFFICE</div>
      <div style="font-size:18px;font-weight:bold;color:#1e3a8a;margin:4px 0;">الهيئة الوطنية لمكافحة الفساد</div>
      <div style="font-size:16px;font-weight:bold;color:#1e3a8a;">ديوان المنطقة الغربية</div>
    </div>
    <div style="flex:0 0 110px;text-align:center;"><img src="${LIBYA_FLAG}" width="110" height="70" alt="ليبيا" style="display:block;margin:0 auto;object-fit:contain;border:1px solid #ddd;border-radius:2px;"/></div>
  </div>`;
}

export function getFooterHTML(): string {
  return `<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:8px;color:#94a3b8;">تصميم وتطوير المنظومة: <strong style="color:#b8860b;letter-spacing:1px;">${SYSTEM_NAME}</strong> &nbsp;|&nbsp; الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</div>`;
}

export function buildFormHTML(emp: any, missing: string[], customFields: any[], index?: number, total?: number): string {
  const idxLabel = index !== undefined && total !== undefined ? ` (${index + 1}/${total})` : "";
  const dt = new Date().toLocaleString("ar-LY");
  const customRows = customFields.length > 0 ? `<table><tr><td class="section-title" colspan="2">بيانات إضافية</td></tr>${customFields.map((cf: any) => `<tr><td class="label">${cf.label}</td><td class="value">${emp[cf.key] || '-'}</td></tr>`).join('')}</table>` : '';

  return `
<div class="emp-page">
${getHeaderHTML()}
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
  <h2 style="margin:0;color:#1e3a8a;font-size:14px;">نموذج بيانات الموظف${idxLabel}</h2>
  <div style="font-size:9px;color:#94a3b8;">تاريخ الطباعة: ${dt}</div>
</div>
<table><tr><td class="section-title" colspan="2">البيانات الأساسية</td></tr>
<tr><td class="label">الاسم رباعي</td><td class="value">${emp.fullName||'-'}</td></tr>
<tr><td class="label">الرقم الوطني</td><td class="value mono">${emp.nationalNumber||'-'}</td></tr>
<tr><td class="label">الرقم الوظيفي</td><td class="value mono">${emp.jobNumber||'-'}</td></tr>
<tr><td class="label">الحالة الوظيفية</td><td class="value">${emp.jobStatus||'-'}</td></tr>
<tr><td class="label">نوع التوظيف</td><td class="value">${emp.employmentType||'-'}</td></tr>
<tr><td class="label">الجنس</td><td class="value">${emp.gender||'-'}</td></tr></table>
<table><tr><td class="section-title" colspan="2">البيانات الأكاديمية والوظيفية</td></tr>
<tr><td class="label">الدرجة الوظيفية</td><td class="value">${emp.jobGrade||'-'}</td></tr>
<tr><td class="label">المؤهل العلمي</td><td class="value">${emp.qualification||'-'}</td></tr>
<tr><td class="label">التخصص</td><td class="value">${emp.specialization||'-'}</td></tr>
<tr><td class="label">التقدير</td><td class="value">${emp.grade||'-'}</td></tr>
<tr><td class="label">أصل المؤهل / مكان الحصول</td><td class="value">${emp.qualificationOrigin||'-'}</td></tr></table>
<table><tr><td class="section-title" colspan="2">البيانات الإدارية والمالية</td></tr>
<tr><td class="label">اسم المصرف</td><td class="value">${emp.bankName||'-'}</td></tr>
<tr><td class="label">رقم الحساب (IBAN)</td><td class="value mono">${emp.iban||'-'}</td></tr>
<tr><td class="label">يتقاضى معاش</td><td class="value">${emp.receivesPension||'-'}</td></tr>
<tr><td class="label">رقم قرار التعيين</td><td class="value mono">${emp.appointmentDecision||'-'}</td></tr>
<tr><td class="label">تاريخ المباشرة</td><td class="value">${emp.startDate||'-'}</td></tr>
<tr><td class="label">آخر ترقية</td><td class="value">${emp.promotionDate||'-'}</td></tr></table>
<table><tr><td class="section-title" colspan="2">بيانات الاتصال والتنظيم</td></tr>
<tr><td class="label">الإدارة</td><td class="value">${emp.department||'-'}</td></tr>
<tr><td class="label">القسم</td><td class="value">${emp.section||'-'}</td></tr>
<tr><td class="label">رقم الهاتف</td><td class="value mono">${emp.phone||'-'}</td></tr></table>
${customRows}
${missing.length > 0 ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:6px 10px;margin-top:4px;"><div style="color:#b91c1c;font-weight:bold;font-size:10px;margin-bottom:3px;">⚠️ النواقص (${missing.length} حقل):</div><ul style="margin:0;padding:0 16px;list-style:none;font-size:9px;column-count:2;">${missing.map((m: string) => `<li style="color:#991b1b;padding:1px 0;">• ${m}</li>`).join('')}</ul></div>` : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:5px 10px;"><div style="color:#166534;font-weight:bold;font-size:10px;">✅ جميع البيانات مكتملة</div></div>`}
<table><tr><td class="section-title" colspan="2">ملاحظات وإجراءات</td></tr>
<tr><td class="label">ملاحظات</td><td class="value">${emp.notes||'-'}</td></tr>
<tr><td class="label">الإجراء المطلوب</td><td class="value">${emp.requiredAction||'-'}</td></tr></table>
<div style="margin-top:25px;display:flex;justify-content:space-between;">
<div style="text-align:center;min-width:130px;"><p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / الموظف</p><div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div></div>
<div style="text-align:center;min-width:130px;"><p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / المدير</p><div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div></div>
<div style="text-align:center;min-width:130px;"><p style="font-size:9px;color:#94a3b8;margin:0;">التوقيع / الموارد البشرية</p><div style="border-top:1px solid #94a3b8;width:130px;margin:20px auto 3px;"></div></div></div>
${getFooterHTML()}
</div>`;
}

const PRINT_STYLES = `<style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#222;margin:0;padding:25px;font-size:11px;}table{width:100%;border-collapse:collapse;margin-bottom:6px;}td,th{border:1px solid #cbd5e1;padding:5px 7px;}.label{background:#f1f5f9;font-weight:bold;color:#334155;width:35%;font-size:10px;}.value{color:#1e293b;font-size:11px;}.mono{font-family:monospace;direction:ltr;text-align:left;}.section-title{background:#1e3a8a;color:white;padding:5px 8px;font-size:10px;font-weight:bold;}.emp-page{page-break-after:always;padding-bottom:15px;}.emp-page:last-of-type{page-break-after:auto;}@media print{body{padding:15px;}.no-print{display:none!important;}}</style>`;

export function printIndividualForm(emp: any, missing: string[], customFields: any[]) {
  const w = window.open("", "_blank", "width=900,height=750,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>نموذج - ${emp.fullName}</title>${PRINT_STYLES}</head><body>${buildFormHTML(emp, missing, customFields)}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة</button></body></html>`);
  w.document.close();
}

export function printAllForms(data: any[], missingFn: (e: any) => string[], customFields: any[]) {
  const w = window.open("", "_blank", "width=900,height=750,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  const forms = data.map((emp: any, idx: number) => buildFormHTML(emp, missingFn(emp), customFields, idx, data.length)).join('');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير (${data.length})</title>${PRINT_STYLES}</head><body>${forms}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة (${data.length})</button></body></html>`);
  w.document.close();
}

export function printSummaryTable(data: any[], alertEmps: any[], missingFn: (e: any) => number) {
  const w = window.open("", "_blank", "width=1100,height=800,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  const dt = new Date().toLocaleString("ar-LY");
  const chunkSize = 25;

  const alertChunks: any[][] = [];
  for (let i = 0; i < alertEmps.length; i += chunkSize) alertChunks.push(alertEmps.slice(i, i + chunkSize));
  
  const alertHTML = alertEmps.length > 0 ? alertChunks.map((chunk, ci) => `
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:15px;margin:20px 0;page-break-inside:avoid;">
      <h3 style="color:#b91c1c;font-size:14px;margin:0 0 10px;border-bottom:1px solid #fca5a5;padding-bottom:5px;">
        ⚠️ تنبيه: موظفون بحاجة لمراجعة الإدارة (${alertEmps.length}) - جزء ${ci + 1}/${alertChunks.length}
      </h3>
      <table style="font-size:10px;width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">#</th>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">الرقم الوطني</th>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">الاسم</th>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">النواقص</th>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">الملاحظات</th>
            <th style="background:#b91c1c;color:white;padding:6px;border:1px solid #b91c1c;">الإجراء المطلوب</th>
          </tr>
        </thead>
        <tbody>
          ${chunk.map((e: any, i: number) => `
            <tr>
              <td style="padding:5px;border:1px solid #fca5a5;text-align:center;">${ci * chunkSize + i + 1}</td>
              <td style="padding:5px;border:1px solid #fca5a5;font-family:monospace;direction:ltr;text-align:center;">${e.nationalNumber}</td>
              <td style="padding:5px;border:1px solid #fca5a5;font-weight:bold;">${e.fullName}</td>
              <td style="padding:5px;border:1px solid #fca5a5;text-align:center;color:#b91c1c;font-weight:bold;">${missingFn(e)}</td>
              <td style="padding:5px;border:1px solid #fca5a5;">${e.notes || '-'}</td>
              <td style="padding:5px;border:1px solid #fca5a5;">${e.requiredAction || '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('') : '';

  const rows = data.map((e: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};">
      <td style="padding:6px 5px;text-align:center;font-size:10px;border:1px solid #e2e8f0;">${i + 1}</td>
      <td style="padding:6px 5px;text-align:center;font-family:monospace;direction:ltr;font-size:10px;border:1px solid #e2e8f0;">${e.nationalNumber}</td>
      <td style="padding:6px 5px;font-size:10px;border:1px solid #e2e8f0;font-weight:500;">${e.fullName}</td>
      <td style="padding:6px 5px;font-size:10px;border:1px solid #e2e8f0;text-align:center;">${e.jobGrade || '-'}</td>
      <td style="padding:6px 5px;font-size:10px;border:1px solid #e2e8f0;text-align:center;">${e.qualification || '-'}</td>
      <td style="padding:6px 5px;font-size:10px;border:1px solid #e2e8f0;text-align:center;">${e.bankName || '-'}</td>
      <td style="padding:6px 5px;text-align:center;font-size:10px;border:1px solid #e2e8f0;">${e.status || '-'}</td>
      <td style="padding:6px 5px;text-align:center;font-size:10px;border:1px solid #e2e8f0;">${e.dataComplete || '-'}</td>
      <td style="padding:6px 5px;text-align:center;font-size:10px;border:1px solid #e2e8f0;color:#ef4444;font-weight:bold;">${missingFn(e)}</td>
    </tr>`).join('');

  w.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>ملخص بيانات الموظفين</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#1e293b;margin:0;padding:25px;font-size:11px;background:#fff;}
        table{width:100%;border-collapse:collapse;margin-bottom:15px;}
        thead th{background:#1e3a8a;color:white;padding:8px 5px;font-size:10px;border:1px solid #1e3a8a;}
        .summary-header{background:#f1f5f9;border:1px solid #e2e8f0;padding:15px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;}
        .summary-title{margin:0;color:#1e3a8a;font-size:16px;font-weight:bold;}
        .summary-meta{font-size:11px;color:#64748b;text-align:left;}
        .footer{text-align:center;margin-top:30px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;}
        @media print{
          .no-print{display:none!important;}
          body{padding:10px;}
          thead{display:table-header-group;}
          tr{page-break-inside:avoid;}
        }
      </style>
    </head>
    <body>
      ${getHeaderHTML()}
      <div class="summary-header">
        <div>
          <h2 class="summary-title">ملخص بيانات الموظفين</h2>
          <p style="margin:5px 0 0;font-size:11px;color:#64748b;">ديوان المنطقة الغربية - قاعدة البيانات</p>
        </div>
        <div class="summary-meta">
          <div>تاريخ التقرير: <b>${dt}</b></div>
          <div>عدد الموظفين في القائمة: <b>${data.length}</b></div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>الرقم الوطني</th>
            <th>الاسم</th>
            <th>الدرجة</th>
            <th>المؤهل</th>
            <th>المصرف</th>
            <th>الحالة</th>
            <th>البيانات</th>
            <th>النواقص</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${alertHTML}
      
      ${getFooterHTML()}
      
      <button class="no-print" onclick="window.print()" style="position:fixed;bottom:25px;left:25px;padding:12px 30px;background:#1e3a8a;color:white;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:bold;box-shadow:0 4px 15px rgba(30,58,138,0.3);font-family:Tahoma;">🖨️ تنفيذ الطباعة</button>
      <script>
        // Auto print hint
        console.log("تقرير جاهز للطباعة");
      </script>
    </body>
    </html>
  `);
  w.document.close();
}

export function exportCSV(data: any[], filename: string, customFields: any[], missingFn: (e: any) => number) {
  const headers = ["الرقم الوطني", "الاسم رباعي", "الرقم الوظيفي", "الدرجة الوظيفية", "المؤهل العلمي", "التخصص", "المصرف", "رقم الحساب (IBAN)", "رقم قرار التعيين", "تاريخ المباشرة", "رقم الهاتف", "الحالة", "اكتمال البيانات", "عدد النواقص", "الإدارة", "القسم", "الجنس", ...customFields.map((cf: any) => cf.label)];
  const rows = data.map((e: any) => [e.nationalNumber, e.fullName, e.jobNumber, e.jobGrade, e.qualification, e.specialization, e.bankName, e.iban, e.appointmentDecision, e.startDate, e.phone, e.status, e.dataComplete, String(missingFn(e)), e.department, e.section, e.gender, ...customFields.map((cf: any) => e[cf.key] || "")]);
  const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
