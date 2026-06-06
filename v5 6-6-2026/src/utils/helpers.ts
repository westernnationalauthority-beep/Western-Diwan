import { getCustomFields, getRequiredFieldsConfig, addCustomField } from "../lib/storage";

export const NACC_LOGO = "/images/nacc-logo.png";
export const LIBYA_FLAG = "/images/libya-flag.png";
export const SYSTEM_NAME = "S-BUTTO";

export function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[^\d]/g, "").trim();
  if (p.startsWith("0")) p = "218" + p.slice(1);
  if (!p.startsWith("218")) p = "218" + p;
  return p;
}

export function openWhatsApp(phone: string, message: string) {
  window.open(`https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(message)}`, "_blank");
}

export function sendCodeViaWhatsApp(phone: string, name: string, code: string) {
  openWhatsApp(phone, `السلام عليكم\nالأستاذ/ة: ${name}\n\nكود الدخول الخاص بك:\n🔐 ${code}\n\n⚠️ يرجى عدم مشاركة هذا الكود.\nمنظومة ${SYSTEM_NAME}`);
}

export function sendMissingFieldsViaWhatsApp(phone: string, name: string, missingFields: string[]) {
  openWhatsApp(phone, `السلام عليكم\nالأستاذ/ة: ${name}\n\n⚠️ بياناتك غير مكتملة:\n${missingFields.map((f,i)=>`${i+1}. ${f}`).join("\n")}\n\nمنظومة ${SYSTEM_NAME}`);
}

export const ALL_FIELD_LABELS: Record<string, string> = {
  fullName: "الاسم رباعي", nationalNumber: "الرقم الوطني", jobNumber: "الرقم الوظيفي",
  jobGrade: "الدرجة الوظيفية", qualification: "المؤهل العلمي", specialization: "التخصص",
  grade: "التقدير", qualificationOrigin: "أصل المؤهل / مكان الحصول",
  bankName: "اسم المصرف", iban: "رقم الحساب الدولي (IBAN)",
  appointmentDecision: "رقم قرار التعيين", startDate: "تاريخ المباشرة",
  promotionDate: "تاريخ آخر ترقية", phone: "رقم الهاتف",
  department: "الإدارة", section: "القسم",
  gender: "الجنس", receivesPension: "يتقاضى معاش", status: "الحالة",
  dataComplete: "اكتمال البيانات", jobStatus: "الحالة الوظيفية",
  employmentType: "نوع التوظيف", notes: "ملاحظات", requiredAction: "الإجراء المطلوب",
};

export const isEmpty = (v: string | undefined): boolean => {
  if (!v) return true;
  const t = v.trim();
  if (!t || t === "-") return true;
  if (t === "تحت الاجراء" || t === "تحت الإجراء") return true;
  return false;
};

export function getMissingFields(emp: any): string[] {
  const config = getRequiredFieldsConfig();
  const customFields = getCustomFields();
  const missing: string[] = [];
  Object.entries(ALL_FIELD_LABELS).forEach(([key, label]) => {
    if (config[key] && isEmpty(emp[key])) missing.push(label);
  });
  customFields.forEach((cf) => {
    if (cf.isRequired && isEmpty(emp[cf.label] || emp[cf.key])) missing.push(cf.label);
  });
  return missing;
}

const STANDARD_EMPLOYEE_KEYS = new Set([
  "timestamp", "nationalNumber", "jobNumber", "fullName", "bankName", "iban",
  "jobGrade", "qualification", "specialization", "qualificationOrigin", "grade",
  "appointmentDecision", "startDate", "promotionDate", "phone", "receivesPension",
  "status", "notes", "requiredAction", "department", "section", "jobStatus",
  "employmentType", "dataComplete", "gender",
]);

function getDetectedSheetColumns(employees: any[]): string[] {
  const labels = new Set<string>();
  employees.forEach((emp) => {
    Object.keys(emp || {}).forEach((key) => {
      if (!STANDARD_EMPLOYEE_KEYS.has(key) && key.trim()) labels.add(key.trim());
    });
  });
  return Array.from(labels);
}

export function syncCustomFieldsFromSheet(employees: any[]): void {
  const detectedLabels = getDetectedSheetColumns(employees);
  if (detectedLabels.length === 0) return;
  const existing = getCustomFields().map((f) => f.label);
  detectedLabels.forEach((label) => {
    if (!existing.includes(label)) addCustomField(label, "sheet-sync", false);
  });
}

export function getStatusBadge(s: string): string {
  switch (s) {
    case "مستوفي": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ناقص": return "bg-amber-100 text-amber-800 border-amber-200";
    case "تحت الاجراء": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getDataCompleteBadge(v: string): string {
  if (v === "نعم مكتملة") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "غير مكتملة") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

export function getActionBadge(action: string): string {
  if (action === "login") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (action === "logout") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (action.startsWith("print")) return "bg-slate-100 text-slate-700 border border-slate-200";
  if (action === "export_csv") return "bg-cyan-100 text-cyan-700 border border-cyan-200";
  if (action === "view_employee") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (action === "edit_employee" || action === "save_employee") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (action === "public_search" || action === "share_employee") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (action.includes("user") || action === "change_password" || action.includes("permission")) return "bg-violet-100 text-violet-700 border border-violet-200";
  if (action.includes("field")) return "bg-cyan-100 text-cyan-700 border border-cyan-200";
  return "bg-gray-100 text-gray-700 border border-gray-200";
}
