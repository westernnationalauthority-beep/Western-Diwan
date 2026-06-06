// Storage helpers for users, sessions, activity logs, employee edits, custom fields
import type { Employee } from "../data/employees";

/* ============== PERMISSIONS ============== */
export interface Permissions {
  canView: boolean;
  canEdit: boolean;
  canPrint: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canViewLogs: boolean;
  canAddFields: boolean;
  canRequestDelete: boolean;
  canApproveDelete: boolean;
  canViewArchive: boolean;
  canRestoreArchive: boolean;
}

export const ADMIN_PERMISSIONS: Permissions = {
  canView: true, canEdit: true, canPrint: true, canExport: true,
  canManageUsers: true, canViewLogs: true, canAddFields: true,
  canRequestDelete: true, canApproveDelete: true, canViewArchive: true, canRestoreArchive: true,
};

export const DEFAULT_EMPLOYEE_PERMISSIONS: Permissions = {
  canView: true, canEdit: false, canPrint: true, canExport: false,
  canManageUsers: false, canViewLogs: false, canAddFields: false,
  canRequestDelete: false, canApproveDelete: false, canViewArchive: false, canRestoreArchive: false,
};

export const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  canView: "عرض بيانات الموظفين",
  canEdit: "تعديل وحفظ البيانات",
  canPrint: "طباعة النماذج",
  canExport: "تصدير CSV",
  canManageUsers: "إدارة المستخدمين",
  canViewLogs: "عرض سجل النشاطات",
  canAddFields: "إضافة حقول مخصصة",
  canRequestDelete: "طلب حذف موظف",
  canApproveDelete: "الموافقة على طلبات الحذف",
  canViewArchive: "عرض أرشيف الموظفين",
  canRestoreArchive: "استعادة موظف من الأرشيف",
};

/* ============== USER ============== */
export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: "admin" | "employee";
  permissions: Permissions;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

/* ============== ACTIVITY LOG ============== */
export interface ActivityLog {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  role: "admin" | "employee" | "public";
  action: ActionType;
  details: string;
  timestamp: string;
}

export type ActionType =
  | "login" | "logout"
  | "view_employee" | "print_employee" | "print_summary" | "print_all"
  | "export_csv" | "search" | "filter" | "refresh_data"
  | "edit_employee" | "save_employee"
  | "create_user" | "update_user" | "delete_user" | "change_password" | "toggle_user" | "update_permissions"
  | "add_field" | "delete_field"
  | "public_search" | "share_employee"
  | "clear_logs" | "restore_archive" | "clean_archive";

export interface Session {
  userId: string;
  username: string;
  fullName: string;
  role: "admin" | "employee";
  permissions: Permissions;
  loginTime: string;
}

/* ============== EMPLOYEE EDIT ============== */
export interface EmployeeEdit {
  nationalNumber: string;
  overrides: Record<string, string>; // field key -> value
  editedBy: string;
  editedByName: string;
  editedAt: string;
}

/* ============== CUSTOM FIELD ============== */
export interface CustomField {
  id: string;
  key: string; // e.g. "field_custom_1"
  label: string; // Arabic label
  isRequired: boolean; // true = يُحسب من النواقص
  createdBy: string;
  createdAt: string;
}

/* ============== KEYS ============== */
const KEYS = {
  USERS: "nacc_users_v2",
  LOGS: "nacc_activity_logs_v2",
  SESSION: "nacc_current_session_v2",
  EDITS: "nacc_employee_edits_v1",
  CUSTOM_FIELDS: "nacc_custom_fields_v1",
};

const DEFAULT_ADMIN: User = {
  id: "admin_default",
  username: "admin",
  password: "admin123",
  fullName: "المدير العام",
  role: "admin",
  permissions: ADMIN_PERMISSIONS,
  isActive: true,
  createdAt: new Date().toISOString(),
  createdBy: "system",
};

function normalizePermissions(role: "admin" | "employee", permissions?: Partial<Permissions>): Permissions {
  const base = role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
  return { ...base, ...(permissions || {}) };
}

/* ============================================================
   USERS
   ============================================================ */
export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(KEYS.USERS);
    if (!raw) return initializeUsers();
    const users: User[] = JSON.parse(raw);
    // Migrate old users without permissions
    let changed = false;
    users.forEach((u) => {
      const normalized = normalizePermissions(u.role, u.permissions);
      if (JSON.stringify(normalized) !== JSON.stringify(u.permissions)) {
        u.permissions = normalized;
        changed = true;
      }
    });
    if (changed) saveUsers(users);
    if (!users.some((u) => u.role === "admin")) return initializeUsers();
    return users;
  } catch {
    return initializeUsers();
  }
}

function initializeUsers(): User[] {
  const users = [DEFAULT_ADMIN];
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  return users;
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
}

