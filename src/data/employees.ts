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
  branch: string;      // ✅ الفرع - جديد
  department: string;  // الإدارة
  section: string;     // القسم
  jobStatus: string;
  employmentType: string;
  dataComplete: string;
  gender: string;
}

export const API_URL = "https://script.google.com/macros/s/AKfycbwVhs0wu_ddNOC58MkPDl1SvC5_jo8I9YGYSebHf4k6y68Lnj9nEDOUAOk1RKiRrr5P/exec";
export const INITIAL_CODE = "NACC2026";

/* ============================================================
   Cache System
   ============================================================ */
const CACHE_KEY = "sbutto_employees_cache";
const CACHE_TTL = 5 * 60 * 1000;

interface CacheData { employees: Employee[]; timestamp: number; }

function saveToCache(employees: Employee[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ employees, timestamp: Date.now() })); } catch {}
}

function loadFromCache(): Employee[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data.employees;
  } catch { return null; }
}

export function clearEmployeesCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

export function getCacheAge(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    const ageMs = Date.now() - data.timestamp;
    const ageMins = Math.floor(ageMs / 60000);
    const ageSecs = Math.floor((ageMs % 60000) / 1000);
    return ageMins > 0 ? `${ageMins} دقيقة` : `${ageSecs} ثانية`;
  } catch { return null; }
}

/* ============================================================
   Employee Login
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

export async function employeeLogin(nationalNumber: string, code: string): Promise<EmployeeLoginResult> {
  try {
    const url = `${API_URL}?action=employee_login&nn=${encodeURIComponent(nationalNumber)}&code=${encodeURIComponent(code)}&t=${Date.now()}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error("Network error");
    return await res.json();
  } catch {
    return { status: "error", message: "فشل الاتصال بالخادم. حاول مرة أخرى." };
  }
}

export async function generateEmployeeCode(nationalNumber: string, codeType = "شخصي"): Promise<{ status: string; code?: string; expiry?: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "generate_code", nationalNumber, codeType }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function unblockEmployee(nationalNumber: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "unblock", nationalNumber }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

/* ============================================================
   Delete Requests & Archive
   ============================================================ */
export interface DeleteRequest {
  refNum: string; nationalNumber: string; employeeName: string;
  reason: string; docNumber: string; docDate: string;
  submitDate: string; submittedBy: string; status: string;
  adminNote: string; adminDate: string;
}

export async function requestEmployeeDelete(data: { nationalNumber: string; employeeName: string; reason: string; docNumber?: string; docDate?: string; submittedBy: string; }): Promise<{ status: string; message?: string; refNum?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "request_delete", ...data }) });
    return { status: "success", message: "تم إرسال طلب الحذف بنجاح" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function getDeleteRequests(): Promise<DeleteRequest[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_delete_requests&t=${Date.now()}`);
    const data = await res.json();
    return data.status === "success" ? data.requests || [] : [];
  } catch { return []; }
}

export async function approveDeleteRequest(refNum: string, adminNote: string, adminName: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "approve_delete", refNum, adminNote, adminName }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function rejectDeleteRequest(refNum: string, adminNote: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "reject_delete", refNum, adminNote }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function getArchivedEmployees(): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_archive&t=${Date.now()}`);
    const data = await res.json();
    return data.status === "success" ? data.archived || [] : [];
  } catch { return []; }
}

export async function restoreEmployeeFromArchive(nationalNumber: string): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "restore_archive", nationalNumber }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export const DELETE_REASONS = ["نقل لجهة أخرى","استقالة","تقاعد","وفاة","فصل","انتهاء عقد","أخرى"];

export async function cleanArchive(months: number): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "clean_archive", months }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function cleanDeleteRequests(months: number, onlyProcessed = true): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "clean_delete_requests", months, onlyProcessed }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

export async function permanentDeleteFromArchive(nationalNumber: string, adminNote = "", adminName = ""): Promise<{ status: string; message?: string }> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "permanent_delete_archive", nationalNumber, adminNote, adminName }) });
    return { status: "success" };
  } catch { return { status: "error", message: "فشل الاتصال" }; }
}

/* ============================================================
   parseEmployees - يقرأ الفرع تلقائياً من الـ headers
   ============================================================ */
function parseEmployees(data: unknown[][]): Employee[] {
  const headers: string[] = (data[0] as string[]) || [];

  return data.slice(1).map((row: unknown[]) => {
    const getVal = (idx: number): string => {
      if (idx < 0 || row[idx] === null || row[idx] === undefined) return "";
      return String(row[idx]);
    };

    const emp: Record<string, string> = {
      timestamp:           getVal(0),   // A
      nationalNumber:      getVal(1).replace(/[^\d]/g, ""), // B
      jobNumber:           getVal(2),   // C
      fullName:            getVal(3).trim(),  // D
      bankName:            getVal(4),   // E
      iban:                getVal(5),   // F
      jobGrade:            getVal(6).trim(),  // G
      qualification:       getVal(7).trim(),  // H
      specialization:      getVal(8).trim(),  // I
      qualificationOrigin: getVal(9).trim(),  // J
      grade:               getVal(10).trim(), // K
      appointmentDecision: getVal(11).trim(), // L
      startDate:           getVal(12).trim(), // M
      promotionDate:       getVal(13).trim(), // N
      phone:               getVal(14).trim(), // O
      receivesPension:     getVal(15).trim(), // P
      status:              getVal(16).trim(), // Q
      notes:               getVal(17).trim(), // R
      requiredAction:      getVal(18).trim(), // S
      branch:              getVal(19).trim(), // T ← الفرع
      department:          getVal(20).trim(), // U ← الإدارة
      section:             getVal(21).trim(), // V ← القسم
      jobStatus:           getVal(22).trim(), // W
      employmentType:      getVal(23).trim(), // X
      dataComplete:        getVal(24).trim(), // Y
      gender:              getVal(25).trim(), // Z ← الجنس
    };

    // الحقول المخصصة الإضافية تبدأ من بعد Z (index 26)
    for (let i = 26; i < headers.length; i++) {
      const header = (headers[i] || "").trim();
      if (header) emp[header] = getVal(i).trim();
    }

    return emp as unknown as Employee;
  });
}

export async function fetchEmployeesFromSheet(forceRefresh = false): Promise<Employee[]> {
  if (!forceRefresh) {
    const cached = loadFromCache();
    if (cached) {
      fetch(API_URL, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => saveToCache(parseEmployees(data)))
        .catch(() => {});
      return cached;
    }
  }
  const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
  const data = await response.json();
  const employees = parseEmployees(data);
  saveToCache(employees);
  return employees;
}

export async function updateEmployeeInSheet(nationalNumber: string, updates: Record<string, string>): Promise<boolean> {
  clearEmployeesCache();
  return sendAction({ action: "update", nationalNumber, updates });
}

export async function deleteEmployeeFromSheet(nationalNumber: string): Promise<boolean> {
  clearEmployeesCache();
  return sendAction({ action: "delete", nationalNumber });
}

export async function addEmployeeToSheet(employee: Partial<Employee>): Promise<boolean> {
  clearEmployeesCache();
  return sendAction({ action: "add", employee });
}

export async function addColumnToSheet(columnName: string): Promise<boolean> {
  return sendAction({ action: "add_column", columnName });
}

export async function deleteColumnFromSheet(columnName: string): Promise<boolean> {
  return sendAction({ action: "delete_column", columnName });
}

async function sendAction(payload: Record<string, unknown>): Promise<boolean> {
  try {
    await fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
    return true;
  } catch { return false; }
}
