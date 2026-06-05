export interface Employee {
  timestamp: string;
  nationalNumber: string;
  jobNumber: string;
  fullName: string;
  bankName: string;
  iban: string;
  jobGrade: string;
  qualification: string;
  specialization: string;
  qualificationOrigin: string;
  grade: string;
  appointmentDecision: string;
  startDate: string;
  promotionDate: string;
  phone: string;
  receivesPension: string;
  status: string;
  notes: string;
  requiredAction: string;
  department: string;
  section: string;
  jobStatus: string;
  employmentType: string;
  dataComplete: string;
  gender: string;
}

export const API_URL = "https://script.google.com/macros/s/AKfycbz84p_VM_kkQ5oLVF5HljdJovCFy-winENuYRVEpBGqwfMFgzEXyS9JSH1S75zYw88SYg/exec";
export const INITIAL_CODE = "NACC2026";

/* ============================================================
   Employee Login API
   ============================================================ */
export interface EmployeeLoginResult {
  status: "success" | "wrong_code" | "blocked" | "expired" | "not_found" | "error";
  message?: string;
  fullName?: string;
  isComplete?: boolean;
  missing?: string[];
  personalCode?: string;
  expiry?: string;
  codeType?: string;
}

/**
 * تسجيل دخول الموظف عبر GET request للحصول على الرد من Apps Script
 * نستخدم GET لأن POST مع no-cors لا يسمح بقراءة الرد
 */
export async function employeeLogin(nationalNumber: string, code: string): Promise<EmployeeLoginResult> {
  try {
    const url = `${API_URL}?action=employee_login&nn=${encodeURIComponent(nationalNumber)}&code=${encodeURIComponent(code)}&t=${Date.now()}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("Login error:", e);
    return { status: "error", message: "فشل الاتصال بالخادم. حاول مرة أخرى." };
  }
}

// Simulate login client-side using raw sheet data (fallback for no-cors)
// @ts-ignore - kept for potential fallback use
function simulateLogin(rawData: any[][], nationalNumber: string, code: string): EmployeeLoginResult {
  const nn = nationalNumber.replace(/[^\d]/g, "").trim();
  if (!rawData || rawData.length < 2) return { status: "error", message: "لا توجد بيانات" };
  const headers = rawData[0];
  const nationalCol = 1; // Column B

  const emp = rawData.slice(1).find((row) => row[nationalCol]?.toString().replace(/[^\d]/g, "").trim() === nn);
  if (!emp) return { status: "not_found", message: "الرقم الوطني غير موجود في المنظومة" };

  const fullName = emp[3] || "";
  const requiredFields = [
    "الرقم الوظيفي", "أسـمـ المصرف", "رقم الحساب الدولي / الايبان",
    "الدرجة الوظيفية الحالية", "التخصص", "رقم قرار التعيين او قرار النقل / السنة",
    "تاريخ مباشرة العمل", "رقم الهاتف",
  ];
  const missing: string[] = [];
  requiredFields.forEach((field) => {
    const idx = headers.indexOf(field);
    if (idx > -1) {
      const val = (emp[idx] || "").toString().trim();
      if (!val || val === "-" || val === "تحت الاجراء") missing.push(field);
    }
  });

  return {
    status: "success",
    fullName,
    isComplete: missing.length === 0,
    missing,
    personalCode: code,
    expiry: "",
    codeType: "",
  };
}

export async function generateEmployeeCode(nationalNumber: string, codeType = "شخصي"): Promise<{ status: string; code?: string; expiry?: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "generate_code", nationalNumber, codeType }),
    });
    return { status: "success", message: "تم إرسال طلب توليد الكود" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function unblockEmployee(nationalNumber: string): Promise<{ status: string; code?: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "unblock", nationalNumber }),
    });
    return { status: "success", message: "تم إرسال طلب فك الحجب" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

/* ============================================================
   نظام طلبات الحذف والأرشيف
   ============================================================ */
export interface DeleteRequest {
  refNum: string;
  nationalNumber: string;
  employeeName: string;
  reason: string;
  docNumber: string;
  docDate: string;
  submitDate: string;
  submittedBy: string;
  status: string;
  adminNote: string;
  adminDate: string;
}

export async function requestEmployeeDelete(data: {
  nationalNumber: string;
  employeeName: string;
  reason: string;
  docNumber?: string;
  docDate?: string;
  submittedBy: string;
}): Promise<{ status: string; message?: string; refNum?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "request_delete", ...data }),
    });
    return { status: "success", message: "تم إرسال طلب الحذف بنجاح" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function getDeleteRequests(): Promise<DeleteRequest[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_delete_requests&t=${Date.now()}`);
    const data = await res.json();
    if (data.status === "success") return data.requests || [];
    return [];
  } catch {
    return [];
  }
}

