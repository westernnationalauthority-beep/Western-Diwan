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
  canView:          "عرض بيانات الموظفين",
  canEdit:          "تعديل وحفظ البيانات",
  canPrint:         "طباعة النماذج",
  canExport:        "تصدير CSV",
  canManageUsers:   "إدارة المستخدمين",
  canViewLogs:      "عرض سجل النشاطات",
  canAddFields:     "إضافة حقول مخصصة",
  canRequestDelete: "طلب حذف موظف",
  canApproveDelete: "الموافقة على طلبات الحذف",
  canViewArchive:   "عرض أرشيف الموظفين",
  canRestoreArchive:"استعادة موظف من الأرشيف",
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
  // ✅ جديد: الأقسام المسموح لهذا المستخدم برؤيتها
  // [] أو undefined = يرى الكل (للمدير والمستخدمين غير المقيّدين)
  allowedDepartments?: string[];
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
  // ✅ جديد: الأقسام المسموح بها في الجلسة
  allowedDepartments?: string[];
}

/* ============== EMPLOYEE EDIT ============== */
export interface EmployeeEdit {
  nationalNumber: string;
  overrides: Record<string, string>;
  editedBy: string;
  editedByName: string;
  editedAt: string;
}

/* ============== CUSTOM FIELD ============== */
export interface CustomField {
  id: string;
  key: string;
  label: string;
  isRequired: boolean;
  createdBy: string;
  createdAt: string;
  source?: string;
}

