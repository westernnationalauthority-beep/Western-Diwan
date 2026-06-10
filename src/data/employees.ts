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

export const API_URL = "https://script.google.com/macros/s/AKfycbz84p_VM_kkQ5oLVF5HljdJovCFy-winENuYRVEpBGqwfMFgzEXyS9JSH1S75zYw88SYg/exec";
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
  const r = await postAction({ action: "generate_code", nationalNumber, codeType });
  const d = (r.data || {}) as { code?: string; expiry?: string };
  return r.ok
    ? { status: "success", code: d.code, expiry: d.expiry }
    : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function unblockEmployee(nationalNumber: string): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "unblock", nationalNumber });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
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
  const r = await postAction({ action: "request_delete", ...data });
  const d = (r.data || {}) as { refNum?: string };
  return r.ok
    ? { status: "success", message: "تم إرسال طلب الحذف بنجاح", refNum: d.refNum }
    : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function getDeleteRequests(): Promise<DeleteRequest[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_delete_requests&t=${Date.now()}`);
    const data = await res.json();
    return data.status === "success" ? data.requests || [] : [];
  } catch { return []; }
}

export async function approveDeleteRequest(refNum: string, adminNote: string, adminName: string): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "approve_delete", refNum, adminNote, adminName });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function rejectDeleteRequest(refNum: string, adminNote: string): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "reject_delete", refNum, adminNote });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function getArchivedEmployees(): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(`${API_URL}?action=get_archive&t=${Date.now()}`);
    const data = await res.json();
    return data.status === "success" ? data.archived || [] : [];
  } catch { return []; }
}

export async function restoreEmployeeFromArchive(nationalNumber: string): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "restore_archive", nationalNumber });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

export const DELETE_REASONS = ["نقل لجهة أخرى","استقالة","تقاعد","وفاة","فصل","انتهاء عقد","أخرى"];

export async function cleanArchive(months: number): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "clean_archive", months });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function cleanDeleteRequests(months: number, onlyProcessed = true): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "clean_delete_requests", months, onlyProcessed });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

export async function permanentDeleteFromArchive(nationalNumber: string, adminNote = "", adminName = ""): Promise<{ status: string; message?: string }> {
  const r = await postAction({ action: "permanent_delete_archive", nationalNumber, adminNote, adminName });
  return r.ok ? { status: "success" } : { status: "error", message: r.message || "فشل الاتصال" };
}

/* ============================================================
   parseEmployees - يقرأ الفرع تلقائياً من الـ headers
   ============================================================ */
function parseEmployees(data: unknown): Employee[] {
  // حماية: يجب أن تكون البيانات مصفوفة صفوف صالحة
  if (!Array.isArray(data) || data.length === 0) return [];

  const headers: string[] = Array.isArray(data[0]) ? (data[0] as string[]) : [];

  return data
    .slice(1)
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row: unknown[]) => {
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
    })
    // تجاهل الصفوف الفارغة تماماً (لا رقم وطني ولا اسم)
    .filter((emp) => emp.nationalNumber !== "" || emp.fullName !== "");
}

export async function fetchEmployeesFromSheet(forceRefresh = false): Promise<Employee[]> {
  if (!forceRefresh) {
    const cached = loadFromCache();
    if (cached) {
      // تحديث في الخلفية — لا نكتب على الكاش إلا إذا وصلت بيانات صالحة
      fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => {
          const fresh = parseEmployees(data);
          if (fresh.length > 0) saveToCache(fresh);
        })
        .catch(() => { /* نُبقي الكاش الحالي عند فشل التحديث الخلفي */ });
      return cached;
    }
  }
  const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`فشل جلب البيانات (HTTP ${response.status})`);
  const data = await response.json();
  const employees = parseEmployees(data);
  if (employees.length > 0) saveToCache(employees);
  return employees;
}

export async function updateEmployeeInSheet(nationalNumber: string, updates: Record<string, string>): Promise<ActionResult> {
  const result = await postAction({ action: "update", nationalNumber, updates });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function deleteEmployeeFromSheet(nationalNumber: string): Promise<ActionResult> {
  const result = await postAction({ action: "delete", nationalNumber });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function addEmployeeToSheet(employee: Partial<Employee>): Promise<ActionResult> {
  const result = await postAction({ action: "add", employee });
  if (result.ok) clearEmployeesCache();
  return result;
}

export async function addColumnToSheet(columnName: string): Promise<ActionResult> {
  return postAction({ action: "add_column", columnName });
}

export async function deleteColumnFromSheet(columnName: string): Promise<ActionResult> {
  return postAction({ action: "delete_column", columnName });
}

/* ============================================================
   POST helper - يقرأ استجابة الخادم الحقيقية (بدون no-cors)
   ملاحظة: نستخدم Content-Type: text/plain لتجنّب preflight،
   وهذا طلب "بسيط" يمكن قراءة استجابته عبر النطاقات.
   ============================================================ */
export interface ActionResult {
  ok: boolean;
  status?: string;
  message?: string;
  data?: unknown;
}

async function postAction(payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      return { ok: false, message: `فشل الخادم (HTTP ${res.status})` };
    }

    // قد يعيد Apps Script نصاً أو JSON — نحاول تحليله بأمان
    const text = await res.text();
    if (!text) return { ok: true };

    try {
      const json = JSON.parse(text);
      const status = json.status as string | undefined;
      const ok = status === undefined ? true : status === "success" || status === "ok";
      return { ok, status, message: json.message, data: json };
    } catch {
      // استجابة غير JSON: نعتبرها نجاحاً فقط إذا لم تحوِ كلمة خطأ
      const looksLikeError = /error|fail|خطأ|فشل/i.test(text);
      return { ok: !looksLikeError, message: looksLikeError ? text.slice(0, 200) : undefined };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "فشل الاتصال بالخادم" };
  }
}