export async function approveDeleteRequest(refNum: string, adminNote: string, adminName: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "approve_delete", refNum, adminNote, adminName }),
    });
    return { status: "success", message: "تم الموافقة على الطلب" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function rejectDeleteRequest(refNum: string, adminNote: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "reject_delete", refNum, adminNote }),
    });
    return { status: "success", message: "تم رفض الطلب" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function getArchivedEmployees(): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_archive&t=${Date.now()}`);
    const data = await res.json();
    if (data.status === "success") return data.archived || [];
    return [];
  } catch {
    return [];
  }
}

export async function restoreEmployeeFromArchive(nationalNumber: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "restore_archive", nationalNumber }),
    });
    return { status: "success", message: "تم استعادة الموظف بنجاح" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export const DELETE_REASONS = [
  "نقل لجهة أخرى",
  "استقالة",
  "تقاعد",
  "وفاة",
  "فصل",
  "انتهاء عقد",
  "أخرى",
];

export async function cleanArchive(months: number): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "clean_archive", months }),
    });
    return { status: "success", message: "تم إرسال طلب تنظيف الأرشيف" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function cleanDeleteRequests(months: number, onlyProcessed: boolean = true): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, {
      method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "clean_delete_requests", months, onlyProcessed }),
    });
    return { status: "success", message: "تم إرسال طلب تنظيف الطلبات القديمة" };
  } catch {
    return { status: "error", message: "فشل الاتصال" };
  }
}

export async function fetchEmployeesFromSheet(): Promise<Employee[]> {
  // Add a timestamp to bypass Google's cache and always get fresh data
  const cacheBuster = `?t=${Date.now()}`;
  const response = await fetch(API_URL + cacheBuster, { cache: "no-store" });
  const data = await response.json();
  
  const headers: string[] = data[0] || [];
  
  // The first row is headers, skip it
  return data.slice(1).map((row: any[]) => {
    const getVal = (idx: number): string => {
      if (row[idx] === null || row[idx] === undefined) return "";
      return String(row[idx]);
    };

    const emp: any = {
      timestamp: getVal(0),
      nationalNumber: getVal(1).replace(/[^\d]/g, ""),
      jobNumber: getVal(2),
      fullName: getVal(3).trim(),
      bankName: getVal(4),
      iban: getVal(5),
      jobGrade: getVal(6).trim(),
      qualification: getVal(7).trim(),
      specialization: getVal(8).trim(),
      qualificationOrigin: getVal(9).trim(),
      grade: getVal(10).trim(),
      appointmentDecision: getVal(11).trim(),
      startDate: getVal(12).trim(),
      promotionDate: getVal(13).trim(),
      phone: getVal(14).trim(),
      receivesPension: getVal(15).trim(),
      status: getVal(16).trim(),
      notes: getVal(17).trim(),
      requiredAction: getVal(18).trim(),
      department: getVal(19).trim(),
      section: getVal(20).trim(),
      jobStatus: getVal(21).trim(),
      employmentType: getVal(22).trim(),
      dataComplete: getVal(23).trim(),
      gender: getVal(24).trim(),
    };

    // Read any extra columns (custom fields) beyond the 25 standard columns
    for (let i = 25; i < headers.length; i++) {
      if (headers[i]) {
        emp[headers[i]] = getVal(i).trim();
      }
    }

    return emp;
  });
}

export async function updateEmployeeInSheet(nationalNumber: string, updates: Record<string, string>): Promise<boolean> {
  return sendAction({ action: "update", nationalNumber, updates });
}

export async function deleteEmployeeFromSheet(nationalNumber: string): Promise<boolean> {
  return sendAction({ action: "delete", nationalNumber });
}

export async function addEmployeeToSheet(employee: Partial<Employee>): Promise<boolean> {
  return sendAction({ action: "add", employee });
}

export async function addColumnToSheet(columnName: string): Promise<boolean> {
  return sendAction({ action: "add_column", columnName });
}

export async function deleteColumnFromSheet(columnName: string): Promise<boolean> {
  return sendAction({ action: "delete_column", columnName });
}

async function sendAction(payload: any): Promise<boolean> {
  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (error) {
    console.error("Action failed:", error);
    return false;
  }
}
