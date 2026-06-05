import { useState, useEffect, useMemo, useCallback } from "react";
import { type Employee, fetchEmployeesFromSheet, updateEmployeeInSheet, addEmployeeToSheet, addColumnToSheet, deleteColumnFromSheet, type EmployeeLoginResult, requestEmployeeDelete, getDeleteRequests, approveDeleteRequest, rejectDeleteRequest, getArchivedEmployees, restoreEmployeeFromArchive, type DeleteRequest, DELETE_REASONS, cleanArchive, cleanDeleteRequests, API_URL } from "./data/employees";

// توليد كود عشوائي 6 خانات (حروف وأرقام)
function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// ==========================================
// نظام رسائل الواتساب
// ==========================================
function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[^\d]/g, "").trim();
  // إذا يبدأ بـ 0 حوّله لرمز ليبيا 218
  if (p.startsWith("0")) p = "218" + p.slice(1);
  // إذا لا يبدأ بـ 218
  if (!p.startsWith("218")) p = "218" + p;
  return p;
}

function openWhatsApp(phone: string, message: string) {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, "_blank");
}

function sendCodeViaWhatsApp(phone: string, name: string, code: string) {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

كود الدخول الخاص بك لمنظومة بيانات الموظفين:

🔐 ${code}

⚠️ يرجى عدم مشاركة هذا الكود مع أي شخص.
صالح لمدة 3 أشهر من تاريخ آخر استخدام.

منظومة S-BUTTO
الهيئة الوطنية لمكافحة الفساد
ديوان المنطقة الغربية`;
  openWhatsApp(phone, msg);
}

function sendMissingFieldsViaWhatsApp(phone: string, name: string, missingFields: string[]) {
  const fieldsList = missingFields.map((f, i) => `${i + 1}. ${f}`).join("\n");
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

⚠️ بياناتك في منظومة الموظفين غير مكتملة.
يرجى مراجعة الإدارة لاستكمال البيانات التالية:

${fieldsList}

📍 ديوان المنطقة الغربية
منظومة S-BUTTO`;
  openWhatsApp(phone, msg);
}

// @ts-ignore - kept for future use
function sendGeneralWhatsApp(phone: string, name: string, message: string) {
  const msg = `السلام عليكم
الأستاذ/ة: ${name}

${message}

منظومة S-BUTTO
الهيئة الوطنية لمكافحة الفساد
ديوان المنطقة الغربية`;
  openWhatsApp(phone, msg);
}
import {
  type User, type Session, type ActivityLog, type Permissions, type CustomField,
  ACTION_LABELS, PERMISSION_LABELS, ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS,
  findUser, getUsers, createUser, updateUser, deleteUser, changePassword,
  getSession, setSession, addLog, getLogs, getUserStats, clearLogs,
  mergeAllEmployees, findEmployeeByNationalNumber,
  getCustomFields, addCustomField, deleteCustomField, toggleFieldRequired,
  getRequiredFieldsConfig, saveRequiredFieldsConfig,
} from "./lib/storage";

const NACC_LOGO = "/images/nacc-logo.png";
const LIBYA_FLAG = "/images/libya-flag.png";
const SYSTEM_NAME = "S-BUTTO";



/* ============================================================
   MISSING FIELDS - unified logic for view and print
   ============================================================ */
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