export function findUser(username: string, password: string): User | null {
  const users = getUsers();
  return users.find((u) => u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password && u.isActive) || null;
}

export function createUser(data: Omit<User, "id" | "createdAt">, createdBy: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.some((u) => u.username.toLowerCase() === data.username.toLowerCase().trim())) {
    return { ok: false, error: "اسم المستخدم موجود بالفعل" };
  }
  if (!data.username.trim() || data.username.trim().length < 3) return { ok: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" };
  if (!data.password || data.password.length < 4) return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" };
  if (!data.fullName.trim()) return { ok: false, error: "الاسم الكامل مطلوب" };
  users.push({
    ...data,
    id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    createdBy,
  });
  saveUsers(users);
  return { ok: true };
}

export function updateUser(id: string, updates: Partial<Omit<User, "id" | "createdAt" | "createdBy">>): { ok: boolean; error?: string } {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return { ok: false, error: "المستخدم غير موجود" };
  if (updates.username && updates.username !== users[idx].username) {
    if (users.some((u) => u.id !== id && u.username.toLowerCase() === updates.username!.toLowerCase().trim())) {
      return { ok: false, error: "اسم المستخدم موجود بالفعل" };
    }
  }
  users[idx] = { ...users[idx], ...updates };
  // If role changed to admin, give admin permissions
  if (updates.role === "admin") users[idx].permissions = ADMIN_PERMISSIONS;
  saveUsers(users);
  return { ok: true };
}

export function deleteUser(id: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return { ok: false, error: "المستخدم غير موجود" };
  if (user.role === "admin") {
    const adminCount = users.filter((u) => u.role === "admin" && u.isActive).length;
    if (adminCount <= 1) return { ok: false, error: "لا يمكن حذف آخر مدير في النظام" };
  }
  saveUsers(users.filter((u) => u.id !== id));
  return { ok: true };
}

export function changePassword(id: string, oldPassword: string, newPassword: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return { ok: false, error: "المستخدم غير موجود" };
  if (user.password !== oldPassword) return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };
  if (!newPassword || newPassword.length < 4) return { ok: false, error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل" };
  user.password = newPassword;
  saveUsers(users);
  return { ok: true };
}

/* ============================================================
   SESSION
   ============================================================ */
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEYS.SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    s.permissions = normalizePermissions(s.role, s.permissions);
    return s;
  } catch { return null; }
}

export function setSession(s: Session | null): void {
  if (s) localStorage.setItem(KEYS.SESSION, JSON.stringify(s));
  else localStorage.removeItem(KEYS.SESSION);
}

/* ============================================================
   LOGS
   ============================================================ */
const MAX_LOGS = 2000;

export function getLogs(): ActivityLog[] {
  try { return JSON.parse(localStorage.getItem(KEYS.LOGS) || "[]"); }
  catch { return []; }
}