/* ============== KEYS ============== */
const KEYS = {
  USERS:         "nacc_users_v2",
  LOGS:          "nacc_activity_logs_v2",
  SESSION:       "nacc_current_session_v2",
  EDITS:         "nacc_employee_edits_v1",
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
  allowedDepartments: [], // المدير يرى الكل
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
    let changed = false;
    users.forEach((u) => {
      const normalized = normalizePermissions(u.role, u.permissions);
      if (JSON.stringify(normalized) !== JSON.stringify(u.permissions)) {
        u.permissions = normalized;
        changed = true;
      }
      // migrate: إضافة allowedDepartments للمستخدمين القدامى
      if (u.allowedDepartments === undefined) {
        u.allowedDepartments = [];
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
  return users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase().trim()
      && u.password === password
      && u.isActive
  ) || null;
}

export function createUser(
  data: Omit<User, "id" | "createdAt">,
  createdBy: string
): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.some((u) => u.username.toLowerCase() === data.username.toLowerCase().trim()))
    return { ok: false, error: "اسم المستخدم موجود بالفعل" };
  if (!data.username.trim() || data.username.trim().length < 3)
    return { ok: false, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" };
  if (!data.password || data.password.length < 4)
    return { ok: false, error: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" };
  if (!data.fullName.trim())
    return { ok: false, error: "الاسم الكامل مطلوب" };
  users.push({
    ...data,
    allowedDepartments: data.allowedDepartments || [],
    id: "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    createdBy,
  });
  saveUsers(users);
  return { ok: true };
}

export function updateUser(
  id: string,
  updates: Partial<Omit<User, "id" | "createdAt" | "createdBy">>
): { ok: boolean; error?: string } {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return { ok: false, error: "المستخدم غير موجود" };
  if (updates.username && updates.username !== users[idx].username) {
    if (users.some((u) => u.id !== id && u.username.toLowerCase() === updates.username!.toLowerCase().trim()))
      return { ok: false, error: "اسم المستخدم موجود بالفعل" };
  }
  users[idx] = { ...users[idx], ...updates };
  if (updates.role === "admin") {
    users[idx].permissions = ADMIN_PERMISSIONS;
    users[idx].allowedDepartments = []; // المدير يرى الكل
  }
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

export function changePassword(
  id: string,
  oldPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const users = getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return { ok: false, error: "المستخدم غير موجود" };
  if (user.password !== oldPassword) return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };
  if (!newPassword || newPassword.length < 4) return { ok: false, error: "كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل" };
  user.password = newPassword;
  saveUsers(users);
  return { ok: true };
}

// ✅ جديد: تحديث الأقسام المسموح بها لمستخدم
export function updateUserDepartments(id: string, departments: string[]): { ok: boolean; error?: string } {
  return updateUser(id, { allowedDepartments: departments });
}

// ✅ جديد: هل المستخدم مقيّد بأقسام؟
export function isUserRestricted(user: User | Session): boolean {
  return !!(user.allowedDepartments && user.allowedDepartments.length > 0);
}

// ✅ جديد: فلترة الموظفين حسب أقسام المستخدم
export function filterByUserDepartments<T extends Employee>(
  employees: T[],
  session: Session
): T[] {
  if (!isUserRestricted(session)) return employees; // المدير يرى الكل
  const allowed = session.allowedDepartments || [];
  return employees.filter((e) => allowed.includes(e.department || ""));
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
    if (s.allowedDepartments === undefined) s.allowedDepartments = [];
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
export function getLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(KEYS.LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addLog(
  session: Pick<Session, "userId" | "username" | "fullName" | "role">,
  action: ActionType,
  details: string
): void {
  try {
    const logs = getLogs();
    logs.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      userId:    session.userId,
      username:  session.username,
      fullName:  session.fullName,
      role:      session.role,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
    // احتفظ بآخر 500 سجل فقط
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  } catch { /* تجاهل أخطاء التخزين */ }
}

export function clearLogs(): void {
  localStorage.removeItem(KEYS.LOGS);
}

/* ============================================================
   USER STATS
   ============================================================ */
export function getUserStats(userId: string): { totalLogins: number; totalOperations: number } {
  const logs = getLogs();
  const userLogs = logs.filter((l) => l.userId === userId);
  return {
    totalLogins:     userLogs.filter((l) => l.action === "login").length,
    totalOperations: userLogs.filter((l) => l.action !== "login" && l.action !== "logout").length,
  };
}

/* ============================================================
   EMPLOYEE EDITS
   ============================================================ */
export function getEmployeeEdits(): EmployeeEdit[] {
  try {
    const raw = localStorage.getItem(KEYS.EDITS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveEmployeeEdit(
  nationalNumber: string,
  overrides: Record<string, string>,
  session: Session
): void {
  try {
    const edits = getEmployeeEdits();
    const idx = edits.findIndex((e) => e.nationalNumber === nationalNumber);
    const edit: EmployeeEdit = {
      nationalNumber,
      overrides,
      editedBy:     session.userId,
      editedByName: session.fullName,
      editedAt:     new Date().toISOString(),
    };
    if (idx >= 0) edits[idx] = edit;
    else edits.push(edit);
    localStorage.setItem(KEYS.EDITS, JSON.stringify(edits));
  } catch { /* تجاهل */ }
}

export function mergeAllEmployees(employees: Employee[]): (Employee & Record<string, string>)[] {
  const edits = getEmployeeEdits();
  return employees.map((emp) => {
    const edit = edits.find((e) => e.nationalNumber === emp.nationalNumber);
    if (!edit) return emp as Employee & Record<string, string>;
    return { ...emp, ...edit.overrides } as Employee & Record<string, string>;
  });
}

export function findEmployeeByNationalNumber(
  employees: Employee[],
  nn: string
): (Employee & Record<string, string>) | null {
  const merged = mergeAllEmployees(employees);
  return merged.find((e) => e.nationalNumber === nn) || null;
}

/* ============================================================
   CUSTOM FIELDS
   ============================================================ */
export function getCustomFields(): CustomField[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_FIELDS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addCustomField(
  label: string,
  createdBy: string,
  isRequired = false
): { ok: boolean; error?: string; field?: CustomField } {
  const fields = getCustomFields();
  if (fields.some((f) => f.label === label)) return { ok: false, error: "الحقل موجود بالفعل" };
  const field: CustomField = {
    id:        "cf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    key:       "field_custom_" + Date.now(),
    label,
    isRequired,
    createdBy,
    createdAt: new Date().toISOString(),
    source:    createdBy === "sheet-sync" ? "sheet-sync" : "manual",
  };
  fields.push(field);
  localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields));
  return { ok: true, field };
}

export function deleteCustomField(id: string): void {
  const fields = getCustomFields().filter((f) => f.id !== id);
  localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields));
}

export function toggleFieldRequired(id: string): void {
  const fields = getCustomFields();
  const f = fields.find((f) => f.id === id);
  if (f) {
    f.isRequired = !f.isRequired;
    localStorage.setItem(KEYS.CUSTOM_FIELDS, JSON.stringify(fields));
  }
}

export function getRequiredFieldsConfig(): Record<string, boolean> {
  const fields = getCustomFields();
  const config: Record<string, boolean> = {
    fullName: true, nationalNumber: true, jobNumber: true,
    jobGrade: true, qualification: true, specialization: true,
    bankName: true, iban: true, appointmentDecision: true,
    startDate: true, phone: true, department: true,
  };
  fields.forEach((f) => { if (f.isRequired) config[f.key] = true; });
  return config;
}
