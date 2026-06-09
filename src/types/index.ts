// ============================================================
// UTILS - دوال مساعدة منظمة حسب الوظيفة
// ============================================================

import { type Employee } from "../data/employees";
import { getCustomFields, getRequiredFieldsConfig, addCustomField } from "../lib/storage";
import { ALL_FIELD_LABELS, STANDARD_EMPLOYEE_KEYS } from "../constants";

// ──────────────────────────────────────────────
// كود الدخول العشوائي
// ──────────────────────────────────────────────
export function generateRandomCode(): string {
  // نستبعد الأحرف المتشابهة بصرياً (I, O, 1, 0)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ──────────────────────────────────────────────
// واتساب
// ──────────────────────────────────────────────
export function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[^\d]/g, "").trim();
  if (p.startsWith("0")) p = "218" + p.slice(1);
  if (!p.startsWith("218")) p = "218" + p;
  return p;
}

export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, "_blank");
}

const SIGNATURE = `منظومة S-BUTTO\nالهيئة الوطنية لمكافحة الفساد\nديوان المنطقة الغربية`;

export function sendCodeViaWhatsApp(phone: string, name: string, code: string): void {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

كود الدخول الخاص بك لمنظومة بيانات الموظفين:

🔐 ${code}

⚠️ يرجى عدم مشاركة هذا الكود مع أي شخص.
صالح لمدة 3 أشهر من تاريخ آخر استخدام.

${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

export function sendMissingFieldsViaWhatsApp(
  phone: string,
  name: string,
  missingFields: string[]
): void {
  const fieldsList = missingFields.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

⚠️ بياناتك في منظومة الموظفين غير مكتملة.
يرجى مراجعة الإدارة لاستكمال البيانات التالية:

${fieldsList}

📍 ديوان المنطقة الغربية
${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

export function sendGeneralWhatsApp(phone: string, name: string, message: string): void {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

${message}

${SIGNATURE}`;
  openWhatsApp(phone, msg);
}

// ──────────────────────────────────────────────
// الحقول الناقصة
// ──────────────────────────────────────────────
export function isEmpty(v: string | undefined): boolean {
  if (!v) return true;
  const t = v.trim();
  if (!t || t === "-") return true;
  if (t === "تحت الاجراء" || t === "تحت الإجراء") return true;
  return false;
}

export function getMissingFields(emp: Employee): string[] {
  const config = getRequiredFieldsConfig();
  const customFields = getCustomFields();
  const missing: string[] = [];

  Object.entries(ALL_FIELD_LABELS).forEach(([key, label]) => {
    if (config[key] && isEmpty((emp as Record<string, string>)[key])) {
      missing.push(label);
    }
  });

  customFields.forEach((cf) => {
    if (cf.isRequired && isEmpty((emp as Record<string, string>)[cf.label] || (emp as Record<string, string>)[cf.key])) {
      missing.push(cf.label);
    }
  });

  return missing;
}

// ──────────────────────────────────────────────
// مزامنة الحقول المخصصة من Google Sheets
// ──────────────────────────────────────────────
export function getDetectedSheetColumns(employees: Employee[]): string[] {
  const labels = new Set<string>();
  employees.forEach((emp) => {
    Object.keys(emp || {}).forEach((key) => {
      if (!STANDARD_EMPLOYEE_KEYS.has(key) && key.trim()) {
        labels.add(key.trim());
      }
    });
  });
  return Array.from(labels);
}

export function syncCustomFieldsFromSheet(employees: Employee[]): void {
  const detectedLabels = getDetectedSheetColumns(employees);
  if (detectedLabels.length === 0) return;
  const existing = getCustomFields().map((f) => f.label);
  detectedLabels.forEach((label) => {
    if (!existing.includes(label)) {
      addCustomField(label, "sheet-sync", false);
    }
  });
}

// ──────────────────────────────────────────────
// تصدير CSV
// ──────────────────────────────────────────────
export function exportCSV(data: Employee[], filename: string): void {
  const customFields = getCustomFields();
  const headers = [
    "الرقم الوطني", "الاسم رباعي", "الرقم الوظيفي", "الدرجة الوظيفية",
    "المؤهل العلمي", "التخصص", "المصرف", "رقم الحساب (IBAN)",
    "رقم قرار التعيين", "تاريخ المباشرة", "رقم الهاتف",
    "الحالة", "اكتمال البيانات", "عدد النواقص", "الإدارة", "القسم", "الجنس",
    ...customFields.map((cf) => cf.label),
  ];

  const rows = data.map((e) => {
    const emp = e as Record<string, string>;
    return [
      emp.nationalNumber, emp.fullName, emp.jobNumber, emp.jobGrade,
      emp.qualification, emp.specialization, emp.bankName, emp.iban,
      emp.appointmentDecision, emp.startDate, emp.phone,
      emp.status, emp.dataComplete, String(getMissingFields(e).length),
      emp.department, emp.section, emp.gender,
      ...customFields.map((cf) => emp[cf.key] || ""),
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  // BOM لدعم العربية في Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