const isEmpty = (v: string | undefined): boolean => {
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

  // Check standard fields
  Object.entries(ALL_FIELD_LABELS).forEach(([key, label]) => {
    if (config[key] && isEmpty(emp[key])) missing.push(label);
  });

  // Check required custom fields
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

function syncCustomFieldsFromSheet(employees: any[]): void {
  const detectedLabels = getDetectedSheetColumns(employees);
  if (detectedLabels.length === 0) return;
  const existing = getCustomFields().map((f) => f.label);
  detectedLabels.forEach((label) => {
    if (!existing.includes(label)) {
      // The column already exists in Google Sheets, so only register it locally for display/settings.
      addCustomField(label, "sheet-sync", false);
    }
  });
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [publicEmployee, setPublicEmployee] = useState<any | null>(null);
  const [loginResult, setLoginResult] = useState<(EmployeeLoginResult & { employee?: any }) | null>(null);

  const handleLogin = (user: User) => {
    const s: Session = {
      userId: user.id, username: user.username, fullName: user.fullName,
      role: user.role, permissions: user.permissions || (user.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS),
      loginTime: new Date().toISOString(),
    };
    setSession(s); setSessionState(s);
    addLog(s, "login", `تسجيل دخول - ${user.role === "admin" ? "حساب مدير" : "حساب موظف"}`);
  };

  const handleLogout = () => {
    if (session) addLog(session, "logout", "تسجيل خروج");
    setSession(null); setSessionState(null);
  };

  const handleEmployeeLoginResult = (result: EmployeeLoginResult & { employee?: any }) => {
    setLoginResult(result);
    if (result.employee) setPublicEmployee(result.employee);
  };

  if (publicEmployee && loginResult) {
    return <PublicEmployeeView
      employee={publicEmployee}
      loginResult={loginResult}
      onBack={() => { setPublicEmployee(null); setLoginResult(null); }}
    />;
  }
  if (!session) return <AuthScreen onLogin={handleLogin} onPublicView={handleEmployeeLoginResult} />;
  return <Dashboard session={session} onLogout={handleLogout} />;
}

/* ============================================================
   AUTH SCREEN - Two boxes (Employee + Admin)
   ============================================================ */
function AuthScreen({ onLogin, onPublicView }: { onLogin: (u: User) => void; onPublicView: (emp: any) => void }) {
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100 flex flex-col">
      {/* Header banner */}
      <div className="bg-white border-b-2 border-amber-500 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-4">
          <img src={NACC_LOGO} alt="NACC" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <div className="text-[10px] text-slate-500 letter-spacing-1">NATIONAL ANTI-CORRUPTION COMMISSION - WESTERN REGION OFFICE</div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">الهيئة الوطنية لمكافحة الفساد</h1>
            <p className="text-sm font-semibold text-amber-700 mt-0.5">ديوان المنطقة الغربية</p>
          </div>
          <img src={LIBYA_FLAG} alt="ليبيا" className="h-12 w-20 object-contain border border-slate-200" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          {/* Title */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">نظام إدارة بيانات الموظفين</h2>
            <p className="text-sm text-slate-600 mt-1">خاص بموظفي ديوان المنطقة الغربية - جبل نفوسة</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Employee box */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-white">
                <div className="flex items-center gap-2">
                  <span className="text-xl">👤</span>
                  <div>
                    <h3 className="font-bold text-sm">الموظفين</h3>
                    <p className="text-[10px] opacity-90">عرض بياناتك الشخصية</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <label className="flex items-start gap-3 cursor-pointer mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition">
                  <input type="checkbox" checked={isEmployeeMode} onChange={(e) => setIsEmployeeMode(e.target.checked)} className="w-5 h-5 mt-0.5 accent-emerald-600" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">أنا موظف</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">أريد عرض بياناتي الشخصية فقط</p>
                  </div>
                </label>

                {isEmployeeMode ? (
                  <EmployeeSearchForm onFound={onPublicView} />
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🔍</div>
                    <p className="text-xs text-slate-500">ضع علامة ✓ على "أنا موظف" أعلاه<br />ثم أدخل رقمك الوطني للبحث</p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin box */}
            <div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔐</span>
                  <div>
                    <h3 className="font-bold text-sm">الإدارة</h3>
                    <p className="text-[10px] opacity-90">دخول الإدارة والمصرحين</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <AdminLoginForm onLogin={onLogin} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with S-BUTTO branding */}
      <footer className="bg-slate-900 text-white py-3">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs">
            <span className="opacity-70">تصميم وتطوير المنظومة:</span>
            <span className="font-bold mr-2 text-amber-400 tracking-wider">{SYSTEM_NAME}</span>
          </p>
          <p className="text-[10px] opacity-60 mt-1">جميع الحقوق محفوظة © {new Date().getFullYear()} - الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p>
        </div>
      </footer>
    </div>
  );
}

function EmployeeSearchForm({ onFound }: { onFound: (result: EmployeeLoginResult & { employee?: any }) => void }) {
  const [step, setStep] = useState<"national" | "code">("national");
  const [nn, setNn] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const goToCode = () => {
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    if (cleaned.length !== 12) { setError("الرقم الوطني يجب أن يكون 12 رقماً بالضبط"); return; }
    setError(""); setStep("code");
  };

  const login = async () => {
    setError(""); setLoading(true);
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    const codeUp = code.trim().toUpperCase();
    const INIT_CODE = "NACC2026";
    if (!codeUp) { setError("أدخل الكود أولاً"); setLoading(false); return; }

    try {
      // 1. جلب بيانات الموظفين من الإكسل
      const employees = await fetchEmployeesFromSheet();
      syncCustomFieldsFromSheet(employees as any[]);
      const found = findEmployeeByNationalNumber(employees, cleaned);

      if (!found) {
        setError("❌ الرقم الوطني غير موجود في المنظومة. راجع إدارة المنظومة.");
        setLoading(false); return;
      }

      // 2. جلب بيانات الكود المحلية (المتصفح)
      const codeKey = `emp_code_${cleaned}`;
      const stored = JSON.parse(localStorage.getItem(codeKey) || "{}");

      // 3. تحقق من الحجب
      if (stored.blocked === true) {
        setIsBlocked(true);
        setError("🚫 الحساب محجوب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
        setLoading(false); return;
      }

      // 4. الكود المتوقع: شخصي إذا موجود، وإلا المبدئي
      const expectedCode = stored.code || INIT_CODE;
      const currentAttempts = stored.attempts || 0;

      // 5. تحقق من صحة الكود
      if (codeUp !== expectedCode) {
        const newAttempts = currentAttempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 3) {
          localStorage.setItem(codeKey, JSON.stringify({
            ...stored, attempts: 3, blocked: true,
            blockDate: new Date().toISOString(),
            blockReason: "3 محاولات خاطئة"
          }));
          // حاول إخبار Apps Script (بدون انتظار)
          fetch(API_URL, {
            method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ action: "block_account", nationalNumber: cleaned, reason: "3 محاولات خاطئة" })
          }).catch(() => {});
          setIsBlocked(true);
          setError("🚫 تم حجب الحساب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
          setLoading(false); return;
        }

        localStorage.setItem(codeKey, JSON.stringify({ ...stored, attempts: newAttempts }));
        setError(`❌ الكود غير صحيح. تبقى ${3 - newAttempts} محاولة/محاولات فقط.`);
        setLoading(false); return;
      }

      // 6. تحقق من انتهاء صلاحية الكود (90 يوم من آخر دخول)
      if (stored.lastLogin && stored.code && stored.code !== INIT_CODE) {
        const lastLogin = new Date(stored.lastLogin);
        const diffDays = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 90) {
          setError("⏰ انتهت صلاحية الكود (مضت 3 أشهر). يرجى مراجعة الإدارة لتجديده.");
          setLoading(false); return;
        }
      }

      // 7. ✅ الكود صحيح
      const isFirstLogin = codeUp === INIT_CODE && (!stored.code || stored.code === INIT_CODE);
      const newPersonalCode = isFirstLogin ? generateRandomCode() : stored.code;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 90);

      // حفظ محلياً
      localStorage.setItem(codeKey, JSON.stringify({
        code: newPersonalCode,
        type: "شخصي",
        firstLogin: stored.firstLogin || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        expiry: expiry.toISOString(),
        blocked: false,
        attempts: 0,
      }));

      // إرسال للإكسل (بدون انتظار الرد)
      fetch(API_URL, {
        method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "save_login_data",
          nationalNumber: cleaned,
          code: newPersonalCode,
          type: "شخصي",
          lastLogin: new Date().toISOString(),
          expiry: expiry.toISOString(),
          status: "نشط",
        })
      }).catch(() => {});

      addLog({ userId: "public", username: "public", fullName: found.fullName, role: "public" },
        "public_search", `دخول موظف: ...${cleaned.slice(-4)}${isFirstLogin ? " (أول مرة)" : ""}`);

      const missing = getMissingFields(found);
      onFound({
        status: "success",
        fullName: found.fullName,
        isComplete: missing.length === 0,
        missing,
        personalCode: isFirstLogin ? newPersonalCode : undefined,
        codeType: isFirstLogin ? "تم إنشاء كودك الشخصي لأول مرة" : undefined,
        expiry: expiry.toLocaleDateString("ar-LY"),
        employee: found,
      });
    } catch (e) {
      console.error(e);
      setError("❌ فشل الاتصال. تأكد من الإنترنت وحاول مرة أخرى.");
    } finally { setLoading(false); }
  };

  if (isBlocked) {
    return (
      <div className="space-y-3 text-center">
        <div className="text-5xl">🚫</div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-bold text-red-800 text-sm">الحساب محجوب</h3>
          <p className="text-xs text-red-600 mt-1">تم حجب حسابك بسبب 3 محاولات دخول خاطئة.</p>
          <p className="text-xs text-red-600 mt-1 font-medium">يرجى مراجعة إدارة المنظومة لإعادة التفعيل.</p>
        </div>
        <button onClick={() => { setIsBlocked(false); setStep("national"); setNn(""); setCode(""); setAttempts(0); setError(""); }} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm transition">
          رجوع
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === "national" ? (
        <>
          <div>
            <label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني</label>
            <input
              type="text" value={nn}
              onChange={(e) => { setNn(e.target.value.replace(/[^\d]/g, "").slice(0, 12)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && goToCode()}
              placeholder="أدخل رقمك الوطني"
              inputMode="numeric" maxLength={12}
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none tracking-widest"
              dir="ltr" autoFocus
            />
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">يتكون من 12 رقماً بالضبط</span>
              <span dir="ltr" className={`font-bold ${nn.length === 12 ? "text-emerald-600" : "text-slate-400"}`}>{nn.length}/12</span>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}
          <button onClick={goToCode} disabled={nn.length !== 12}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
            التالي →
          </button>
        </>
      ) : (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-emerald-600">الرقم الوطني المدخل</p>
              <p className="font-mono font-bold text-emerald-800" dir="ltr">{nn}</p>
            </div>
            <button onClick={() => { setStep("national"); setCode(""); setError(""); setAttempts(0); }} className="text-[10px] text-emerald-600 hover:text-emerald-800 underline">تغيير</button>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block font-medium">كود الدخول</label>
            <input
              type="text" value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 10)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="NACC2026"
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center tracking-widest focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
              dir="ltr" autoFocus
            />
            <p className="text-[10px] text-slate-400 mt-1 text-center">
              أول مرة؟ استخدم الكود المبدئي: <span className="font-bold text-emerald-700 tracking-wider">NACC2026</span>
            </p>
          </div>
          {attempts > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-center text-red-600 font-medium">المحاولات المتبقية: {Math.max(0, 3 - attempts)}/3</p>
              <div className="flex gap-1.5 justify-center">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`h-2.5 w-10 rounded-full transition-all ${i < attempts ? "bg-red-500" : "bg-slate-200"}`} />
                ))}
              </div>
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}
          <div className="flex gap-2">
            <button onClick={() => { setStep("national"); setCode(""); setError(""); }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition">
              ← رجوع
            </button>
            <button onClick={login} disabled={loading || !code.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري التحقق...
                </span>
              ) : "🔐 دخول"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AdminLoginForm({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tryLogin = () => {
    const user = findUser(username, password);
    if (!user) { setError("اسم المستخدم أو كلمة المرور غير صحيحة"); setPassword(""); return; }
    onLogin(user);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">اسم المستخدم</label>
        <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="username" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">كلمة المرور</label>
        <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="••••••" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
      </div>
      {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-center">{error}</p>}
      <button onClick={tryLogin} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-medium text-sm transition shadow-md">
        🔓 دخول
      </button>
    </div>
  );
}

/* ============================================================
   PUBLIC EMPLOYEE VIEW
   ============================================================ */
function PublicEmployeeView({ employee, loginResult, onBack }: { employee: any; loginResult: EmployeeLoginResult & { employee?: any }; onBack: () => void }) {
  const customFields = getCustomFields();
  const missing = loginResult.missing || getMissingFields(employee);
  const isComplete = loginResult.isComplete ?? missing.length === 0;

  const share = async () => {
    const text = `بياناتي - ديوان المنطقة الغربية\n\nالاسم: ${employee.fullName}\nالرقم الوطني: ${employee.nationalNumber}\nالدرجة: ${employee.jobGrade || "-"}\nالإدارة: ${employee.department || "-"}\nالهاتف: ${employee.phone || "-"}\nالحالة: ${employee.status || "-"}`;
    addLog({ userId: "public", username: "public", fullName: employee.fullName, role: "public" }, "share_employee", `مشاركة بيانات: ${employee.nationalNumber}`);
    if (navigator.share) {
      try { await navigator.share({ title: "بياناتي", text }); }
      catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert("✅ تم نسخ البيانات إلى الحافظة");
      } catch { alert("لا يمكن النسخ، استخدم زر الطباعة"); }
    }
  };

  const print = () => {
    printIndividualForm(employee);
    addLog({ userId: "public", username: "public", fullName: employee.fullName, role: "public" }, "print_employee", `طباعة بياناتي: ${employee.nationalNumber}`);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
      <header className="bg-white border-b-2 border-emerald-500 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={NACC_LOGO} alt="NACC" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-slate-900">بياناتي الشخصية</h1>
              <p className="text-[10px] text-slate-500">ديوان المنطقة الغربية - جبل نفوسة</p>
            </div>
          </div>
          <button onClick={onBack} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            رجوع
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Welcome card */}
        <div className={`rounded-2xl p-5 text-white shadow-lg ${isComplete ? "bg-gradient-to-l from-emerald-500 to-teal-600" : "bg-gradient-to-l from-amber-500 to-orange-600"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">مرحباً</p>
              <h2 className="text-xl font-bold mt-1">{employee.fullName}</h2>
              <p className="text-xs mt-2 font-mono opacity-90" dir="ltr">الرقم الوطني: {employee.nationalNumber}</p>
            </div>
            <div className="text-4xl">{isComplete ? "✅" : "⚠️"}</div>
          </div>
          <div className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-bold ${isComplete ? "bg-white/20" : "bg-white/20"}`}>
            {isComplete ? "بياناتك مكتملة - يمكنك طباعة نموذجك" : `بياناتك تحتوي على ${missing.length} نقص - يرجى مراجعة الإدارة`}
          </div>
        </div>

        {/* New code notification */}
        {loginResult.codeType && (
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔐</span>
              <div>
                <h3 className="font-bold text-indigo-800 text-sm">{loginResult.codeType}</h3>
                <p className="text-[11px] text-indigo-600">احتفظ بهذا الكود في مكان آمن</p>
              </div>
            </div>
            <div className="bg-white border-2 border-indigo-400 rounded-xl p-4 text-center">
              <p className="text-[10px] text-slate-500 mb-1">كودك الشخصي الجديد</p>
              <p className="text-3xl font-mono font-bold text-indigo-700 tracking-widest">{loginResult.personalCode}</p>
              {loginResult.expiry && <p className="text-[10px] text-slate-400 mt-1">صالح حتى: {loginResult.expiry}</p>}
            </div>
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 text-center">
              ⚠️ ستحتاج هذا الكود في كل مرة تدخل فيها. لا تشاركه مع أحد.
            </p>
          </div>
        )}

        {/* Action buttons - only if complete */}
        {isComplete ? (
          <div className="flex gap-2">
            <button onClick={print} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              طباعة نموذجي
            </button>
            <button onClick={share} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              مشاركة
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
            <div className="text-4xl mb-2">🏢</div>
            <h3 className="font-bold text-amber-800">يرجى مراجعة الإدارة</h3>
            <p className="text-xs text-amber-700 mt-1">لاستكمال بياناتك الناقصة وتفعيل صلاحية الطباعة</p>
          </div>
        )}

        {/* Missing fields alert */}
        {missing.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
            <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
              <span>⚠️</span> تنبيه: بياناتك بحاجة لتحديث
            </h3>
            <p className="text-xs text-amber-700 mb-2">يرجى مراجعة الإدارة لاستكمال البيانات التالية:</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m, i) => (
                <span key={i} className="bg-white text-amber-800 px-2 py-1 rounded-lg text-[10px] font-medium border border-amber-300">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* Employee data sections */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <DataSection title="البيانات الأساسية" color="indigo" rows={[
            ["الاسم رباعي", employee.fullName], ["الرقم الوطني", employee.nationalNumber, true],
            ["الرقم الوظيفي", employee.jobNumber, true], ["الجنس", employee.gender],
            ["الحالة الوظيفية", employee.jobStatus], ["نوع التوظيف", employee.employmentType],
          ]} />
          <DataSection title="البيانات الأكاديمية والوظيفية" color="emerald" rows={[
            ["الدرجة الوظيفية", employee.jobGrade], ["المؤهل العلمي", employee.qualification],
            ["التخصص", employee.specialization], ["التقدير", employee.grade],
            ["أصل المؤهل / مكان الحصول", employee.qualificationOrigin],
          ]} />
          <DataSection title="البيانات المالية" color="amber" rows={[
            ["المصرف", employee.bankName], ["رقم الحساب (IBAN)", employee.iban, true],
            ["يتقاضى معاش", employee.receivesPension],
          ]} />
          <DataSection title="البيانات الإدارية" color="violet" rows={[
            ["رقم قرار التعيين", employee.appointmentDecision, true],
            ["تاريخ المباشرة", employee.startDate], ["آخر ترقية", employee.promotionDate],
            ["الإدارة", employee.department], ["القسم", employee.section],
            ["رقم الهاتف", employee.phone, true],
          ]} />
          {customFields.length > 0 && (
            <DataSection title="بيانات إضافية" color="cyan" rows={customFields.map((cf) => [cf.label, employee[cf.label] || employee[cf.key] || ""])} />
          )}
        </div>
      </main>

      <footer className="bg-slate-900 text-white py-3 mt-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs"><span className="opacity-70">تصميم وتطوير المنظومة:</span><span className="font-bold mr-2 text-amber-400 tracking-wider">{SYSTEM_NAME}</span></p>
        </div>
      </footer>
    </div>
  );
}

function DataSection({ title, color, rows }: { title: string; color: string; rows: (string | boolean | undefined)[][] }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-600", emerald: "bg-emerald-600", amber: "bg-amber-600",
    violet: "bg-violet-600", cyan: "bg-cyan-600",
  };
  return (
    <div>
      <div className={`${colors[color]} text-white px-3 py-1.5 rounded-t-lg text-xs font-bold`}>{title}</div>
      <div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">
        {rows.map((row, i) => {
          const label = row[0] as string; const value = row[1] as string; const mono = row[2] as boolean;
          const empty = isEmpty(value);
          return (
            <div key={i} className={`grid grid-cols-3 gap-2 px-3 py-2 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"} border-b border-slate-100 last:border-b-0`}>
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`col-span-2 text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`} dir={mono && !empty ? "ltr" : undefined}>{empty ? "— لم يتم تسجيله —" : value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
type TabName = "employees" | "reports" | "codes" | "delete_requests" | "archive" | "users" | "logs" | "fields" | "settings";

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<TabName>("employees");
  const perms = session.permissions;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
      <DashboardHeader session={session} onLogout={onLogout} tab={tab} setTab={setTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {tab === "employees" && <EmployeesTab session={session} />}
        {tab === "reports" && <ReportsTab session={session} />}
        {tab === "codes" && perms.canManageUsers && <CodesTab session={session} />}
        {tab === "delete_requests" && (perms.canRequestDelete || perms.canApproveDelete) && <DeleteRequestsTab session={session} />}
        {tab === "archive" && (perms.canViewArchive || perms.canRestoreArchive) && <ArchiveTab session={session} />}
        {tab === "users" && perms.canManageUsers && <UsersTab session={session} />}
        {tab === "logs" && perms.canViewLogs && <LogsTab />}
        {tab === "fields" && perms.canAddFields && <FieldsTab session={session} />}
        {tab === "settings" && <SettingsTab session={session} />}
      </main>
      <footer className="border-t border-slate-200 bg-slate-900 text-white mt-6 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="text-xs">
            <span className="opacity-70">نظام إدارة بيانات موظفي ديوان المنطقة الغربية</span>
            <span className="mx-2 opacity-50">|</span>
            <span className="opacity-70">تصميم:</span>
            <span className="font-bold mr-1 text-amber-400 tracking-wider">{SYSTEM_NAME}</span>
          </p>
          <p className="text-[10px] opacity-50">© {new Date().getFullYear()} الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p>
        </div>
      </footer>
    </div>
  );
}

function DashboardHeader({ session, onLogout, tab, setTab }: { session: Session; onLogout: () => void; tab: TabName; setTab: (t: TabName) => void }) {
  const perms = session.permissions;
  const [pendingDeletes, setPendingDeletes] = useState(0);

  useEffect(() => {
    if (!perms.canApproveDelete) return;
    let mounted = true;
    const loadPending = async () => {
      const requests = await getDeleteRequests();
      if (mounted) setPendingDeletes(requests.filter((r) => r.status === "قيد المراجعة").length);
    };
    loadPending();
    const timer = window.setInterval(loadPending, 15000);
    window.addEventListener("delete-requests-changed", loadPending);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("delete-requests-changed", loadPending);
    };
  }, [perms.canApproveDelete]);

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={NACC_LOGO} alt="NACC" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-base font-bold text-slate-900">{session.role === "admin" ? "لوحة تحكم المدير" : "نظام إدارة الموظفين"}</h1>
              <p className="text-[11px] text-slate-500">الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-left ml-2 hidden sm:block">
              <p className="text-xs font-bold text-slate-700">{session.fullName}</p>
              <p className="text-[10px] text-slate-400">{session.role === "admin" ? "👑 مدير" : "👤 موظف"} • @{session.username}</p>
            </div>
            <button onClick={onLogout} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              خروج
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-3 -mb-3 overflow-x-auto">
          <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} icon="👥">الموظفين</TabBtn>
          <TabBtn active={tab === "reports"} onClick={() => setTab("reports")} icon="📈">التقارير</TabBtn>
          {perms.canManageUsers && <TabBtn active={tab === "codes"} onClick={() => setTab("codes")} icon="🔑">أكواد الموظفين</TabBtn>}
          {(perms.canRequestDelete || perms.canApproveDelete) && <TabBtn active={tab === "delete_requests"} onClick={() => setTab("delete_requests")} icon="📋">طلبات الحذف {pendingDeletes > 0 && <span className="mr-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{pendingDeletes}</span>}</TabBtn>}
          {(perms.canViewArchive || perms.canRestoreArchive) && <TabBtn active={tab === "archive"} onClick={() => setTab("archive")} icon="🗄️">أرشيف الموظفين</TabBtn>}
          {perms.canManageUsers && <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon="🔐">المستخدمين</TabBtn>}
          {perms.canViewLogs && <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon="📊">السجلات</TabBtn>}
          {perms.canAddFields && <TabBtn active={tab === "fields"} onClick={() => setTab("fields")} icon="➕">الحقول المخصصة</TabBtn>}
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon="⚙️">الإعدادات</TabBtn>
        </div>
      </div>
    </header>
  );
}

function TabBtn({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon: string }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
      <span>{icon}</span><span>{children}</span>
    </button>
  );
}

/* ============================================================
   EMPLOYEES TAB
   ============================================================ */
type SortKey = string;

function EmployeesTab({ session }: { session: Session }) {
  const [employeesRaw, setEmployeesRaw] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataTimestamp, setDataTimestamp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState<"nationalNumber" | "fullName" | "all">("nationalNumber");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [dataCompleteFilter, setDataCompleteFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [alertPage, setAlertPage] = useState(1);
  const rowsPerPage = 15;
  const alertPerPage = 10;
  const perms = session.permissions;
  const customFields = getCustomFields();

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await fetchEmployeesFromSheet();
      syncCustomFieldsFromSheet(data as any[]);
      setEmployeesRaw(data);
      setDataTimestamp(new Date().toLocaleString("ar-LY"));
      addLog(session, "refresh_data", `تحميل ${data.length} موظف`);
    } catch { setError("فشل في تحميل البيانات من Google Sheets"); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // الاستماع لحدث إزالة موظف (بعد الموافقة على الحذف)
  useEffect(() => {
    const handleRemove = (e: any) => {
      const removedNN = (e.detail?.nationalNumber || "").toString().replace(/[^\d]/g, "").trim();
      if (removedNN) {
        setEmployeesRaw((prev) => prev.filter((emp) => emp.nationalNumber !== removedNN));
      }
    };
    window.addEventListener("employee-removed", handleRemove);
    return () => window.removeEventListener("employee-removed", handleRemove);
  }, []);

  // Merge with local edits
  const employees = useMemo(() => mergeAllEmployees(employeesRaw), [employeesRaw]);

  const filtered = useMemo(() => {
    let result = [...employees];
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((emp) => {
        if (searchBy === "nationalNumber") return emp.nationalNumber.includes(term);
        if (searchBy === "fullName") return emp.fullName.toLowerCase().includes(term);
        return emp.nationalNumber.includes(term) || emp.fullName.toLowerCase().includes(term) || emp.jobNumber.includes(term) || (emp.phone || "").includes(term) || (emp.department || "").toLowerCase().includes(term) || (emp.bankName || "").toLowerCase().includes(term);
      });
    }
    if (statusFilter) result = result.filter((e) => e.status === statusFilter);
    if (genderFilter) result = result.filter((e) => e.gender === genderFilter);
    if (dataCompleteFilter) result = result.filter((e) => e.dataComplete === dataCompleteFilter);
    if (sortKey) result.sort((a: any, b: any) => { const va = a[sortKey] || ""; const vb = b[sortKey] || ""; return sortDir === "asc" ? String(va).localeCompare(String(vb), "ar") : String(vb).localeCompare(String(va), "ar"); });
    return result;
  }, [employees, searchTerm, searchBy, statusFilter, genderFilter, dataCompleteFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const alertEmployees = useMemo(() => employees.filter((e) => e.status === "ناقص"), [employees]);
  const alertTotalPages = Math.ceil(alertEmployees.length / alertPerPage);
  const alertPaginated = alertEmployees.slice((alertPage - 1) * alertPerPage, alertPage * alertPerPage);

  const stats = useMemo(() => ({
    total: employees.length,
    complete: employees.filter((e) => e.dataComplete === "نعم مكتملة").length,
    incomplete: employees.filter((e) => e.dataComplete === "غير مكتملة").length,
    underProcess: employees.filter((e) => e.status === "تحت الاجراء").length,
    completeStatus: employees.filter((e) => e.status === "مستوفي").length,
    missing: employees.filter((e) => e.status === "ناقص").length,
    male: employees.filter((e) => e.gender === "ذكر").length,
    female: employees.filter((e) => e.gender === "أنثى").length,
    hasJobNumber: employees.filter((e) => e.jobNumber && e.jobNumber.trim().length > 0).length,
    noJobNumber: employees.filter((e) => !e.jobNumber || e.jobNumber.trim() === "").length,
  }), [employees]);

  const handleSort = (k: SortKey) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } setCurrentPage(1); };
  const clearFilters = () => { setSearchTerm(""); setStatusFilter(""); setGenderFilter(""); setDataCompleteFilter(""); setSortKey(""); setSortDir("asc"); setCurrentPage(1); };

  useEffect(() => { if (searchTerm.trim().length >= 3) addLog(session, "search", `بحث: "${searchTerm.trim()}" بواسطة ${searchBy}`); }, [searchTerm]); // eslint-disable-line

  const handleView = (emp: any) => { setSelectedEmployee(emp); addLog(session, "view_employee", `عرض: ${emp.fullName} (${emp.nationalNumber})`); };
  const handleEdit = (emp: any) => {
    if (!perms.canEdit) { alert("ليس لديك صلاحية التعديل"); return; }
    setEditingEmployee(emp); setSelectedEmployee(null);
    addLog(session, "edit_employee", `فتح تعديل: ${emp.fullName} (${emp.nationalNumber})`);
  };
  
  const handleSaveEdit = async (nn: string, overrides: Record<string, string>, name: string) => {
    // Convert custom field keys to their label names for the sheet
    const sheetUpdates: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in overrides) {
      const cf = cfs.find((c) => c.key === key);
      if (cf) {
        // Custom field: use the label as column name in the sheet
        sheetUpdates[cf.label] = overrides[key];
      } else {
        sheetUpdates[key] = overrides[key];
      }
    }
    const ok = await updateEmployeeInSheet(nn, sheetUpdates);
    if (ok) {
      addLog(session, "save_employee", `تحديث بيانات الموظف: ${name} (${nn})`);
      alert("✅ تم إرسال التحديثات بنجاح. ستظهر التغييرات خلال لحظات.");
      setTimeout(() => loadData(), 3500);
    } else { alert("❌ فشل الاتصال."); }
    setEditingEmployee(null);
  };

  const [deleteRequestEmp, setDeleteRequestEmp] = useState<any | null>(null);
  
  const handleDeleteEmployee = (emp: any) => {
    if (!perms.canRequestDelete) { alert("ليس لديك صلاحية طلب حذف موظف"); return; }
    setSelectedEmployee(null);
    setDeleteRequestEmp(emp);
  };

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const handleAddEmployee = async (employee: any) => {
    // فحص التكرار محلياً أولاً
    const nn = (employee.nationalNumber || "").replace(/[^\d]/g, "").trim();
    if (nn && employees.some((e) => e.nationalNumber === nn)) {
      alert("❌ الرقم الوطني موجود مسبقاً. لا يمكن إضافة موظف مكرر.");
      return;
    }
    // Convert custom field keys to their label names for the sheet
    const sheetEmployee: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in employee) {
      const cf = cfs.find((c) => c.key === key);
      if (cf) {
        sheetEmployee[cf.label] = employee[key];
      } else {
        sheetEmployee[key] = employee[key];
      }
    }
    const result = await addEmployeeToSheet(sheetEmployee);
    if (result) {
      addLog(session, "create_user", `إضافة موظف جديد للإكسل: ${employee.fullName} (${employee.nationalNumber})`);
      alert("✅ تم إضافة الموظف بنجاح! سيظهر في القائمة خلال لحظات.");
      setTimeout(() => loadData(), 3500);
    } else { alert("❌ فشل الاتصال."); }
    setShowAddEmployee(false);
  };

  const handlePrintIndividual = (emp: any) => {
    if (!perms.canPrint) { alert("ليس لديك صلاحية الطباعة"); return; }
    printIndividualForm(emp);
    addLog(session, "print_employee", `طباعة: ${emp.fullName} (${emp.nationalNumber})`);
  };
  const handlePrintAll = (data: any[], label: string) => { if (!perms.canPrint) return; printAllForms(data); addLog(session, "print_all", `طباعة ${data.length} نموذج - ${label}`); setShowExportMenu(false); };
  const handlePrintSummary = (data: any[], label: string) => { if (!perms.canPrint) return; printSummaryTable(data, employees.filter((e) => e.status === "ناقص")); addLog(session, "print_summary", `طباعة ملخص ${data.length} - ${label}`); setShowExportMenu(false); };
  const handleExportCSV = (data: any[], filename: string, label: string) => { if (!perms.canExport) return; exportCSV(data, filename); addLog(session, "export_csv", `تصدير ${data.length} - ${label}`); setShowExportMenu(false); };

  if (loading) return (<div className="flex items-center justify-center py-20"><div className="text-center space-y-4"><div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /><p className="text-slate-500">جاري التحميل...</p></div></div>);
  if (error && employees.length === 0) return (<div className="bg-white rounded-2xl shadow-lg border border-red-200 max-w-md mx-auto p-8 text-center space-y-4"><h2 className="text-lg font-bold text-slate-900">خطأ في التحميل</h2><p className="text-sm text-slate-500">{error}</p><button onClick={loadData} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">قاعدة بيانات الموظفين</h2>
          {perms.canEdit && (
            <button onClick={() => setShowAddEmployee(true)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-medium transition flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              إضافة موظف
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dataTimestamp && <span className="text-[10px] text-slate-400 hidden sm:block">آخر تحديث: {dataTimestamp}</span>}
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تحديث">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          {(perms.canPrint || perms.canExport) && (
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                تصدير / طباعة
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[230px]">
                    {perms.canExport && <>
                      <button onClick={() => handleExportCSV(employees, "موظفي_ديوان_الغربية_كامل", "كل البيانات")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>تصدير CSV (كامل)</span><span>📄</span></button>
                      <button onClick={() => handleExportCSV(filtered, "موظفي_ديوان_الغربية_تصفية", "التصفية")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>تصدير CSV (التصفية)</span><span>🔍</span></button>
                      <div className="border-t border-slate-100 my-1" />
                    </>}
                    {perms.canPrint && <>
                      <button onClick={() => handlePrintAll(filtered, "التصفية")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة النماذج (التصفية)</span><span>📝</span></button>
                      <button onClick={() => handlePrintSummary(paginated, "الصفحة")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة (الصفحة الحالية)</span><span>📋</span></button>
                      <button onClick={() => handlePrintAll(employees, "الكل")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة النماذج (الكل)</span><span>📚</span></button>
                      <button onClick={() => handlePrintSummary(filtered, "ملخص")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة ملخص (جدول)</span><span>📊</span></button>
                    </>}
                  </div>
                </>
              )}
            </div>
          )}
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">{employees.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="👥" />
        <StatCard label="مكتملة" value={stats.complete} color="emerald" icon="✅" />
        <StatCard label="غير مكتملة" value={stats.incomplete} color="red" icon="⚠️" />
        <StatCard label="تحت الإجراء" value={stats.underProcess} color="blue" icon="⏳" />
        <StatCard label="مستوفي" value={stats.completeStatus} color="emerald" icon="✔️" />
        <StatCard label="ناقص" value={stats.missing} color="amber" icon="📋" />
        <StatCard label="ذكور" value={stats.male} color="indigo" icon="👨" />
        <StatCard label="إناث" value={stats.female} color="pink" icon="👩" />
        <StatCard label="برقم وظيفي" value={stats.hasJobNumber} color="cyan" icon="🆔" />
        <StatCard label="بدون رقم" value={stats.noJobNumber} color="orange" icon="❓" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
              <input type="text" placeholder="ابحث..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <select value={searchBy} onChange={(e) => { setSearchBy(e.target.value as any); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
              <option value="nationalNumber">الرقم الوطني</option><option value="fullName">الاسم</option><option value="all">جميع الحقول</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">الحالة</option><option value="مستوفي">مستوفي</option><option value="ناقص">ناقص</option><option value="تحت الاجراء">تحت الإجراء</option></select>
            <select value={dataCompleteFilter} onChange={(e) => { setDataCompleteFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">البيانات</option><option value="نعم مكتملة">مكتملة</option><option value="غير مكتملة">غير مكتملة</option></select>
            <select value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">الجنس</option><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option></select>
            {(searchTerm || statusFilter || genderFilter || dataCompleteFilter) && <button onClick={clearFilters} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-medium hover:bg-red-100">مسح</button>}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">تم العثور على <span className="font-bold text-slate-700">{filtered.length}</span> موظف{filtered.length !== employees.length && <span className="text-indigo-500 text-[10px] mr-1">(من {employees.length})</span>}</p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <Th onClick={() => handleSort("nationalNumber")}>الرقم الوطني <SortIcon column="nationalNumber" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("fullName")}>الاسم <SortIcon column="fullName" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("jobGrade")}>الدرجة <SortIcon column="jobGrade" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("qualification")}>المؤهل <SortIcon column="qualification" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("department")}>الإدارة <SortIcon column="department" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("status")}>الحالة <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th onClick={() => handleSort("dataComplete")}>البيانات <SortIcon column="dataComplete" sortKey={sortKey} sortDir={sortDir} /></Th>
              <Th>النواقص</Th>
              <Th>إجراءات</Th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((emp, idx) => {
                const missingCount = getMissingFields(emp).length;
                return (
                  <tr key={emp.nationalNumber + "-" + idx} className="hover:bg-indigo-50/50 cursor-pointer" onClick={() => handleView(emp)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-indigo-700 whitespace-nowrap" dir="ltr">{emp.nationalNumber}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap max-w-[160px] truncate">{emp.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.jobGrade || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.qualification || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{emp.department || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(emp.status)}`}>{emp.status || "-"}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getDataCompleteBadge(emp.dataComplete)}`}>{emp.dataComplete || "-"}</span></td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">{missingCount > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">{missingCount} ⚠️</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✓</span>}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleView(emp); }} className="text-indigo-600 hover:text-indigo-800 font-medium text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition">عرض</button>
                        {perms.canEdit && <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }} className="text-amber-700 hover:text-white hover:bg-amber-600 font-medium text-[10px] bg-amber-50 px-2 py-1 rounded border border-amber-200 transition">تعديل</button>}
                        {perms.canPrint && <button onClick={(e) => { e.stopPropagation(); handlePrintIndividual(emp); }} className="text-slate-700 hover:text-white font-medium text-[10px] bg-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition" title="طباعة">🖨️</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400">لا توجد نتائج</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />}
      </div>

      {alertEmployees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2"><span className="text-lg">⚠️</span><h3 className="font-bold text-amber-800 text-sm">تنبيه: موظفون بحاجة لمراجعة الإدارة</h3><span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{alertEmployees.length}</span></div>
            <span className="text-[10px] text-amber-700">صفحة {alertPage} من {alertTotalPages}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-amber-200 text-amber-700"><th className="text-right px-2 py-1">الرقم الوطني</th><th className="text-right px-2 py-1">الاسم</th><th className="text-right px-2 py-1">النواقص</th><th className="text-right px-2 py-1">الملاحظات</th><th className="text-right px-2 py-1">الإجراء</th></tr></thead>
              <tbody>{alertPaginated.map((emp, i) => (<tr key={i} className="border-b border-amber-100 hover:bg-amber-100/50 cursor-pointer" onClick={() => handleView(emp)}>
                <td className="px-2 py-1.5 font-mono text-amber-900" dir="ltr">{emp.nationalNumber}</td>
                <td className="px-2 py-1.5 font-medium text-amber-900">{emp.fullName}</td>
                <td className="px-2 py-1.5"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">{getMissingFields(emp).length}</span></td>
                <td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.notes}</td>
                <td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.requiredAction}</td>
              </tr>))}</tbody>
            </table>
          </div>
          {alertTotalPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1">
              <PageBtn onClick={() => setAlertPage(1)} disabled={alertPage === 1}>⟪</PageBtn>
              <PageBtn onClick={() => setAlertPage(Math.max(1, alertPage - 1))} disabled={alertPage === 1}>السابق</PageBtn>
              <span className="px-3 text-xs text-amber-800 font-bold">{alertPage} / {alertTotalPages}</span>
              <PageBtn onClick={() => setAlertPage(Math.min(alertTotalPages, alertPage + 1))} disabled={alertPage === alertTotalPages}>التالي</PageBtn>
              <PageBtn onClick={() => setAlertPage(alertTotalPages)} disabled={alertPage === alertTotalPages}>⟫</PageBtn>
            </div>
          )}
        </div>
      )}

      {selectedEmployee && <EmployeeDetailModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onPrint={() => handlePrintIndividual(selectedEmployee)} onEdit={() => handleEdit(selectedEmployee)} onDelete={() => handleDeleteEmployee(selectedEmployee)} canEdit={perms.canEdit} canDelete={perms.canRequestDelete} canPrint={perms.canPrint} customFields={customFields} />}
      {editingEmployee && <EmployeeEditModal employee={editingEmployee} customFields={customFields} onClose={() => setEditingEmployee(null)} onSave={(overrides) => handleSaveEdit(editingEmployee.nationalNumber, overrides, editingEmployee.fullName)} />}
      {showAddEmployee && <AddEmployeeModal customFields={customFields} onClose={() => setShowAddEmployee(false)} onSave={handleAddEmployee} />}
      {deleteRequestEmp && <DeleteRequestModal employee={deleteRequestEmp} session={session} onClose={() => setDeleteRequestEmp(null)} onSuccess={() => setDeleteRequestEmp(null)} />}
    </div>
  );
}

