// ============================================================
// CONSTANTS - الثوابت العامة للمنظومة
// ============================================================

export const NACC_LOGO = "/images/nacc-logo.png";
export const LIBYA_FLAG = "/images/libya-flag.png";
export const SYSTEM_NAME = "S-BUTTO";
export const INIT_CODE = "NACC2026";
export const MAX_LOGIN_ATTEMPTS = 3;

export const ALL_FIELD_LABELS: Record<string, string> = {
  fullName: "الاسم رباعي",
  nationalNumber: "الرقم الوطني",
  jobNumber: "الرقم الوظيفي",
  jobGrade: "الدرجة الوظيفية",
  qualification: "المؤهل العلمي",
  specialization: "التخصص",
  grade: "التقدير",
  qualificationOrigin: "أصل المؤهل / مكان الحصول",
  bankName: "اسم المصرف",
  iban: "رقم الحساب الدولي (IBAN)",
  appointmentDecision: "رقم قرار التعيين",
  startDate: "تاريخ المباشرة",
  promotionDate: "تاريخ آخر ترقية",
  phone: "رقم الهاتف",
  department: "الإدارة",
  section: "القسم",
  gender: "الجنس",
  receivesPension: "يتقاضى معاش",
  status: "الحالة",
  dataComplete: "اكتمال البيانات",
  jobStatus: "الحالة الوظيفية",
  employmentType: "نوع التوظيف",
  notes: "ملاحظات",
  requiredAction: "الإجراء المطلوب",
};

export const STANDARD_EMPLOYEE_KEYS = new Set([
  "timestamp", "nationalNumber", "jobNumber", "fullName", "bankName", "iban",
  "jobGrade", "qualification", "specialization", "qualificationOrigin", "grade",
  "appointmentDecision", "startDate", "promotionDate", "phone", "receivesPension",
  "status", "notes", "requiredAction", "department", "section", "jobStatus",
  "employmentType", "dataComplete", "gender",
]);