export function addLog(actor: Session | { userId: string; username: string; fullName: string; role: "admin" | "employee" | "public" } | null, action: ActionType, details: string = ""): void {
  if (!actor) return;
  const logs = getLogs();
  logs.unshift({
    id: "l_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    userId: actor.userId,
    username: actor.username,
    fullName: actor.fullName,
    role: actor.role,
    action,
    details,
    timestamp: new Date().toISOString(),
  });
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

export function clearLogs(): void {
  localStorage.setItem(KEYS.LOGS, "[]");
}

export function getUserStats(userId: string): {
  totalLogins: number;
  totalOperations: number;
  lastLogin: string | null;
  lastLogout: string | null;
  lastActivity: string | null;
  operationsCount: Record<string, number>;
} {
  const logs = getLogs().filter((l) => l.userId === userId);
  const loginLogs = logs.filter((l) => l.action === "login");
  const logoutLogs = logs.filter((l) => l.action === "logout");
  const ops: Record<string, number> = {};
  logs.forEach((l) => { ops[l.action] = (ops[l.action] || 0) + 1; });
  return {
    totalLogins: loginLogs.length,
    totalOperations: logs.filter((l) => l.action !== "login" && l.action !== "logout").length,
    lastLogin: loginLogs[0]?.timestamp || null,
    lastLogout: logoutLogs[0]?.timestamp || null,
    lastActivity: logs[0]?.timestamp || null,
    operationsCount: ops,
  };
}

export const ACTION_LABELS: Record<ActionType, string> = {
  login: "تسجيل دخول", logout: "تسجيل خروج",
  view_employee: "عرض بيانات موظف", print_employee: "طباعة نموذج موظف",
  print_summary: "طباعة ملخص", print_all: "طباعة كل النماذج",
  export_csv: "تصدير CSV", search: "بحث", filter: "تصفية",
  refresh_data: "تحديث البيانات",
  edit_employee: "تعديل بيانات موظف", save_employee: "حفظ تعديلات موظف",
  create_user: "إنشاء مستخدم", update_user: "تعديل مستخدم",
  delete_user: "حذف مستخدم", change_password: "تغيير كلمة المرور",
  toggle_user: "تفعيل/تعطيل مستخدم", update_permissions: "تعديل صلاحيات",
  add_field: "إضافة حقل مخصص", delete_field: "حذف حقل مخصص",
  public_search: "بحث عام (موظف)", share_employee: "مشاركة بيانات موظف",
  clear_logs: "مسح السجلات",
  restore_archive: "استعادة موظف من الأرشيف",
  clean_archive: "تنظيف الأرشيف",
};

/* ============================================================
   EMPLOYEE EDITS (local overrides for sheet data)
   ============================================================ */
export function getAllEdits(): Record<string, EmployeeEdit> {
  try { return JSON.parse(localStorage.getItem(KEYS.EDITS) || "{}"); }
  catch { return {}; }
}

export function getEdit(nationalNumber: string): EmployeeEdit | null {
  return getAllEdits()[nationalNumber] || null;
}

export function saveEdit(nationalNumber: string, overrides: Record<string, string>, editedBy: string, editedByName: string): void {
  const all = getAllEdits();
  const existing = all[nationalNumber];
  all[nationalNumber] = {
    nationalNumber,
    overrides: { ...(existing?.overrides || {}), ...overrides },
    editedBy,
    editedByName,
    editedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.EDITS, JSON.stringify(all));
}

export function mergeEmployeeWithEdits(emp: Employee): Employee & Record<string, string> {
  const edit = getEdit(emp.nationalNumber);
  if (!edit) return emp as Employee & Record<string, string>;
  return { ...emp, ...edit.overrides } as Employee & Record<string, string>;
}

export function mergeAllEmployees(employees: Employee[]): (Employee & Record<string, string>)[] {
  const all = getAllEdits();
  return employees.map((e) => {
    const edit = all[e.nationalNumber];
    if (!edit) return e as Employee & Record<string, string>;
    return { ...e, ...edit.overrides } as Employee & Record<string, string>;
  });
}

export function findEmployeeByNationalNumber(employees: Employee[], nn: string): (Employee & Record<string, string>) | null {
  const cleaned = nn.replace(/[^\d]/g, "").trim();
  if (!cleaned) return null;
  const found = employees.find((e) => e.nationalNumber === cleaned);
  if (!found) return null;
  return mergeEmployeeWithEdits(found);
}

/* ============================================================
   CUSTOM FIELDS
   ============================================================ */
export function getCustomFields(): CustomField[] {
  try { return JSON.parse(localStorage.getItem(KEYS.CUSTOM_FIELDS) || "[]"); }
  catch { return []; }
}

export function addCustomField(label: string, createdBy: string, isRequired: boolean = false): { ok: boolean; error?: string; field?: CustomField } {
  if (!label.trim() || label.trim().length < 2) return { ok: false, error: "اسم الحقل يجب أن يكون حرفين على الأقل" };
  const fields = getCustomFields();
  if (fields.some((f) => f.label === label.trim())) return { ok: false, error: "حقل بهذا الاسم موجود بالفعل" };
  const key = "field_custom_" + Date.now();
  const field: CustomField = {
    id: "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    key, label: label.trim(), isRequired, createdBy, createdAt: new Date().toISOString(),
  };
  fields.push(field);
  localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields));
  return { ok: true, field };
}

export function toggleFieldRequired(id: string): void {
  const fields = getCustomFields();
  const f = fields.find((x) => x.id === id);
  if (f) { f.isRequired = !f.isRequired; localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields)); }
}

/* ============== REQUIRED FIELDS CONFIG (for standard fields) ============== */
const REQUIRED_FIELDS_KEY = "nacc_required_fields_config_v1";

export function getRequiredFieldsConfig(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(REQUIRED_FIELDS_KEY);
    if (!raw) return getDefaultRequiredConfig();
    return JSON.parse(raw);
  } catch { return getDefaultRequiredConfig(); }
}

function getDefaultRequiredConfig(): Record<string, boolean> {
  return {
    fullName: true, nationalNumber: true, jobNumber: true,
    jobGrade: true, qualification: true, specialization: true,
    grade: true, qualificationOrigin: true,
    bankName: true, iban: true,
    appointmentDecision: true, startDate: true, promotionDate: true,
    phone: true, department: true, section: true,
    // Non-required by default:
    gender: false, receivesPension: false, status: false,
    dataComplete: false, jobStatus: false, employmentType: false,
    notes: false, requiredAction: false,
  };
}

export function saveRequiredFieldsConfig(config: Record<string, boolean>): void {
  localStorage.setItem(REQUIRED_FIELDS_KEY, JSON.stringify(config));
}

export function deleteCustomField(id: string): void {
  const fields = getCustomFields().filter((f) => f.id !== id);
  localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields));
}