/* ============================================================
   EMPLOYEE DETAIL MODAL
   ============================================================ */
function EmployeeDetailModal({ employee, onClose, onPrint, onEdit, onDelete, canEdit, canDelete, canPrint, customFields }: { employee: any; onClose: () => void; onPrint: () => void; onEdit: () => void; onDelete: () => void; canEdit: boolean; canDelete: boolean; canPrint: boolean; customFields: CustomField[] }) {
  const missing = getMissingFields(employee);
  const total = Object.keys(ALL_FIELD_LABELS).length;
  const filled = total - missing.length;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div><h2 className="text-lg font-bold text-slate-900">{employee.fullName}</h2><p className="text-xs text-slate-500 font-mono" dir="ltr">#{employee.nationalNumber}</p></div>
          <div className="flex items-center gap-2">
            {canDelete && <button onClick={onDelete} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium flex items-center gap-1">🗑️ طلب حذف</button>}
            {canEdit && <button onClick={onEdit} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium flex items-center gap-1">✏️ تعديل</button>}
            {canPrint && <button onClick={onPrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">🖨️ طباعة</button>}
            {employee.phone && missing.length > 0 && (
              <button onClick={() => sendMissingFieldsViaWhatsApp(employee.phone, employee.fullName, missing)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1">💬 واتساب النواقص</button>
            )}
            {employee.phone && (
              <button onClick={() => openWhatsApp(employee.phone, "")} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1">📱 واتساب</button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(employee.status)}`}>الحالة: {employee.status || "-"}</span>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getDataCompleteBadge(employee.dataComplete)}`}>البيانات: {employee.dataComplete || "-"}</span>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">{employee.gender || "-"}</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-slate-700">نسبة اكتمال البيانات</span><span className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>{pct}% ({filled}/{total})</span></div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></div>
          </div>

          {missing.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><span className="text-lg">⚠️</span><h3 className="font-bold text-red-800 text-sm">نواقص البيانات ({missing.length} من {total})</h3></div>
              <div className="flex flex-wrap gap-1.5">{missing.map((m, i) => (<span key={i} className="bg-white text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-red-300 flex items-center gap-1"><span className="text-red-500">✗</span>{m}</span>))}</div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div className="flex items-center gap-2"><span className="text-lg">✅</span><span className="font-bold text-emerald-800 text-sm">جميع البيانات مكتملة</span></div></div>
          )}

          <DetailSection title="البيانات الأساسية">
            <DF label="الاسم رباعي" value={employee.fullName} required />
            <DF label="الرقم الوطني" value={employee.nationalNumber} mono required />
            <DF label="الرقم الوظيفي" value={employee.jobNumber} mono required />
            <DF label="الحالة الوظيفية" value={employee.jobStatus} />
            <DF label="نوع التوظيف" value={employee.employmentType} />
            <DF label="الجنس" value={employee.gender} />
          </DetailSection>
          <DetailSection title="البيانات الأكاديمية والوظيفية">
            <DF label="الدرجة الوظيفية" value={employee.jobGrade} required />
            <DF label="المؤهل العلمي" value={employee.qualification} required />
            <DF label="التخصص" value={employee.specialization} required />
            <DF label="التقدير" value={employee.grade} required />
            <DF label="أصل المؤهل / مكان الحصول" value={employee.qualificationOrigin} required full />
          </DetailSection>
          <DetailSection title="البيانات الإدارية والمالية">
            <DF label="اسم المصرف" value={employee.bankName} required />
            <DF label="رقم الحساب (IBAN)" value={employee.iban} mono required full />
            <DF label="يتقاضى معاش" value={employee.receivesPension} />
            <DF label="رقم قرار التعيين" value={employee.appointmentDecision} mono required />
            <DF label="تاريخ المباشرة" value={employee.startDate} required />
            <DF label="آخر ترقية" value={employee.promotionDate} required />
          </DetailSection>
          <DetailSection title="بيانات الاتصال والتنظيم">
            <DF label="الإدارة" value={employee.department} required />
            <DF label="القسم" value={employee.section} required />
            <DF label="رقم الهاتف" value={employee.phone} mono required />
          </DetailSection>
          {customFields.length > 0 && (
            <DetailSection title="بيانات إضافية (مخصصة)">
              {customFields.map((cf) => <DF key={cf.id} label={cf.label} value={employee[cf.label] || employee[cf.key] || ""} />)}
            </DetailSection>
          )}
          <DetailSection title="ملاحظات وإجراءات">
            <DF label="ملاحظات" value={employee.notes} full />
            <DF label="الإجراء المطلوب" value={employee.requiredAction} full />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div><div className="bg-indigo-600 text-white px-3 py-1.5 rounded-t-lg text-xs font-bold">{title}</div><div className="border border-indigo-200 border-t-0 rounded-b-lg p-3 grid grid-cols-2 gap-3 bg-white">{children}</div></div>);
}

function DF({ label, value, mono, required, full }: { label: string; value: string; mono?: boolean; required?: boolean; full?: boolean }) {
  const empty = isEmpty(value);
  return (<div className={full ? "col-span-2" : ""}><p className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">{label}{required && empty && <span className="text-red-500">*</span>}</p><p className={`text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`} dir={mono && !empty ? "ltr" : undefined}>{empty ? "— فارغ" : value}</p></div>);
}

function AddEmployeeModal({ customFields, onClose, onSave }: { customFields: CustomField[]; onClose: () => void; onSave: (emp: any) => void }) {
  const [values, setValues] = useState<Record<string, string>>({
    fullName: "", nationalNumber: "", jobNumber: "", bankName: "", iban: "", jobGrade: "", qualification: "", specialization: "", status: "تحت الاجراء", dataComplete: "غير مكتملة"
  });

  const handleSave = () => {
    if (!values.fullName.trim()) { alert("يرجى إدخال الاسم رباعي"); return; }
    if (values.nationalNumber.length !== 12) { alert("يرجى إدخال الرقم الوطني (12 رقماً بالضبط)"); return; }
    onSave(values);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><span className="text-xl">👤+</span><h2 className="text-lg font-bold text-slate-900">إضافة موظف جديد لملف الإكسل</h2></div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* الحقول الأساسية المطلوبة */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-800 mb-3">🔴 الحقول الأساسية (مطلوبة)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block font-medium">الاسم رباعي <span className="text-red-500">*</span></label>
                <input type="text" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="الاسم الكامل" />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني <span className="text-red-500">*</span></label>
                <input type="text" value={values.nationalNumber} onChange={(e) => setValues({ ...values, nationalNumber: e.target.value.replace(/[^\d]/g, "").slice(0, 12) })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-emerald-500 outline-none" dir="ltr" placeholder="12 رقماً" maxLength={12} inputMode="numeric" />
                <div className="mt-1 text-left text-[10px]" dir="ltr"><span className={values.nationalNumber.length === 12 ? "text-emerald-600 font-bold" : "text-slate-400"}>{values.nationalNumber.length}/12</span></div>
              </div>
            </div>
          </div>

          {/* باقي الحقول */}
          <p className="text-xs font-bold text-slate-600">باقي البيانات (اختيارية)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.filter((f) => f.key !== "fullName").map((f) => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input type="text" value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" dir={f.mono ? "ltr" : undefined} />
              </div>
            ))}
            {customFields.length > 0 && customFields.map((cf) => (
              <div key={cf.id}>
                <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
                <input type="text" value={values[cf.key] || ""} onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">➕ إضافة الموظف</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EMPLOYEE EDIT MODAL
   ============================================================ */
const EDITABLE_FIELDS: { key: string; label: string; mono?: boolean }[] = [
  { key: "fullName", label: "الاسم رباعي" },
  { key: "jobNumber", label: "الرقم الوظيفي", mono: true },
  { key: "jobGrade", label: "الدرجة الوظيفية" },
  { key: "qualification", label: "المؤهل العلمي" },
  { key: "specialization", label: "التخصص" },
  { key: "grade", label: "التقدير" },
  { key: "qualificationOrigin", label: "أصل المؤهل / مكان الحصول" },
  { key: "bankName", label: "المصرف" },
  { key: "iban", label: "رقم الحساب (IBAN)", mono: true },
  { key: "receivesPension", label: "يتقاضى معاش" },
  { key: "appointmentDecision", label: "رقم قرار التعيين", mono: true },
  { key: "startDate", label: "تاريخ المباشرة" },
  { key: "promotionDate", label: "آخر ترقية" },
  { key: "phone", label: "رقم الهاتف", mono: true },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "jobStatus", label: "الحالة الوظيفية" },
  { key: "employmentType", label: "نوع التوظيف" },
  { key: "gender", label: "الجنس" },
  { key: "status", label: "الحالة" },
  { key: "dataComplete", label: "اكتمال البيانات" },
  { key: "notes", label: "ملاحظات" },
  { key: "requiredAction", label: "الإجراء المطلوب" },
];

function EmployeeEditModal({ employee, customFields, onClose, onSave }: { employee: any; customFields: CustomField[]; onClose: () => void; onSave: (o: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((f) => { v[f.key] = employee[f.key] || ""; });
    customFields.forEach((cf) => { v[cf.key] = employee[cf.label] || employee[cf.key] || ""; });
    return v;
  });

  const handleSave = () => {
    // إرسال كل القيم المعبأة (بدون مقارنة) لضمان تحديث الإكسل دائماً
    const toSave: Record<string, string> = {};
    Object.entries(values).forEach(([k, v]) => {
      if (v !== undefined) toSave[k] = v;
    });
    onSave(toSave);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div><h2 className="text-lg font-bold text-slate-900">تعديل بيانات الموظف</h2><p className="text-xs text-slate-500 font-mono" dir="ltr">{employee.fullName} • #{employee.nationalNumber}</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-xl"><svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚠️ تنبيه: سيتم تحديث البيانات مباشرة في ملف Google Sheets الأصلي. يرجى التأكد من دقة المعلومات المدخلة.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input type="text" value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" dir={f.mono ? "ltr" : undefined} />
              </div>
            ))}
            {customFields.length > 0 && (
              <div className="col-span-2 pt-3 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-700 mb-2">📝 الحقول المخصصة</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customFields.map((cf) => (
                    <div key={cf.id}>
                      <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
                      <input type="text" value={values[cf.key] || ""} onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={handleSave} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">💾 حفظ التعديلات</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REPORTS TAB
   ============================================================ */
const QUALIFICATION_ORDER = [
  "الدكتوراه", "دكتوراه", "الماجستير", "ماجستير", "البكالوريوس", "بكالوريوس", "الليسانس", "ليسانس",
  "الدبلوم العالي", "المعهد العالي", "المعهد المتوسط", "الدبلوم المتوسط", "الشهادة الثانوية", "الإعدادية", "الابتدائية"
];

function normalizeQualification(value: string): string {
  const v = (value || "").trim();
  const found = QUALIFICATION_ORDER.find((q) => v.includes(q));
  return found || (v || "غير مسجل");
}

function ReportsTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldA, setFieldA] = useState("gender");
  const [fieldB, setFieldB] = useState("receivesPension");
  const [savedComparisons, setSavedComparisons] = useState<Array<{ id: string; fieldA: string; fieldB: string }>>([]);
  const customFields = getCustomFields();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      syncCustomFieldsFromSheet(data as any[]);
      setEmployees(mergeAllEmployees(data));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableFields = [
    { key: "gender", label: "الجنس" },
    { key: "receivesPension", label: "يتقاضى معاش" },
    { key: "status", label: "الحالة" },
    { key: "dataComplete", label: "اكتمال البيانات" },
    { key: "qualification", label: "المؤهل العلمي" },
    { key: "department", label: "الإدارة" },
    { key: "section", label: "القسم" },
    { key: "jobStatus", label: "الحالة الوظيفية" },
    { key: "employmentType", label: "نوع التوظيف" },
    ...customFields.map((cf) => ({ key: cf.label, label: cf.label })),
  ];

  const countBy = (field: string, includeUnspecified = true) => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      let value = (e[field] || "غير مسجل").toString().trim() || "غير مسجل";
      if (field === "qualification") value = normalizeQualification(value);
      if (!includeUnspecified && value === "غير مسجل") return;
      counts[value] = (counts[value] || 0) + 1;
    });
    let entries = Object.entries(counts);
    if (field === "qualification") {
      entries.sort((a, b) => {
        const ai = QUALIFICATION_ORDER.indexOf(a[0]);
        const bi = QUALIFICATION_ORDER.indexOf(b[0]);
        const aScore = ai === -1 ? 999 : ai;
        const bScore = bi === -1 ? 999 : bi;
        return aScore - bScore;
      });
    } else {
      entries.sort((a, b) => b[1] - a[1]);
    }
    return entries;
  };

  const compareCounts = useMemo(() => ({
    a: countBy(fieldA, false),
    b: countBy(fieldB, false),
    aUnspecified: countBy(fieldA, true).find(([k]) => k === "غير مسجل")?.[1] || 0,
    bUnspecified: countBy(fieldB, true).find(([k]) => k === "غير مسجل")?.[1] || 0,
  }), [employees, fieldA, fieldB]);

  const total = employees.length || 1;
  const totalLabel = `الإجمالي الكلي للموظفين: ${employees.length}`;

  const saveCurrentComparison = () => {
    const id = Date.now().toString();
    setSavedComparisons((prev) => [...prev, { id, fieldA, fieldB }]);
  };

  const removeSavedComparison = (id: string) => {
    setSavedComparisons((prev) => prev.filter((c) => c.id !== id));
  };

  const printReportsComparison = () => {
    const targets = savedComparisons.length > 0 ? savedComparisons : [{ id: "current", fieldA, fieldB }];
    const w = window.open("", "_blank", "width=1200,height=900,scrollbars=yes");
    if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
    const dt = new Date().toLocaleString("ar-LY");

    const renderComparisonBox = (fa: string, fb: string) => {
      const labelA = availableFields.find((f) => f.key === fa)?.label || fa;
      const labelB = availableFields.find((f) => f.key === fb)?.label || fb;
      const dataA = countBy(fa, false);
      const dataB = countBy(fb, false);
      const unA = countBy(fa, true).find(([k]) => k === "غير مسجل")?.[1] || 0;
      const unB = countBy(fb, true).find(([k]) => k === "غير مسجل")?.[1] || 0;

      const makeRows = (data: [string, number][]) => data.map(([label, count], idx) => {
        const pct = Math.round((count / total) * 100);
        return `<tr style="background:${idx % 2 === 0 ? '#f8fafc' : 'white'};"><td style="padding:7px;border:1px solid #e2e8f0;">${label}</td><td style="padding:7px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:#1e3a8a;">${count}</td><td style="padding:7px;border:1px solid #e2e8f0;text-align:center;">${pct}%</td></tr>`;
      }).join('');

      return `
      <div class="box" style="page-break-inside:avoid;">
        <div class="box-head">مقارنة: ${labelA} × ${labelB}</div>
        <div class="box-sub">${totalLabel}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;">
          <div>
            <h3 style="font-size:13px;color:#1e3a8a;margin-bottom:8px;">${labelA}</h3>
            <table><thead><tr><th>القيمة</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${makeRows(dataA)}</tbody></table>
            <div style="margin-top:6px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">غير مسجل: <strong>${unA}</strong></div>
          </div>
          <div>
            <h3 style="font-size:13px;color:#1e3a8a;margin-bottom:8px;">${labelB}</h3>
            <table><thead><tr><th>القيمة</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${makeRows(dataB)}</tbody></table>
            <div style="margin-top:6px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">غير مسجل: <strong>${unB}</strong></div>
          </div>
        </div>
      </div>`;
    };

    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>طباعة المقارنات</title><style>
      body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px;color:#222;background:#fff;}
      h1,h2,h3{margin:0;} .box{margin-bottom:18px;border:1px solid #dbe4ff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);}
      .box-head{background:linear-gradient(90deg,#1e3a8a,#4338ca);color:#fff;padding:12px 14px;font-size:14px;font-weight:bold;}
      .box-sub{padding:8px 14px;background:#f8fafc;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0;}
      table{width:100%;border-collapse:collapse;font-size:12px;} th{background:#eef2ff;padding:9px;border:1px solid #cbd5e1;} td{padding:9px;border:1px solid #e2e8f0;}
      .note{background:#fff7ed;border:1px solid #fdba74;padding:12px 14px;border-radius:10px;font-size:12px;color:#9a3412;margin-bottom:16px;line-height:1.8;}
      .meta{display:flex;justify-content:space-between;align-items:center;margin:10px 0 16px;font-size:11px;color:#64748b;}
      .hero{background:linear-gradient(90deg,#eff6ff,#eef2ff);border:1px solid #c7d2fe;border-radius:14px;padding:16px;margin-bottom:16px;}
      @media print{.no-print{display:none!important;} body{padding:10px;} .box{page-break-inside:avoid;}}
    </style></head><body>
      ${getHeaderHTML()}
      <div class="hero"><h2 style="color:#1e3a8a;font-size:20px;">تقرير المقارنات الإحصائية</h2><div style="margin-top:6px;font-size:12px;color:#475569;">تاريخ الطباعة: ${dt}</div><div style="margin-top:6px;font-size:12px;color:#0f172a;font-weight:bold;">${totalLabel}</div></div>
      <div class="note"><strong>مهم:</strong> تم استبعاد <strong>غير مسجل</strong> من المقارنة الأساسية حتى تكون النتائج أوضح. ويتم عرضه بشكل منفصل أسفل كل جدول. النسبة المئوية محسوبة من <strong>الإجمالي الكلي للموظفين</strong>.</div>
      ${targets.map((t) => renderComparisonBox(t.fieldA, t.fieldB)).join('')}
      ${getFooterHTML()}
      <button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة المقارنات</button>
    </body></html>`);
    w.document.close();
    addLog(session, "print_summary", `طباعة ${targets.length} مقارنة/مقارنات`);
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل التقارير...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">التقارير والرسوم البيانية</h2>
          <p className="text-xs text-slate-500">إحصاءات واضحة مع استبعاد غير المسجل من المقارنة الأساسية</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveCurrentComparison} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">➕ حفظ المقارنة الحالية</button>
          <button onClick={printReportsComparison} className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition">🖨️ طباعة المقارنات المختارة</button>
          <button onClick={() => { load(); addLog(session, "refresh_data", "تحديث التقارير"); }} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 transition">🔄 تحديث</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="عدد الذكور والإناث" subtitle={totalLabel} data={countBy("gender", false)} total={total} extraNote={`غير مسجل: ${countBy("gender", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`} />
        <ChartCard title="يتقاضى معاش / لا يتقاضى" subtitle={totalLabel} data={countBy("receivesPension", false)} total={total} extraNote={`غير مسجل: ${countBy("receivesPension", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="المؤهلات العلمية من الأعلى إلى الأدنى" subtitle={totalLabel} data={countBy("qualification", false)} total={total} extraNote={`غير مسجل: ${countBy("qualification", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`} />
        <ChartCard title="الحالة الوظيفية" subtitle={totalLabel} data={countBy("jobStatus", false)} total={total} extraNote={`غير مسجل: ${countBy("jobStatus", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">مقارنة مخصصة احترافية</h3>
          <p className="text-[11px] text-slate-500 mt-1">اختر الحقول التي تريد مقارنتها. سيتم استبعاد "غير مسجل" من الجدول الرئيسي وعرضه منفصلاً.</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 leading-6">
          <strong>توضيح:</strong> <strong>غير مسجل</strong> = حقل فارغ أو لم يتم تعبئته. <strong>الإجمالي الكلي</strong> = جميع موظفي المنظومة (${employees.length}).
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">الحقل الأول</label>
            <select value={fieldA} onChange={(e) => setFieldA(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              {availableFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">الحقل الثاني</label>
            <select value={fieldB} onChange={(e) => setFieldB(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              {availableFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <ChartCard title={`مقارنة: ${availableFields.find(f => f.key === fieldA)?.label || fieldA}`} subtitle={totalLabel} data={compareCounts.a} total={total} extraNote={`غير مسجل: ${compareCounts.aUnspecified}`} />
          <ChartCard title={`مقارنة: ${availableFields.find(f => f.key === fieldB)?.label || fieldB}`} subtitle={totalLabel} data={compareCounts.b} total={total} extraNote={`غير مسجل: ${compareCounts.bUnspecified}`} />
        </div>
      </div>

      {savedComparisons.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">المقارنات المحفوظة للطباعة ({savedComparisons.length})</h3>
            <span className="text-[11px] text-slate-500">سيتم طباعة هذه المقارنات فقط عند الضغط على زر الطباعة</span>
          </div>
          <div className="space-y-2">
            {savedComparisons.map((cmp, idx) => (
              <div key={cmp.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                <div className="text-sm text-slate-700">{idx + 1}. {availableFields.find(f => f.key === cmp.fieldA)?.label || cmp.fieldA} × {availableFields.find(f => f.key === cmp.fieldB)?.label || cmp.fieldB}</div>
                <button onClick={() => removeSavedComparison(cmp.id)} className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2.5 py-1 rounded text-xs font-medium transition">حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, data, total, extraNote }: { title: string; subtitle: string; data: [string, number][]; total: number; extraNote?: string }) {
  const max = Math.max(...data.map((d) => d[1]), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="mb-3">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
        {extraNote && <p className="text-[10px] text-amber-600 mt-1">{extraNote}</p>}
      </div>
      <div className="space-y-3">
        {data.length === 0 && <p className="text-sm text-slate-400">لا توجد بيانات</p>}
        {data.map(([label, count], idx) => {
          const pct = Math.round((count / total) * 100);
          const width = `${(count / max) * 100}%`;
          const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-cyan-500", "bg-pink-500", "bg-slate-500", "bg-red-500"];
          return (
            <div key={label + idx}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{count} ({pct}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${colors[idx % colors.length]}`} style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   DELETE REQUEST MODAL - نافذة طلب الحذف
   ============================================================ */
function printDeleteRequestsReport(requests: DeleteRequest[], title = "تقرير طلبات الحذف", dateRange = "") {
  const w = window.open("", "_blank", "width=1100,height=800,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة للطباعة"); return; }
  const rows = requests.map((r, i) => `
    <tr>
      <td>${i + 1}</td><td>${r.refNum}</td><td dir="ltr">${r.nationalNumber}</td><td>${r.employeeName}</td>
      <td>${r.reason || "-"}</td><td>${r.docNumber || "-"}</td><td>${r.submittedBy || "-"}</td>
      <td>${r.submitDate || "-"}</td><td>${r.status || "-"}</td><td>${r.adminNote || "-"}</td><td>${r.adminDate || "-"}</td>
    </tr>`).join("");
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>
    body{font-family:Tahoma,Arial,sans-serif;padding:20px;color:#172033} table{width:100%;border-collapse:collapse;font-size:11px} th{background:#1e3a8a;color:white;padding:8px;border:1px solid #1e3a8a} td{padding:7px;border:1px solid #dbe4ee} tr:nth-child(even){background:#f8fafc}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.note{font-size:11px;color:#64748b}.no-print{position:fixed;bottom:20px;left:20px;padding:10px 22px;background:#1e3a8a;color:white;border:0;border-radius:8px}@media print{.no-print{display:none}}
  </style></head><body>${getHeaderHTML()}<div class="head"><div><h2>${title}</h2><div class="note">تاريخ الطباعة: ${new Date().toLocaleString("ar-LY")}${dateRange ? `<br>الفترة: ${dateRange}` : ""}</div></div><div class="note">عدد الطلبات: <b>${requests.length}</b></div></div><table><thead><tr><th>#</th><th>المرجع</th><th>الرقم الوطني</th><th>الاسم</th><th>السبب</th><th>رقم القرار</th><th>بواسطة</th><th>تاريخ الطلب</th><th>الحالة</th><th>ملاحظة المدير</th><th>تاريخ القرار</th></tr></thead><tbody>${rows}</tbody></table>${getFooterHTML()}<button class="no-print" onclick="window.print()">طباعة</button></body></html>`);
  w.document.close();
}

function printArchiveReport(entries: any[], title = "تقرير أرشيف الموظفين", dateRange = "") {
  const w = window.open("", "_blank", "width=1100,height=800,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة للطباعة"); return; }
  const rows = entries.map((e, i) => `
    <tr><td>${i + 1}</td><td dir="ltr">${e["الرقم الوطني"] || "-"}</td><td>${e["الاســـم ربــاعـــي"] || "-"}</td><td>${e["الإدارة"] || "-"}</td><td>${e["تاريخ الأرشفة"] || "-"}</td><td>${e["المؤرشف بواسطة"] || "-"}</td><td>${e["ر/ سند الحذف"] || "-"}</td><td>${e["ملاحظة المدير والسبب النهائي"] || "-"}</td></tr>`).join("");
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>
    body{font-family:Tahoma,Arial,sans-serif;padding:20px;color:#172033} table{width:100%;border-collapse:collapse;font-size:11px} th{background:#1e3a8a;color:white;padding:8px;border:1px solid #1e3a8a} td{padding:7px;border:1px solid #dbe4ee} tr:nth-child(even){background:#f8fafc}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.note{font-size:11px;color:#64748b}.no-print{position:fixed;bottom:20px;left:20px;padding:10px 22px;background:#1e3a8a;color:white;border:0;border-radius:8px}@media print{.no-print{display:none}}
  </style></head><body>${getHeaderHTML()}<div class="head"><div><h2>${title}</h2><div class="note">تاريخ الطباعة: ${new Date().toLocaleString("ar-LY")}${dateRange ? `<br>الفترة: ${dateRange}` : ""}</div></div><div class="note">عدد السجلات: <b>${entries.length}</b></div></div><table><thead><tr><th>#</th><th>الرقم الوطني</th><th>الاسم</th><th>الإدارة</th><th>تاريخ الأرشفة</th><th>المؤرشف بواسطة</th><th>رقم الإشارة</th><th>السبب النهائي</th></tr></thead><tbody>${rows}</tbody></table>${getFooterHTML()}<button class="no-print" onclick="window.print()">طباعة</button></body></html>`);
  w.document.close();
}

function printRestoreReceipt(emp: any, restoredBy: string) {
  const ref = `RES-${Date.now().toString(36).toUpperCase()}`;
  const w = window.open("", "_blank", "width=800,height=900,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة للطباعة"); return; }
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="UTF-8"><title>إشعار استعادة</title><style>
    body{font-family:Tahoma,Arial,sans-serif;padding:28px;color:#172033}.card{border:2px solid #1e3a8a;border-radius:16px;padding:22px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding:9px 0;font-size:13px}.label{color:#64748b}.value{font-weight:bold}.sig{display:flex;justify-content:space-between;margin-top:45px}.line{border-top:1px solid #334155;width:180px;text-align:center;padding-top:6px;font-size:11px;color:#64748b}.no-print{position:fixed;bottom:20px;left:20px;padding:10px 22px;background:#1e3a8a;color:white;border:0;border-radius:8px}@media print{.no-print{display:none}}
  </style></head><body>${getHeaderHTML()}<div class="card"><h2 style="color:#1e3a8a;margin-top:0">إشعار استعادة موظف من الأرشيف</h2><div class="row"><span class="label">رقم الإشارة</span><span class="value" dir="ltr">${ref}</span></div><div class="row"><span class="label">الاسم</span><span class="value">${emp["الاســـم ربــاعـــي"] || "-"}</span></div><div class="row"><span class="label">الرقم الوطني</span><span class="value" dir="ltr">${emp["الرقم الوطني"] || "-"}</span></div><div class="row"><span class="label">تاريخ الاستعادة</span><span class="value">${new Date().toLocaleString("ar-LY")}</span></div><div class="row"><span class="label">تمت بواسطة</span><span class="value">${restoredBy}</span></div><div class="row"><span class="label">مرجع الأرشفة السابق</span><span class="value">${emp["ر/ سند الحذف"] || "-"}</span></div><div class="sig"><div class="line">توقيع المسؤول</div><div class="line">ختم الإدارة</div></div></div>${getFooterHTML()}<button class="no-print" onclick="window.print()">طباعة الإشعار</button></body></html>`);
  w.document.close();
}

function DeleteRequestModal({ employee, session, onClose, onSuccess }: {
  employee: any; session: Session; onClose: () => void; onSuccess: () => void;
}) {
  const [reason, setReason] = useState(DELETE_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (submitted || submitting) return; // منع الضغط المتكرر
    setError("");
    const finalReason = reason === "أخرى" ? otherReason.trim() : reason;
    if (!finalReason) { setError("يرجى اختيار أو كتابة سبب الحذف"); return; }
    if (!docNumber.trim()) { setError("يرجى إدخال رقم القرار أو المستند"); return; }
    if (!docDate) { setError("يرجى إدخال تاريخ القرار"); return; }
    setSubmitting(true);
    try {
      // فحص التكرار من Google Sheets مباشرة
      const existing = await getDeleteRequests();
      const duplicate = existing.find((r) =>
        r.nationalNumber.replace(/[^\d]/g, "") === employee.nationalNumber.replace(/[^\d]/g, "") &&
        r.status === "قيد المراجعة"
      );
      if (duplicate) {
        setError(`يوجد طلب حذف قائم بالفعل لهذا الموظف. رقم الطلب: ${duplicate.refNum}`);
        setSubmitting(false);
        return;
      }

      // تعطيل الزر فوراً لمنع الضغط المزدوج
      setSubmitted(true);

      await requestEmployeeDelete({
        nationalNumber: employee.nationalNumber,
        employeeName: employee.fullName,
        reason: finalReason,
        docNumber, docDate,
        submittedBy: session.fullName,
      });

      addLog(session, "delete_user", `طلب حذف موظف: ${employee.fullName} (${employee.nationalNumber}) - السبب: ${finalReason}`);
      window.dispatchEvent(new Event("delete-requests-changed"));
      alert("✅ تم تقديم طلب الحذف بنجاح. سيتم مراجعته من قبل المدير العام.");
      onSuccess();
    } catch { setError("فشل الاتصال. حاول مرة أخرى."); setSubmitted(false); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗑️</span>
            <div>
              <h3 className="font-bold text-red-800">طلب حذف موظف</h3>
              <p className="text-xs text-red-600">سيتم إرسال الطلب للمدير العام للموافقة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500">الموظف</p>
            <p className="font-bold text-slate-800">{employee.fullName}</p>
            <p className="text-xs text-slate-500 font-mono mt-1" dir="ltr">{employee.nationalNumber}</p>
          </div>

          <div>
            <label className="text-xs text-slate-600 font-medium mb-1 block">سبب الحذف <span className="text-red-500">*</span></label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none">
              {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {reason === "أخرى" && (
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">اكتب السبب <span className="text-red-500">*</span></label>
              <textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="اكتب سبب الحذف..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">رقم القرار/المستند <span className="text-red-500">*</span></label>
              <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="مثال: 123/2026" />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">تاريخ القرار <span className="text-red-500">*</span></label>
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
            ℹ️ جميع الحقول المؤشرة بـ <span className="text-red-500 font-bold">*</span> إلزامية. لا يمكن تقديم الطلب بدون استكمالها.
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 text-center">{error}</div>}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
            ⚠️ تنبيه: الموظف لن يُحذف فوراً. سيتم إرسال طلبك للمدير العام للموافقة، ثم سيُنقل إلى أرشيف الموظفين (لا حذف نهائي).
          </div>
        </div>
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} disabled={submitting || submitted} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">
            {submitted ? "✅ تم الإرسال" : submitting ? "⏳ جاري الإرسال..." : "📤 إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DELETE REQUESTS TAB - تبويب طلبات الحذف
   ============================================================ */
function DeleteRequestsTab({ session }: { session: Session }) {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionModal, setActionModal] = useState<{ request: DeleteRequest; type: "approve" | "reject" } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanMonths, setCleanMonths] = useState(6);
  const [cleaning, setCleaning] = useState(false);

  const handleCleanRequests = async () => {
    if (!confirm(`هل أنت متأكد من حذف الطلبات المعالجة (مقبول/مرفوض) الأقدم من ${cleanMonths} شهر؟`)) return;
    setCleaning(true);
    try {
      const result = await cleanDeleteRequests(cleanMonths, true);
      if (result.status === "success") {
        addLog(session, "clean_archive", `تنظيف طلبات الحذف القديمة (${cleanMonths} شهر)`);
        alert("✅ تم تنظيف الطلبات القديمة بنجاح");
        setShowCleanModal(false);
        setTimeout(() => { /* لا داعي لاستخدام load هنا، استخدم الـ ref */ window.location.reload(); }, 1500);
      }
    } catch { alert("❌ فشل التنظيف"); }
    finally { setCleaning(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeleteRequests();
      setRequests(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = filter === "all" ? requests : requests.filter((r) => {
      const map: any = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
      return r.status === map[filter];
    });
    // فلترة بالتاريخ: نحول submitDate لتاريخ JS للمقارنة
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate + "T23:59:59").getTime() : Date.now() + 86400000;
      res = res.filter((r) => {
        if (!r.submitDate) return false;
        // محاولة استخراج التاريخ من الصيغة المحلية "10:23:15 ص 2026/06/03"
        const parts = r.submitDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (!parts) return true;
        const dt = new Date(`${parts[1]}-${String(parts[2]).padStart(2, "0")}-${String(parts[3]).padStart(2, "0")}`).getTime();
        return dt >= start && dt <= end;
      });
    }
    return res;
  }, [requests, filter, startDate, endDate]);

  const dateRangeStr = useMemo(() => {
    if (!startDate && !endDate) return "";
    return `من ${startDate || "الأول"} إلى ${endDate || "اليوم"}`;
  }, [startDate, endDate]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === "قيد المراجعة").length,
    approved: requests.filter((r) => r.status === "مقبول").length,
    rejected: requests.filter((r) => r.status === "مرفوض").length,
  }), [requests]);

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الطلبات...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">📋 طلبات حذف الموظفين</h2>
          <p className="text-xs text-slate-500">مراجعة طلبات الحذف المعلقة والموافقة عليها أو رفضها</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => printDeleteRequestsReport(filtered, "تقرير طلبات الحذف المعروضة", dateRangeStr)} className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100">🖨️ طباعة المعروض</button>
          <button onClick={() => printDeleteRequestsReport(requests, "تقرير كامل لطلبات الحذف")} className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100">📄 طباعة الكل</button>
          {session.permissions.canApproveDelete && (
            <button onClick={() => setShowCleanModal(true)} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">🧹 تنظيف القديم</button>
          )}
          <button onClick={load} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">🔄 تحديث</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="📊" />
        <StatCard label="قيد المراجعة" value={stats.pending} color="amber" icon="⏳" />
        <StatCard label="مقبولة" value={stats.approved} color="emerald" icon="✅" />
        <StatCard label="مرفوضة" value={stats.rejected} color="red" icon="❌" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "all" ? "الكل" : f === "pending" ? "قيد المراجعة" : f === "approved" ? "مقبول" : "مرفوض"}
          </button>
        ))}
        <div className="flex items-center gap-2 mr-auto">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" placeholder="من تاريخ" />
          <span className="text-xs text-slate-500">إلى</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" placeholder="إلى تاريخ" />
        </div>
        <span className="text-xs text-slate-500">{filtered.length} طلب</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right">رقم الطلب</th>
                <th className="px-3 py-2 text-right">الموظف</th>
                <th className="px-3 py-2 text-right">الرقم الوطني</th>
                <th className="px-3 py-2 text-right">السبب</th>
                <th className="px-3 py-2 text-right">رقم القرار</th>
                <th className="px-3 py-2 text-right">تاريخ التقديم</th>
                <th className="px-3 py-2 text-right">بواسطة</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-400">لا توجد طلبات</td></tr>
              ) : filtered.map((req) => (
                <tr key={req.refNum} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[10px]" dir="ltr">{req.refNum}</td>
                  <td className="px-3 py-2 font-medium">{req.employeeName}</td>
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{req.nationalNumber}</td>
                  <td className="px-3 py-2 max-w-[150px] truncate" title={req.reason}>{req.reason}</td>
                  <td className="px-3 py-2 text-slate-600">{req.docNumber || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">{req.submitDate}</td>
                  <td className="px-3 py-2 text-slate-600">{req.submittedBy}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      req.status === "مقبول" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                      req.status === "مرفوض" ? "bg-red-100 text-red-800 border-red-200" :
                      "bg-amber-100 text-amber-800 border-amber-200"
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    {req.status === "قيد المراجعة" && session.permissions.canApproveDelete && (
                      <div className="flex gap-1">
                        <button onClick={() => setActionModal({ request: req, type: "approve" })}
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          ✅ موافقة
                        </button>
                        <button onClick={() => setActionModal({ request: req, type: "reject" })}
                          className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          ❌ رفض
                        </button>
                      </div>
                    )}
                    {req.status !== "قيد المراجعة" && req.adminNote && (
                      <span className="text-[10px] text-slate-500" title={req.adminNote}>عرض الملاحظة</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionModal && <ActionRequestModal request={actionModal.request} type={actionModal.type} session={session} onClose={() => setActionModal(null)} onSuccess={() => { setActionModal(null); load(); }} />}

      {showCleanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCleanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-red-800">🧹 تنظيف طلبات الحذف القديمة</h3>
              <button onClick={() => setShowCleanModal(false)} className="p-2 hover:bg-red-100 rounded">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ سيتم حذف الطلبات <strong>المعالجة فقط</strong> (المقبولة والمرفوضة). الطلبات قيد المراجعة لن تُحذف.
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                ℹ️ هذا الإجراء لتقليل حجم البيانات في الجدول. السجلات في الأرشيف تبقى محفوظة.
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">احذف الطلبات الأقدم من (بالأشهر)</label>
                <input type="number" value={cleanMonths} onChange={(e) => setCleanMonths(parseInt(e.target.value) || 6)} min="1" max="120"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCleanModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={handleCleanRequests} disabled={cleaning} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {cleaning ? "جاري التنظيف..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRequestModal({ request, type, session, onClose, onSuccess }: {
  request: DeleteRequest; type: "approve" | "reject"; session: Session;
  onClose: () => void; onSuccess: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (done || submitting) return;
    setError("");
    if (!note.trim()) { setError(type === "approve" ? "يرجى إدخال ملاحظة الموافقة أو سبب القبول" : "يرجى إدخال سبب الرفض"); return; }
    setSubmitting(true);
    setDone(true);
    try {
      const result = type === "approve"
        ? await approveDeleteRequest(request.refNum, note, session.fullName)
        : await rejectDeleteRequest(request.refNum, note);
      if (result.status === "success") {
        addLog(session, type === "approve" ? "delete_user" : "update_user",
          `${type === "approve" ? "موافقة على حذف" : "رفض حذف"}: ${request.employeeName} (${request.nationalNumber})`);
        window.dispatchEvent(new Event("delete-requests-changed"));
        // إخبار EmployeesTab بإزالة الموظف فورياً من القائمة المحلية
        if (type === "approve") {
          window.dispatchEvent(new CustomEvent("employee-removed", { detail: { nationalNumber: request.nationalNumber } }));
        }
        alert(type === "approve" ? "✅ تم نقل الموظف إلى الأرشيف" : "✅ تم رفض الطلب");
        printDeleteRequestsReport([{ ...request, status: type === "approve" ? "مقبول" : "مرفوض", adminNote: note, adminDate: new Date().toLocaleString("ar-LY") }], type === "approve" ? "إشعار موافقة على طلب حذف" : "إشعار رفض طلب حذف");
        setTimeout(() => onSuccess(), 1500);
      }
    } catch { alert("فشل التنفيذ"); setDone(false); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className={`px-5 py-4 border-b ${type === "approve" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <h3 className="font-bold">{type === "approve" ? "✅ الموافقة على طلب الحذف" : "❌ رفض طلب الحذف"}</h3>
          <p className="text-xs text-slate-600 mt-1">{request.employeeName} • {request.nationalNumber}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <div><span className="text-slate-500">السبب:</span> <strong>{request.reason}</strong></div>
            <div><span className="text-slate-500">طلب بواسطة:</span> {request.submittedBy}</div>
            <div><span className="text-slate-500">تاريخ:</span> {request.submitDate}</div>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium mb-1 block">ملاحظات المدير <span className="text-red-500">*</span></label>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={type === "approve" ? "سبب الموافقة على الحذف..." : "سبب الرفض..."} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 text-center">{error}</div>}
          {type === "approve" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
              ⚠️ سيتم نقل الموظف إلى أرشيف الموظفين فوراً. يمكن استعادته لاحقاً من تبويب الأرشيف.
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} disabled={submitting || done} className={`px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
            {done ? "✅ تم" : submitting ? "⏳ جاري التنفيذ..." : type === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ARCHIVE TAB - تبويب الأرشيف
   ============================================================ */
function ArchiveTab({ session }: { session: Session }) {
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanMonths, setCleanMonths] = useState(12);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArchivedEmployees();
      setArchived(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = archived;
    if (search) {
      const s = search.toLowerCase();
      res = res.filter((e) =>
        (e["الاســـم ربــاعـــي"] || "").toLowerCase().includes(s) ||
        (e["الرقم الوطني"] || "").toString().includes(s)
      );
    }
    if (startDate) res = res.filter((e) => (e["تاريخ الأرشفة"] || "") >= startDate);
    if (endDate) res = res.filter((e) => (e["تاريخ الأرشفة"] || "") <= endDate);
    return res;
  }, [archived, search, startDate, endDate]);

  const dateRangeStr = useMemo(() => {
    if (!startDate && !endDate) return "";
    return `من ${startDate || "الأول"} إلى ${endDate || "اليوم"}`;
  }, [startDate, endDate]);

  const handleCleanArchive = async () => {
    if (!confirm(`هل أنت متأكد من حذف جميع السجلات الأقدم من ${cleanMonths} شهر؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    setCleaning(true);
    try {
      const result = await cleanArchive(cleanMonths);
      if (result.status === "success") {
        addLog(session, "clean_archive", `تنظيف الأرشيف: حذف السجلات الأقدم من ${cleanMonths} شهر`);
        alert("✅ تم إرسال طلب تنظيف الأرشيف بنجاح");
        setShowCleanModal(false);
        setTimeout(() => load(), 1500);
      } else {
        alert("❌ فشل تنظيف الأرشيف");
      }
    } catch {
      alert("❌ فشل الاتصال");
    } finally {
      setCleaning(false);
    }
  };

  const restore = async (emp: any) => {
    const name = emp["الاســـم ربــاعـــي"];
    const nn = emp["الرقم الوطني"];
    if (!confirm(`هل أنت متأكد من استعادة الموظف "${name}" إلى القائمة الرئيسية؟`)) return;
    const result = await restoreEmployeeFromArchive(nn.toString());
    if (result.status === "success") {
      addLog(session, "restore_archive", `استعادة موظف من الأرشيف: ${name} (${nn})`);
      alert("✅ تم استعادة الموظف بنجاح");
      printRestoreReceipt(emp, session.fullName);
      setTimeout(() => load(), 1500);
    } else { alert("❌ فشل الاستعادة"); }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الأرشيف...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🗄️ أرشيف الموظفين</h2>
          <p className="text-xs text-slate-500">الموظفون المؤرشفون - يمكن استعادتهم في أي وقت</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">{archived.length} موظف مؤرشف</span>
          <button onClick={() => printArchiveReport(filtered, "تقرير الأرشيف المعروض", dateRangeStr)} className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100">🖨️ طباعة المعروض</button>
          <button onClick={() => printArchiveReport(archived, "تقرير كامل لأرشيف الموظفين")} className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100">📄 طباعة الكل</button>
          <button onClick={() => setShowCleanModal(true)} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">🗑️ تنظيف الأرشيف</button>
          <button onClick={load} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">🔄 تحديث</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="🔍 ابحث بالاسم أو الرقم الوطني..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-xs" placeholder="من تاريخ" />
          <span className="text-xs text-slate-500">إلى</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-xs" placeholder="إلى تاريخ" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right">الرقم الوطني</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الإدارة</th>
                <th className="px-3 py-2 text-right">تاريخ الأرشفة</th>
                <th className="px-3 py-2 text-right">المؤرشف بواسطة</th>
                <th className="px-3 py-2 text-right">سبب الحذف</th>
                <th className="px-3 py-2 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400">لا توجد موظفون في الأرشيف</td></tr>
              ) : filtered.map((emp, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp["الرقم الوطني"]}</td>
                  <td className="px-3 py-2 font-medium">{emp["الاســـم ربــاعـــي"]}</td>
                  <td className="px-3 py-2 text-slate-600">{emp["الإدارة"] || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">{emp["تاريخ الأرشفة"] || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{emp["المؤرشف بواسطة"] || "—"}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={emp["ملاحظة المدير والسبب النهائي"]}>{emp["ملاحظة المدير والسبب النهائي"] || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => setSelected(emp)}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">
                        👁️ تفاصيل
                      </button>
                      {session.permissions.canRestoreArchive && (
                        <button onClick={() => restore(emp)}
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          ♻️ استعادة
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">📦 {selected["الاســـم ربــاعـــي"]}</h3>
                <p className="text-xs text-slate-500 font-mono" dir="ltr">{selected["الرقم الوطني"]}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-200 rounded">✕</button>
            </div>
            <div className="p-5 space-y-2">
              {Object.entries(selected).filter(([k, v]) => k && v).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 px-2 py-1.5 bg-slate-50 rounded">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className="col-span-2 text-sm text-slate-800 break-words">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إغلاق</button>
              {session.permissions.canRestoreArchive && (
                <button onClick={() => { setSelected(null); restore(selected); }} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">♻️ استعادة</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCleanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCleanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-red-800">🗑️ تنظيف الأرشيف</h3>
              <button onClick={() => setShowCleanModal(false)} className="p-2 hover:bg-red-100 rounded">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ تحذير: هذا الإجراء سيحذف نهائياً جميع السجلات الأقدم من المدة المحددة. لا يمكن التراجع عن هذا الإجراء.
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">احذف السجلات الأقدم من (بالأشهر)</label>
                <input type="number" value={cleanMonths} onChange={(e) => setCleanMonths(parseInt(e.target.value) || 12)} min="1" max="120"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCleanModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={handleCleanArchive} disabled={cleaning} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {cleaning ? "جاري التنظيف..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CODES TAB - إدارة أكواد الموظفين
   ============================================================ */
function CodesTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired" | "no_code">("all");
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<{ emp: any; code: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      setEmployees(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getEmpCode = (nn: string) => {
    try { return JSON.parse(localStorage.getItem(`emp_code_${nn}`) || "{}"); } catch { return {}; }
  };

  const enriched = useMemo(() => employees.map((e) => {
    const stored = getEmpCode(e.nationalNumber);
    let status = "بدون كود";
    if (stored.blocked) status = "محجوب";
    else if (stored.code) {
      const lastLogin = stored.lastLogin ? new Date(stored.lastLogin) : null;
      if (lastLogin) {
        const diffDays = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 90) status = "منتهي";
        else status = "نشط";
      } else status = "جديد";
    }
    return {
      ...e,
      code: stored.code || "",
      codeType: stored.type || "",
      lastLogin: stored.lastLogin ? new Date(stored.lastLogin).toLocaleDateString("ar-LY") : "—",
      expiry: stored.expiry ? new Date(stored.expiry).toLocaleDateString("ar-LY") : "—",
      attempts: stored.attempts || 0,
      blockReason: stored.blockReason || "",
      empStatus: status,
    };
  }), [employees]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((e) => e.nationalNumber.includes(s) || e.fullName.toLowerCase().includes(s));
    }
    if (statusFilter !== "all") {
      const map: any = { active: "نشط", blocked: "محجوب", expired: "منتهي", no_code: "بدون كود" };
      r = r.filter((e) => e.empStatus === map[statusFilter]);
    }
    return r;
  }, [enriched, search, statusFilter]);

  const stats = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter((e) => e.empStatus === "نشط").length,
    blocked: enriched.filter((e) => e.empStatus === "محجوب").length,
    expired: enriched.filter((e) => e.empStatus === "منتهي").length,
    noCode: enriched.filter((e) => e.empStatus === "بدون كود" || e.empStatus === "جديد").length,
  }), [enriched]);

  const generateCodeFor = (emp: any) => {
    const newCode = generateRandomCode();
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 90);
    localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify({
      code: newCode, type: "شخصي",
      firstLogin: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      expiry: expiry.toISOString(),
      blocked: false, attempts: 0,
    }));
    setShowCodeModal({ emp, code: newCode });
    addLog(session, "create_user", `توليد كود جديد للموظف: ${emp.fullName} (${emp.nationalNumber})`);
    load();
  };

  const unblock = (emp: any) => {
    if (!confirm(`فك حجب الموظف "${emp.fullName}" وتوليد كود جديد؟`)) return;
    generateCodeFor(emp);
  };

  const resetAttempts = (emp: any) => {
    const stored = getEmpCode(emp.nationalNumber);
    localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify({ ...stored, attempts: 0 }));
    load();
  };

  const printCard = (emp: any, code: string) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>بطاقة كود - ${emp.fullName}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; padding: 20px; background: #f1f5f9; }
  .card { background: white; border: 3px solid #1e3a8a; border-radius: 16px; padding: 24px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
  .header { text-align: center; border-bottom: 2px dashed #b8860b; padding-bottom: 12px; margin-bottom: 16px; }
  .header img { width: 60px; height: 60px; }
  .title { color: #1e3a8a; font-size: 14px; font-weight: bold; margin: 8px 0 4px; }
  .subtitle { color: #b8860b; font-size: 11px; }
  .label { color: #64748b; font-size: 10px; margin-top: 12px; }
  .value { color: #1e293b; font-size: 14px; font-weight: bold; }
  .code-box { background: linear-gradient(135deg,#1e3a8a,#4338ca); color: white; padding: 16px; border-radius: 12px; text-align: center; margin: 16px 0; }
  .code-label { font-size: 10px; opacity: 0.8; margin-bottom: 6px; }
  .code-value { font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; }
  .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 10px; color: #92400e; text-align: center; }
  .footer { text-align: center; margin-top: 16px; font-size: 9px; color: #94a3b8; }
  @media print { body { background: white; padding: 0; } .no-print { display: none; } }
</style></head><body>
<div class="card">
  <div class="header">
    <img src="/images/nacc-logo.png" alt="NACC" />
    <div class="title">الهيئة الوطنية لمكافحة الفساد</div>
    <div class="subtitle">ديوان المنطقة الغربية</div>
  </div>
  <div style="text-align:center;font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;">بطاقة دخول المنظومة</div>
  <div class="label">الاسم:</div>
  <div class="value">${emp.fullName}</div>
  <div class="label">الرقم الوطني:</div>
  <div class="value" style="font-family:monospace;direction:ltr;text-align:right;">${emp.nationalNumber}</div>
  <div class="code-box">
    <div class="code-label">🔐 كود الدخول:</div>
    <div class="code-value">${code}</div>
  </div>
  <div class="warning">⚠️ هذا الكود سري للغاية. لا تشاركه مع أي شخص.</div>
  <div class="footer">تصميم: S-BUTTO • ${new Date().toLocaleDateString("ar-LY")}</div>
</div>
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ طباعة</button>
</body></html>`);
    w.document.close();
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🔑 إدارة أكواد الموظفين</h2>
          <p className="text-xs text-slate-500">عرض، توليد، فك حجب، وطباعة بطاقات الأكواد</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">🔄 تحديث</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="👥" />
        <StatCard label="نشط" value={stats.active} color="emerald" icon="✅" />
        <StatCard label="محجوب" value={stats.blocked} color="red" icon="🚫" />
        <StatCard label="منتهي" value={stats.expired} color="amber" icon="⏰" />
        <StatCard label="بدون كود" value={stats.noCode} color="slate" icon="❓" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="ابحث بالاسم أو الرقم الوطني..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="blocked">محجوب</option>
          <option value="expired">منتهي</option>
          <option value="no_code">بدون كود</option>
        </select>
        <span className="text-xs text-slate-500 mr-auto">{filtered.length} / {enriched.length}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right">الرقم الوطني</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الكود الحالي</th>
                <th className="px-3 py-2 text-right">آخر دخول</th>
                <th className="px-3 py-2 text-right">انتهاء الصلاحية</th>
                <th className="px-3 py-2 text-right">المحاولات</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map((emp) => (
                <tr key={emp.nationalNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp.nationalNumber}</td>
                  <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                  <td className="px-3 py-2 font-mono font-bold">
                    {emp.code ? <span className="bg-indigo-50 text-indigo-800 px-2 py-1 rounded border border-indigo-200">{emp.code}</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{emp.lastLogin}</td>
                  <td className="px-3 py-2 text-slate-600">{emp.expiry}</td>
                  <td className="px-3 py-2 text-center">
                    {emp.attempts > 0 ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{emp.attempts}/3</span> : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      emp.empStatus === "نشط" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                      emp.empStatus === "محجوب" ? "bg-red-100 text-red-800 border-red-200" :
                      emp.empStatus === "منتهي" ? "bg-amber-100 text-amber-800 border-amber-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>{emp.empStatus}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {!emp.code && <button onClick={() => generateCodeFor(emp)} className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">توليد كود</button>}
                      {emp.code && <button onClick={() => generateCodeFor(emp)} className="text-amber-700 hover:text-white hover:bg-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-medium transition">كود جديد</button>}
                      {emp.code && <button onClick={() => printCard(emp, emp.code)} className="text-slate-700 hover:text-white hover:bg-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-medium transition">🖨️ بطاقة</button>}
                      {emp.code && emp.phone && <button onClick={() => sendCodeViaWhatsApp(emp.phone, emp.fullName, emp.code)} className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">💬 واتساب</button>}
                      {emp.empStatus === "محجوب" && <button onClick={() => unblock(emp)} className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">فك الحجب</button>}
                      {emp.attempts > 0 && emp.empStatus !== "محجوب" && <button onClick={() => resetAttempts(emp)} className="text-blue-700 hover:text-white hover:bg-blue-600 border border-blue-200 px-2 py-1 rounded text-[10px] font-medium transition">صفّر المحاولات</button>}
                      <button onClick={() => setSelectedEmp(emp)} className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">تفاصيل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && <p className="text-center text-xs text-slate-500 p-3 bg-slate-50">يُعرض 100 موظف فقط. ابحث للوصول للباقي.</p>}
      </div>

      {/* Code modal */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCodeModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center space-y-3">
              <div className="text-5xl">✅</div>
              <h3 className="text-lg font-bold text-slate-800">تم توليد الكود بنجاح</h3>
              <p className="text-sm text-slate-600">{showCodeModal.emp.fullName}</p>
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl p-6 my-4">
                <p className="text-xs opacity-80 mb-2">كود الدخول الجديد</p>
                <p className="font-mono text-4xl font-bold tracking-widest">{showCodeModal.code}</p>
              </div>
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠️ سلّم الكود للموظف بشكل آمن. لا يمكن استرجاعه لاحقاً.</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => printCard(showCodeModal.emp, showCodeModal.code)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium">🖨️ طباعة بطاقة</button>
                {showCodeModal.emp.phone && (
                  <button onClick={() => sendCodeViaWhatsApp(showCodeModal.emp.phone, showCodeModal.emp.fullName, showCodeModal.code)} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">💬 إرسال واتساب</button>
                )}
                <button onClick={() => setShowCodeModal(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {selectedEmp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEmp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-3">{selectedEmp.fullName}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">الرقم الوطني:</span><span className="font-mono" dir="ltr">{selectedEmp.nationalNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الكود:</span><span className="font-mono font-bold">{selectedEmp.code || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">نوع الكود:</span><span>{selectedEmp.codeType || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">آخر دخول:</span><span>{selectedEmp.lastLogin}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">انتهاء الصلاحية:</span><span>{selectedEmp.expiry}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">المحاولات:</span><span>{selectedEmp.attempts}/3</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الحالة:</span><span className="font-bold">{selectedEmp.empStatus}</span></div>
              {selectedEmp.blockReason && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700"><strong>سبب الحجب:</strong> {selectedEmp.blockReason}</div>}
            </div>
            <button onClick={() => setSelectedEmp(null)} className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   USERS TAB
   ============================================================ */
function UsersTab({ session }: { session: Session }) {
  const [users, setUsers] = useState<User[]>(getUsers());
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permsUser, setPermsUser] = useState<User | null>(null);

  const refresh = () => setUsers(getUsers());

  const handleToggle = (u: User) => {
    if (!confirm(`${u.isActive ? "تعطيل" : "تفعيل"} المستخدم "${u.fullName}"؟`)) return;
    updateUser(u.id, { isActive: !u.isActive });
    addLog(session, "toggle_user", `${u.isActive ? "تعطيل" : "تفعيل"}: ${u.fullName} (${u.username})`);
    refresh();
  };

  const handleDelete = (u: User) => {
    if (!confirm(`حذف المستخدم "${u.fullName}" نهائياً؟`)) return;
    const r = deleteUser(u.id);
    if (!r.ok) { alert(r.error); return; }
    addLog(session, "delete_user", `حذف: ${u.fullName} (${u.username})`);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-base font-bold text-slate-800">إدارة المستخدمين</h2><p className="text-xs text-slate-500">أضف موظفين بصلاحيات مخصصة لكل واحد</p></div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-md shadow-indigo-200 flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          إضافة مستخدم جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-right font-semibold text-slate-600">اسم المستخدم</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">الاسم الكامل</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">الصلاحية</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">الصلاحيات</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">النشاط</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">الإجراءات</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const stats = getUserStats(u.id);
                const activePermsCount = Object.values(u.permissions || {}).filter(Boolean).length;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-indigo-700" dir="ltr">{u.username}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{u.fullName}</td>
                    <td className="px-4 py-3">{u.role === "admin" ? <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-violet-200">👑 مدير</span> : <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-200">👤 موظف</span>}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPermsUser(u)} className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">
                        {activePermsCount} / 7 صلاحيات
                      </button>
                    </td>
                    <td className="px-4 py-3">{u.isActive ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">نشط</span> : <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-bold">معطل</span>}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{stats.totalLogins} دخول<br />{stats.totalOperations} عملية</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setEditingUser(u)} className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">تعديل</button>
                        <button onClick={() => handleToggle(u)} className="text-amber-700 hover:text-white hover:bg-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-medium transition">{u.isActive ? "تعطيل" : "تفعيل"}</button>
                        {u.id !== session.userId && <button onClick={() => handleDelete(u)} className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">حذف</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <UserFormModal mode="create" onClose={() => setShowCreate(false)} onSave={refresh} session={session} />}
      {editingUser && <UserFormModal mode="edit" user={editingUser} onClose={() => setEditingUser(null)} onSave={refresh} session={session} />}
      {permsUser && <PermissionsModal user={permsUser} onClose={() => setPermsUser(null)} onSave={refresh} session={session} />}
    </div>
  );
}

function UserFormModal({ mode, user, onClose, onSave, session }: { mode: "create" | "edit"; user?: User; onClose: () => void; onSave: () => void; session: Session }) {
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [role, setRole] = useState<"admin" | "employee">(user?.role || "employee");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (mode === "create") {
      const perms = role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
      const r = createUser({ username: username.trim(), password, fullName: fullName.trim(), role, isActive, permissions: perms, createdBy: session.userId }, session.userId);
      if (!r.ok) { setError(r.error || ""); return; }
      addLog(session, "create_user", `إنشاء: ${fullName} (${username}) - ${role === "admin" ? "مدير" : "موظف"}`);
      onSave(); onClose();
    } else if (user) {
      const updates: Partial<User> = { username: username.trim(), fullName: fullName.trim(), role, isActive };
      if (password) updates.password = password;
      const r = updateUser(user.id, updates);
      if (!r.ok) { setError(r.error || ""); return; }
      addLog(session, "update_user", `تعديل: ${fullName} (${username})`);
      onSave(); onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{mode === "create" ? "إضافة مستخدم جديد" : "تعديل المستخدم"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">✕</button>
        </div>
        <div className="p-6 space-y-3">
          <div><label className="text-xs text-slate-500">الاسم الكامل</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" placeholder="مثال: أحمد محمد" /></div>
          <div><label className="text-xs text-slate-500">اسم المستخدم</label><input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" dir="ltr" placeholder="ahmad" /></div>
          <div><label className="text-xs text-slate-500">كلمة المرور {mode === "edit" && <span className="text-slate-400">(فارغة لعدم التغيير)</span>}</label><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" dir="ltr" /></div>
          <div><label className="text-xs text-slate-500">الصلاحية</label><select value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1 bg-white"><option value="employee">👤 موظف (صلاحيات قابلة للتخصيص)</option><option value="admin">👑 مدير (كل الصلاحيات)</option></select></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" /><span className="text-sm">الحساب نشط</span></label>
          {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        </div>
        <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">{mode === "create" ? "إنشاء" : "حفظ"}</button>
        </div>
      </div>
    </div>
  );
}

function PermissionsModal({ user, onClose, onSave, session }: { user: User; onClose: () => void; onSave: () => void; session: Session }) {
  const [perms, setPerms] = useState<Permissions>(user.permissions || (user.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS));

  const save = () => {
    updateUser(user.id, { permissions: perms });
    addLog(session, "update_permissions", `تعديل صلاحيات: ${user.fullName} (${user.username})`);
    onSave(); onClose();
  };

  const toggle = (k: keyof Permissions) => setPerms({ ...perms, [k]: !perms[k] });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-indigo-50">
          <div><h3 className="font-bold text-slate-800">صلاحيات المستخدم</h3><p className="text-xs text-slate-500">{user.fullName} • @{user.username}</p></div>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded">✕</button>
        </div>
        <div className="p-6 space-y-2">
          {user.role === "admin" && <p className="text-xs bg-violet-50 border border-violet-200 text-violet-800 rounded-lg p-2 mb-2">👑 المدير له صلاحيات كاملة افتراضياً</p>}
          {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((k) => (
            <label key={k} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${perms[k] ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"}`}>
              <input type="checkbox" checked={perms[k]} onChange={() => toggle(k)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-sm font-medium text-slate-700 flex-1">{PERMISSION_LABELS[k]}</span>
              {perms[k] ? <span className="text-xs text-emerald-600 font-bold">✓ مفعّل</span> : <span className="text-xs text-slate-400">معطّل</span>}
            </label>
          ))}
        </div>
        <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={save} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">💾 حفظ الصلاحيات</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FIELDS TAB
   ============================================================ */
function FieldsTab({ session }: { session: Session }) {
  const [fields, setFields] = useState<CustomField[]>(getCustomFields());
  const [newLabel, setNewLabel] = useState("");
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [error, setError] = useState("");
  const [reqConfig, setReqConfig] = useState<Record<string, boolean>>(getRequiredFieldsConfig());

  const refresh = () => setFields(getCustomFields());

  const add = async () => {
    setError("");
    const labelTrimmed = newLabel.trim();
    const r = addCustomField(labelTrimmed, session.userId, newIsRequired);
    if (!r.ok) { setError(r.error || ""); return; }
    await addColumnToSheet(labelTrimmed);
    addLog(session, "add_field", `إضافة حقل للإكسل: ${labelTrimmed} (${newIsRequired ? "مهم" : "غير مهم"})`);
    setNewLabel(""); setNewIsRequired(false); refresh();
  };

  const remove = async (f: CustomField) => {
    if (!confirm(`حذف الحقل "${f.label}"؟ سيتم حذف العمود من ملف الإكسل أيضاً.`)) return;
    deleteCustomField(f.id);
    await deleteColumnFromSheet(f.label);
    addLog(session, "delete_field", `حذف حقل من الإكسل: ${f.label}`);
    refresh();
  };

  const handleToggleCustomRequired = (f: CustomField) => {
    toggleFieldRequired(f.id);
    refresh();
  };

  const handleToggleStdRequired = (key: string) => {
    const updated = { ...reqConfig, [key]: !reqConfig[key] };
    setReqConfig(updated);
    saveRequiredFieldsConfig(updated);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-base font-bold text-slate-800">إعدادات الحقول والنواقص</h2>
        <p className="text-xs text-slate-500">تحكم في الحقول المخصصة وحدد أي الحقول تُحسب من النواقص</p>
      </div>

      {/* Standard fields required config */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
          <h3 className="font-bold text-amber-800 text-sm">⚙️ إعدادات النواقص - الحقول الأصلية</h3>
          <p className="text-[10px] text-amber-600 mt-1">فعّل الحقول التي تريد حسابها من النواقص (الحقول المعطلة لن تظهر كنقص)</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(ALL_FIELD_LABELS).map(([key, label]) => (
            <label key={key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition text-sm ${reqConfig[key] ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
              <input type="checkbox" checked={!!reqConfig[key]} onChange={() => handleToggleStdRequired(key)} className="w-3.5 h-3.5 accent-red-600" />
              <span className="text-xs">{label}</span>
              {reqConfig[key] ? <span className="text-[9px] text-red-600 mr-auto">مهم</span> : <span className="text-[9px] text-slate-400 mr-auto">غير مهم</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Add custom field */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-3">➕ إضافة حقل مخصص جديد</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="مثال: الشهادات الإضافية" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={newIsRequired} onChange={(e) => setNewIsRequired(e.target.checked)} className="w-4 h-4 accent-red-600" />
            <span className="text-xs">مهم (يُحسب من النواقص)</span>
          </label>
          <button onClick={add} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">إضافة</button>
        </div>
        {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2 mt-2">{error}</p>}
      </div>

      {/* Custom fields list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-700 text-sm">📝 الحقول المخصصة ({fields.length})</h3>
        </div>
        {fields.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">لا توجد حقول مخصصة.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {fields.map((f) => (
              <div key={f.id} className="p-4 flex items-center justify-between hover:bg-slate-50 gap-2">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{f.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">أُضيف في: {new Date(f.createdAt).toLocaleString("ar-LY")}</p>
                </div>
                <button onClick={() => handleToggleCustomRequired(f)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${f.isRequired ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                  {f.isRequired ? "⚠️ مهم" : "— غير مهم"}
                </button>
                <button onClick={() => remove(f)} className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-3 py-1 rounded text-xs font-medium transition">🗑️ حذف</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LOGS TAB
   ============================================================ */
function LogsTab() {
  const [logs, setLogs] = useState<ActivityLog[]>(getLogs());
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;
  const users = getUsers();

  const refresh = () => setLogs(getLogs());

  const filtered = useMemo(() => {
    let r = logs;
    if (userFilter) r = r.filter((l) => l.userId === userFilter);
    if (actionFilter) r = r.filter((l) => l.action === actionFilter);
    return r;
  }, [logs, userFilter, actionFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-base font-bold text-slate-800">سجل النشاطات</h2><p className="text-xs text-slate-500">تتبع كل عملية يقوم بها كل مستخدم</p></div>
        <button onClick={() => { if (confirm("مسح كل السجلات؟")) { clearLogs(); refresh(); } }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium">🗑️ مسح السجلات</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">📊 ملخص نشاط كل مستخدم</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((u) => {
            const stats = getUserStats(u.id);
            return (
              <div key={u.id} className="border border-slate-200 rounded-xl p-3 bg-gradient-to-br from-slate-50 to-white">
                <div className="flex items-center justify-between mb-2">
                  <div><p className="text-sm font-bold text-slate-800">{u.fullName}</p><p className="text-[10px] text-slate-500 font-mono" dir="ltr">@{u.username}</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${u.role === "admin" ? "bg-violet-100 text-violet-800" : "bg-blue-100 text-blue-800"}`}>{u.role === "admin" ? "👑" : "👤"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2"><p className="text-[9px] text-indigo-600">الدخول</p><p className="text-lg font-bold text-indigo-700">{stats.totalLogins}</p></div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2"><p className="text-[9px] text-emerald-600">العمليات</p><p className="text-lg font-bold text-emerald-700">{stats.totalOperations}</p></div>
                </div>
                <div className="mt-2 space-y-1 text-[10px] text-slate-600">
                  <div className="flex justify-between"><span>آخر دخول:</span><span className="font-medium">{stats.lastLogin ? new Date(stats.lastLogin).toLocaleString("ar-LY") : "—"}</span></div>
                  <div className="flex justify-between"><span>آخر خروج:</span><span className="font-medium">{stats.lastLogout ? new Date(stats.lastLogout).toLocaleString("ar-LY") : "—"}</span></div>
                </div>
                {Object.keys(stats.operationsCount).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-indigo-600 cursor-pointer">تفاصيل العمليات ▼</summary>
                    <div className="mt-1 space-y-0.5 text-[10px]">
                      {Object.entries(stats.operationsCount).sort(([, a], [, b]) => b - a).map(([action, count]) => (
                        <div key={action} className="flex justify-between bg-slate-50 px-2 py-0.5 rounded"><span>{ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}</span><span className="font-bold text-slate-700">{count}</span></div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <select value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="">كل المستخدمين</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          <option value="public">بحث عام (موظفين)</option>
        </select>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="">كل العمليات</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-xs text-slate-500 mr-auto">{paginated.length} / {filtered.length}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 border-b border-slate-200"><th className="px-3 py-2 text-right">الوقت</th><th className="px-3 py-2 text-right">المستخدم</th><th className="px-3 py-2 text-right">الصلاحية</th><th className="px-3 py-2 text-right">العملية</th><th className="px-3 py-2 text-right">التفاصيل</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-[10px]">{new Date(l.timestamp).toLocaleString("ar-LY")}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{l.fullName}<br /><span className="text-[10px] text-slate-400 font-mono" dir="ltr">@{l.username}</span></td>
                  <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${l.role === "admin" ? "bg-violet-100 text-violet-800" : l.role === "public" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{l.role === "admin" ? "مدير" : l.role === "public" ? "عام" : "موظف"}</span></td>
                  <td className="px-3 py-2"><span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium ${getActionBadge(l.action)}`}>{ACTION_LABELS[l.action] || l.action}</span></td>
                  <td className="px-3 py-2 text-slate-600 max-w-md">{l.details}</td>
                </tr>
              ))}
              {paginated.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">لا توجد سجلات</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />}
      </div>
    </div>
  );
}

function getActionBadge(action: string): string {
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

/* ============================================================
   SETTINGS TAB
   ============================================================ */
function SettingsTab({ session }: { session: Session }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setMsg(""); setErr("");
    if (newPwd !== confirmPwd) { setErr("كلمتا المرور غير متطابقتين"); return; }
    const r = changePassword(session.userId, oldPwd, newPwd);
    if (!r.ok) { setErr(r.error || ""); return; }
    addLog(session, "change_password", "تغيير كلمة المرور");
    setMsg("✅ تم تغيير كلمة المرور بنجاح");
    setOldPwd(""); setNewPwd(""); setConfirmPwd("");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div><h2 className="text-base font-bold text-slate-800">الإعدادات الشخصية</h2><p className="text-xs text-slate-500">تغيير كلمة المرور الخاصة بك</p></div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">الحساب الحالي</p><p className="font-bold text-slate-800">{session.fullName}</p><p className="text-[10px] text-slate-500 font-mono" dir="ltr">@{session.username} • {session.role === "admin" ? "👑 مدير" : "👤 موظف"}</p></div>
        <div><label className="text-xs text-slate-500">كلمة المرور الحالية</label><input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1" dir="ltr" /></div>
        <div><label className="text-xs text-slate-500">كلمة المرور الجديدة</label><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1" dir="ltr" /></div>
        <div><label className="text-xs text-slate-500">تأكيد كلمة المرور الجديدة</label><input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1" dir="ltr" /></div>
        {err && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}
        {msg && <p className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">{msg}</p>}
        <button onClick={submit} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">تغيير كلمة المرور</button>
      </div>
    </div>
  );
}

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const colors: Record<string, string> = { slate: "from-slate-50 to-slate-100 border-slate-200 text-slate-800", emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800", red: "from-red-50 to-red-100 border-red-200 text-red-800", blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-800", indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-800", pink: "from-pink-50 to-pink-100 border-pink-200 text-pink-800", amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-800", cyan: "from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-800", orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-800" };
  return (<div className={`bg-gradient-to-br ${colors[color] || colors.slate} border rounded-xl p-2`}><div className="flex items-center gap-1.5"><span className="text-base">{icon}</span><div><p className="text-sm font-bold">{value}</p><p className="text-[9px] opacity-70 whitespace-nowrap">{label}</p></div></div></div>);
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (<th onClick={onClick} className={`px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 whitespace-nowrap ${onClick ? "cursor-pointer hover:bg-slate-100 select-none" : ""}`}>{children}</th>);
}

function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey: string; sortDir: string }) {
  if (sortKey !== column) return <span className="text-slate-300 mr-1">⇅</span>;
  return <span className="text-indigo-600 mr-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function PageBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (<button onClick={onClick} disabled={disabled} className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-medium transition ${active ? "bg-indigo-600 text-white shadow-sm" : disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 bg-slate-100"}`}>{children}</button>);
}

function Pagination({ currentPage, totalPages, onChange }: { currentPage: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between bg-slate-50/50">
      <p className="text-[11px] text-slate-500">صفحة {currentPage} من {totalPages}</p>
      <div className="flex items-center gap-0.5">
        <PageBtn onClick={() => onChange(1)} disabled={currentPage === 1}>⟪</PageBtn>
        <PageBtn onClick={() => onChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>⟨</PageBtn>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { let page: number; if (totalPages <= 5) page = i + 1; else if (currentPage <= 3) page = i + 1; else if (currentPage >= totalPages - 2) page = totalPages - 4 + i; else page = currentPage - 2 + i; return <PageBtn key={page} onClick={() => onChange(page)} active={page === currentPage}>{page}</PageBtn>; })}
        <PageBtn onClick={() => onChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>⟩</PageBtn>
        <PageBtn onClick={() => onChange(totalPages)} disabled={currentPage === totalPages}>⟫</PageBtn>
      </div>
    </div>
  );
}

function getStatusBadge(s: string): string {
  switch (s) {
    case "مستوفي": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ناقص": return "bg-amber-100 text-amber-800 border-amber-200";
    case "تحت الاجراء": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function getDataCompleteBadge(v: string): string {
  if (v === "نعم مكتملة") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "غير مكتملة") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

/* ============================================================
   PRINT TEMPLATES
   ============================================================ */
function getHeaderHTML(): string {
  return `
  <div style="display:flex;align-items:center;gap:14px;padding:8px 0 14px;border-bottom:3px double #b8860b;margin-bottom:14px;">
    <div style="flex:0 0 80px;text-align:center;"><img src="${NACC_LOGO}" width="80" height="80" alt="شعار" style="display:block;margin:0 auto;object-fit:contain;"/></div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:8px;color:#64748b;letter-spacing:1px;margin-bottom:2px;">NATIONAL ANTI-CORRUPTION COMMISSION</div>
      <div style="font-size:11px;font-weight:bold;color:#1e3a8a;margin:1px 0;">WESTERN REGION OFFICE</div>
      <div style="font-size:16px;font-weight:bold;color:#1e3a8a;margin:4px 0;">الهيئة الوطنية لمكافحة الفساد</div>
      <div style="font-size:13px;font-weight:bold;color:#1e3a8a;">ديوان المنطقة الغربية</div>
    </div>
    <div style="flex:0 0 80px;text-align:center;"><img src="${LIBYA_FLAG}" width="80" height="50" alt="ليبيا" style="display:block;margin:0 auto;object-fit:contain;border:1px solid #ddd;border-radius:2px;"/></div>
  </div>`;
}

function getFooterHTML(): string {
  return `<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:8px;color:#94a3b8;">تصميم وتطوير المنظومة: <strong style="color:#b8860b;letter-spacing:1px;">${SYSTEM_NAME}</strong> &nbsp;|&nbsp; الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</div>`;
}

function buildFormHTML(emp: any, index?: number, total?: number): string {
  const missing = getMissingFields(emp);
  const customFields = getCustomFields();
  const idxLabel = index !== undefined && total !== undefined ? ` (${index + 1}/${total})` : "";
  const dt = new Date().toLocaleString("ar-LY");
  const customRows = customFields.length > 0 ? `<table><tr><td class="section-title" colspan="2">بيانات إضافية</td></tr>${customFields.map(cf => `<tr><td class="label">${cf.label}</td><td class="value">${emp[cf.key] || '-'}</td></tr>`).join('')}</table>` : '';

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
${missing.length > 0 ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:6px 10px;margin-top:4px;"><div style="color:#b91c1c;font-weight:bold;font-size:10px;margin-bottom:3px;">⚠️ النواقص (${missing.length} حقل):</div><ul style="margin:0;padding:0 16px;list-style:none;font-size:9px;column-count:2;">${missing.map(m => `<li style="color:#991b1b;padding:1px 0;">• ${m}</li>`).join('')}</ul></div>` : `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:5px 10px;"><div style="color:#166534;font-weight:bold;font-size:10px;">✅ جميع البيانات مكتملة</div></div>`}
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

export function printIndividualForm(emp: any) {
  const w = window.open("", "_blank", "width=900,height=750,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>نموذج - ${emp.fullName}</title>${PRINT_STYLES}</head><body>${buildFormHTML(emp)}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة</button></body></html>`);
  w.document.close();
}

function printAllForms(data: any[]) {
  const w = window.open("", "_blank", "width=900,height=750,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  const forms = data.map((emp, idx) => buildFormHTML(emp, idx, data.length)).join('');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير (${data.length})</title>${PRINT_STYLES}</head><body>${forms}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة (${data.length})</button></body></html>`);
  w.document.close();
}

function printSummaryTable(data: any[], alertEmps: any[]) {
  const w = window.open("", "_blank", "width=1100,height=800,scrollbars=yes");
  if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
  const dt = new Date().toLocaleString("ar-LY");
  const chunkSize = 25;
  const alertChunks: any[][] = [];
  for (let i = 0; i < alertEmps.length; i += chunkSize) alertChunks.push(alertEmps.slice(i, i + chunkSize));
  const alertHTML = alertEmps.length > 0 ? alertChunks.map((chunk, ci) => `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:10px;margin:12px 0;page-break-inside:avoid;page-break-before:${ci === 0 ? 'always' : 'auto'};"><h3 style="color:#92400e;font-size:12px;margin:0 0 6px;">⚠️ موظفون بحاجة لمراجعة الإدارة (${alertEmps.length}) - صفحة ${ci + 1}/${alertChunks.length}</h3><table style="font-size:9px;"><thead><tr><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">#</th><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">الرقم الوطني</th><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">الاسم</th><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">النواقص</th><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">الملاحظات</th><th style="background:#f59e0b;color:white;padding:4px 6px;border:1px solid #f59e0b;">الإجراء</th></tr></thead><tbody>${chunk.map((e, i) => `<tr><td style="padding:3px 6px;border:1px solid #fcd34d;text-align:center;">${ci * chunkSize + i + 1}</td><td style="padding:3px 6px;border:1px solid #fcd34d;font-family:monospace;direction:ltr;">${e.nationalNumber}</td><td style="padding:3px 6px;border:1px solid #fcd34d;font-weight:bold;">${e.fullName}</td><td style="padding:3px 6px;border:1px solid #fcd34d;text-align:center;color:#b91c1c;font-weight:bold;">${getMissingFields(e).length}</td><td style="padding:3px 6px;border:1px solid #fcd34d;">${e.notes || '-'}</td><td style="padding:3px 6px;border:1px solid #fcd34d;">${e.requiredAction || '-'}</td></tr>`).join('')}</tbody></table></div>`).join('') : '';
  const rows = data.map((e, i) => `<tr style="background:${i % 2 === 0 ? '#f8fafc' : 'white'};"><td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${i + 1}</td><td style="padding:3px 5px;text-align:center;font-family:monospace;direction:ltr;font-size:9px;border:1px solid #e2e8f0;">${e.nationalNumber}</td><td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.fullName}</td><td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.jobGrade || '-'}</td><td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.qualification || '-'}</td><td style="padding:3px 5px;font-size:9px;border:1px solid #e2e8f0;">${e.bankName || '-'}</td><td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${e.status || '-'}</td><td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;">${e.dataComplete || '-'}</td><td style="padding:3px 5px;text-align:center;font-size:9px;border:1px solid #e2e8f0;color:#b91c1c;font-weight:bold;">${getMissingFields(e).length}</td></tr>`).join('');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>ملخص</title><style>body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#222;margin:0;padding:15px 20px;font-size:10px;}table{width:100%;border-collapse:collapse;}thead th{background:#1e3a8a;color:white;padding:5px 4px;font-size:9px;border:1px solid #1e3a8a;}@media print{.no-print{display:none!important;}body{padding:8px 12px;}thead{display:table-header-group;}tr{page-break-inside:avoid;}}</style></head><body>${getHeaderHTML()}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><div><h2 style="margin:0;color:#1e3a8a;font-size:13px;">ملخص بيانات الموظفين</h2><p style="margin:2px 0 0;font-size:8px;color:#94a3b8;">تاريخ: ${dt}</p></div><div style="font-size:9px;color:#64748b;">العدد: <strong style="color:#1e3a8a;">${data.length}</strong></div></div><table><thead><tr><th>#</th><th>الرقم الوطني</th><th>الاسم</th><th>الدرجة</th><th>المؤهل</th><th>المصرف</th><th>الحالة</th><th>البيانات</th><th>النواقص</th></tr></thead><tbody>${rows}</tbody></table>${alertHTML}${getFooterHTML()}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-family:Tahoma;">🖨️ طباعة</button></body></html>`);
  w.document.close();
}

function exportCSV(data: any[], filename: string) {
  const customFields = getCustomFields();
  const headers = ["الرقم الوطني", "الاسم رباعي", "الرقم الوظيفي", "الدرجة الوظيفية", "المؤهل العلمي", "التخصص", "المصرف", "رقم الحساب (IBAN)", "رقم قرار التعيين", "تاريخ المباشرة", "رقم الهاتف", "الحالة", "اكتمال البيانات", "عدد النواقص", "الإدارة", "القسم", "الجنس", ...customFields.map((cf) => cf.label)];
  const rows = data.map((e) => [e.nationalNumber, e.fullName, e.jobNumber, e.jobGrade, e.qualification, e.specialization, e.bankName, e.iban, e.appointmentDecision, e.startDate, e.phone, e.status, e.dataComplete, String(getMissingFields(e).length), e.department, e.section, e.gender, ...customFields.map((cf) => e[cf.key] || "")]);
  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
