import { useState, useEffect } from "react";
import { type EmployeeLoginResult, API_URL, fetchEmployeesFromSheet, findEmployeeByNationalNumber } from "./data/employees";
import { type User, type Session, ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS, findUser, getSession, setSession, addLog, getCustomFields } from "./lib/storage";
import { generateRandomCode, isEmpty, getMissingFields } from "./utils/helpers";
import EmployeesTab from "./components/EmployeesTab";
import ReportsTab from "./components/ReportsTab";
import DeleteRequestsTab from "./components/DeleteRequestsTab";
import ArchiveTab from "./components/ArchiveTab";
import { CodesTab, UsersTab, FieldsTab, LogsTab, SettingsTab, AboutTab } from "./components/OtherTabs";
import { printIndividualForm } from "./components/PrintTemplates";

const NACC_LOGO = "/images/nacc-logo.png";
const LIBYA_FLAG = "/images/libya-flag.png";
const SYSTEM_NAME = "منظومة بيانات موظفي ديوان الغربية";

export default function App() {
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [publicEmployee, setPublicEmployee] = useState<any | null>(null);
  const [loginResult, setLoginResult] = useState<(EmployeeLoginResult & { employee?: any }) | null>(null);

  const handleLogin = (user: User) => {
    const s: Session = { userId: user.id, username: user.username, fullName: user.fullName, role: user.role, permissions: user.permissions || (user.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS), loginTime: new Date().toISOString() };
    setSession(s); setSessionState(s); addLog(s, "login", `تسجيل دخول - ${user.role === "admin" ? "حساب مدير" : "حساب موظف"}`);
  };
  const handleLogout = () => { if (session) addLog(session, "logout", "تسجيل خروج"); setSession(null); setSessionState(null); };
  const handleEmployeeLoginResult = (result: EmployeeLoginResult & { employee?: any }) => { setLoginResult(result); if (result.employee) setPublicEmployee(result.employee); };

  if (publicEmployee && loginResult) return <PublicEmployeeView employee={publicEmployee} loginResult={loginResult} onBack={() => { setPublicEmployee(null); setLoginResult(null); }} />;
  if (!session) return <AuthScreen onLogin={handleLogin} onPublicView={handleEmployeeLoginResult} />;
  return <Dashboard session={session} onLogout={handleLogout} />;
}

function AuthScreen({ onLogin, onPublicView }: { onLogin: (u: User) => void; onPublicView: (emp: any) => void }) {
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100 flex flex-col">
      <div className="bg-white border-b-2 border-amber-500 shadow-sm"><div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-4"><img src={NACC_LOGO} alt="NACC" className="h-16 w-16 object-contain" /><div className="text-center"><div className="text-[10px] text-slate-500 letter-spacing-1">NATIONAL ANTI-CORRUPTION COMMISSION - WESTERN REGION OFFICE</div><h1 className="text-xl font-bold text-slate-900 mt-1">الهيئة الوطنية لمكافحة الفساد</h1><p className="text-sm font-semibold text-amber-700 mt-0.5">ديوان المنطقة الغربية</p></div><img src={LIBYA_FLAG} alt="ليبيا" className="h-12 w-20 object-contain border border-slate-200" /></div></div>
      <div className="flex-1 flex items-center justify-center p-4"><div className="w-full max-w-5xl"><div className="text-center mb-6"><h2 className="text-2xl font-bold text-slate-800">منظومة بيانات موظفي ديوان الغربية</h2><p className="text-sm text-slate-600 mt-1">خاص بموظفي ديوان المنطقة الغربية - جبل نفوسة</p></div><div className="grid md:grid-cols-2 gap-5"><div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-100 overflow-hidden"><div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-white"><div className="flex items-center gap-2"><span className="text-xl">👤</span><div><h3 className="font-bold text-sm">الموظفين</h3><p className="text-[10px] opacity-90">عرض بياناتك الشخصية</p></div></div></div><div className="p-5"><label className="flex items-start gap-3 cursor-pointer mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition"><input type="checkbox" checked={isEmployeeMode} onChange={(e) => setIsEmployeeMode(e.target.checked)} className="w-5 h-5 mt-0.5 accent-emerald-600" /><div><p className="font-bold text-slate-800 text-sm">أنا موظف</p><p className="text-[11px] text-slate-600 mt-0.5">أريد عرض بياناتي الشخصية فقط</p></div></label>{isEmployeeMode ? (<EmployeeSearchForm onFound={onPublicView} />) : (<div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center"><div className="text-3xl mb-2">🔍</div><p className="text-xs text-slate-500">ضع علامة ✓ على "أنا موظف" أعلاه<br />ثم أدخل رقمك الوطني للبحث</p></div>)}</div></div><div className="bg-white rounded-2xl shadow-xl border-2 border-indigo-100 overflow-hidden"><div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-white"><div className="flex items-center gap-2"><span className="text-xl">🔐</span><div><h3 className="font-bold text-sm">الإدارة</h3><p className="text-[10px] opacity-90">دخول الإدارة والمصرحين</p></div></div></div><div className="p-5"><AdminLoginForm onLogin={onLogin} /></div></div></div></div></div>
      <footer className="bg-slate-900 text-white py-3"><div className="max-w-5xl mx-auto px-4 text-center"><p className="text-xs"><span className="opacity-70">تصميم وتطوير المنظومة:</span><span className="font-bold mr-2 text-amber-400 tracking-wider">{SYSTEM_NAME}</span></p><p className="text-[10px] opacity-60 mt-1">جميع الحقوق محفوظة © {new Date().getFullYear()} - الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p></div></footer>
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

  const goToCode = () => { const cleaned = nn.replace(/[^\d]/g, "").trim(); if (cleaned.length !== 12) { setError("الرقم الوطني يجب أن يكون 12 رقماً بالضبط"); return; } setError(""); setStep("code"); };
  const login = async () => {
    setError(""); setLoading(true);
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    const codeUp = code.trim().toUpperCase();
    const INIT_CODE = "NACC2026";
    if (!codeUp) { setError("أدخل الكود أولاً"); setLoading(false); return; }
    try {
      const employees = await fetchEmployeesFromSheet();
      const found = findEmployeeByNationalNumber(employees, cleaned);
      if (!found) { setError("❌ الرقم الوطني غير موجود في المنظومة. راجع إدارة المنظومة."); setLoading(false); return; }
      const codeKey = `emp_code_${cleaned}`;
      const stored = JSON.parse(localStorage.getItem(codeKey) || "{}");
      if (stored.blocked === true) { setIsBlocked(true); setError("🚫 الحساب محجوب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة."); setLoading(false); return; }
      const expectedCode = stored.code || INIT_CODE;
      const currentAttempts = stored.attempts || 0;
      if (codeUp !== expectedCode) {
        const newAttempts = currentAttempts + 1; setAttempts(newAttempts);
        if (newAttempts >= 3) { localStorage.setItem(codeKey, JSON.stringify({ ...stored, attempts: 3, blocked: true, blockDate: new Date().toISOString(), blockReason: "3 محاولات خاطئة" })); fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "block_account", nationalNumber: cleaned, reason: "3 محاولات خاطئة" }) }).catch(() => {}); setIsBlocked(true); setError("🚫 تم حجب الحساب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة."); setLoading(false); return; }
        localStorage.setItem(codeKey, JSON.stringify({ ...stored, attempts: newAttempts })); setError(`❌ الكود غير صحيح. تبقى ${3 - newAttempts} محاولة/محاولات فقط.`); setLoading(false); return;
      }
      if (stored.lastLogin && stored.code && stored.code !== INIT_CODE) { const lastLogin = new Date(stored.lastLogin); const diffDays = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24); if (diffDays > 90) { setError("⏰ انتهت صلاحية الكود (مضت 3 أشهر). يرجى مراجعة الإدارة لتجديده."); setLoading(false); return; } }
      const isFirstLogin = codeUp === INIT_CODE && (!stored.code || stored.code === INIT_CODE);
      const newPersonalCode = isFirstLogin ? generateRandomCode() : stored.code;
      const expiry = new Date(); expiry.setDate(expiry.getDate() + 90);
      localStorage.setItem(codeKey, JSON.stringify({ code: newPersonalCode, type: "شخصي", firstLogin: stored.firstLogin || new Date().toISOString(), lastLogin: new Date().toISOString(), expiry: expiry.toISOString(), blocked: false, attempts: 0 }));
      fetch(API_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "save_login_data", nationalNumber: cleaned, code: newPersonalCode, type: "شخصي", lastLogin: new Date().toISOString(), expiry: expiry.toISOString(), status: "نشط" }) }).catch(() => {});
      addLog({ userId: "public", username: "public", fullName: found.fullName, role: "public" }, "public_search", `دخول موظف: ...${cleaned.slice(-4)}${isFirstLogin ? " (أول مرة)" : ""}`);
      const missing = getMissingFields(found);
      onFound({ status: "success", fullName: found.fullName, isComplete: missing.length === 0, missing, personalCode: isFirstLogin ? newPersonalCode : undefined, codeType: isFirstLogin ? "تم إنشاء كودك الشخصي لأول مرة" : undefined, expiry: expiry.toLocaleDateString("ar-LY"), employee: found });
    } catch (e) { console.error(e); setError("❌ فشل الاتصال. تأكد من الإنترنت وحاول مرة أخرى."); } finally { setLoading(false); }
  };

  if (isBlocked) return (<div className="space-y-3 text-center"><div className="text-5xl">🚫</div><div className="bg-red-50 border border-red-200 rounded-xl p-4"><h3 className="font-bold text-red-800 text-sm">الحساب محجوب</h3><p className="text-xs text-red-600 mt-1">تم حجب حسابك بسبب 3 محاولات دخول خاطئة.</p><p className="text-xs text-red-600 mt-1 font-medium">يرجى مراجعة إدارة المنظومة لإعادة التفعيل.</p></div><button onClick={() => { setIsBlocked(false); setStep("national"); setNn(""); setCode(""); setAttempts(0); setError(""); }} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm transition">رجوع</button></div>);

  return (
    <div className="space-y-3">
      {step === "national" ? (<><div><label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني</label><input type="text" value={nn} onChange={(e) => { setNn(e.target.value.replace(/[^\d]/g, "").slice(0, 12)); setError(""); }} onKeyDown={(e) => e.key === "Enter" && goToCode()} placeholder="أدخل رقمك الوطني" inputMode="numeric" maxLength={12} className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none tracking-widest" dir="ltr" autoFocus /><div className="mt-1 flex items-center justify-between text-[10px]"><span className="text-slate-400">يتكون من 12 رقماً بالضبط</span><span dir="ltr" className={`font-bold ${nn.length === 12 ? "text-emerald-600" : "text-slate-400"}`}>{nn.length}/12</span></div></div>{error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}<button onClick={goToCode} disabled={nn.length !== 12} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed">التالي →</button></>) : (<><div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between"><div><p className="text-[10px] text-emerald-600">الرقم الوطني المدخل</p><p className="font-mono font-bold text-emerald-800" dir="ltr">{nn}</p></div><button onClick={() => { setStep("national"); setCode(""); setError(""); setAttempts(0); }} className="text-[10px] text-emerald-600 hover:text-emerald-800 underline">تغيير</button></div><div><label className="text-xs text-slate-600 mb-1 block font-medium">كود الدخول</label><input type="text" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 10)); setError(""); }} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="NACC2026" className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center tracking-widest focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase" dir="ltr" autoFocus /><p className="text-[10px] text-slate-400 mt-1 text-center">أول مرة؟ استخدم الكود المبدئي: <span className="font-bold text-emerald-700 tracking-wider">NACC2026</span></p></div>{attempts > 0 && (<div className="space-y-1"><p className="text-[10px] text-center text-red-600 font-medium">المحاولات المتبقية: {Math.max(0, 3 - attempts)}/3</p><div className="flex gap-1.5 justify-center">{Array.from({ length: 3 }).map((_, i) => (<div key={i} className={`h-2.5 w-10 rounded-full transition-all ${i < attempts ? "bg-red-500" : "bg-slate-200"}`} />))}</div></div>)}{error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">{error}</div>}<div className="flex gap-2"><button onClick={() => { setStep("national"); setCode(""); setError(""); }} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition">← رجوع</button><button onClick={login} disabled={loading || !code.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50">{loading ? (<span className="flex items-center justify-center gap-2"><span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري التحقق...</span>) : "🔐 دخول"}</button></div></>)}
    </div>
  );
}

function AdminLoginForm({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const tryLogin = () => { const user = findUser(username, password); if (!user) { setError("اسم المستخدم أو كلمة المرور غير صحيحة"); setPassword(""); return; } onLogin(user); };
  return (
    <div className="space-y-3"><div><label className="text-xs text-slate-500 mb-1 block">اسم المستخدم</label><input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="username" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" /></div><div><label className="text-xs text-slate-500 mb-1 block">كلمة المرور</label><input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="••••••" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" /></div>{error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-center">{error}</p>}<button onClick={tryLogin} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-medium text-sm transition shadow-md">🔓 دخول</button></div>
  );
}

function PublicEmployeeView({ employee, loginResult, onBack }: { employee: any; loginResult: EmployeeLoginResult & { employee?: any }; onBack: () => void }) {
  const customFields = getCustomFields();
  const missing = loginResult.missing || getMissingFields(employee);
  const isComplete = loginResult.isComplete ?? missing.length === 0;
  const share = async () => { const text = `بياناتي - ديوان المنطقة الغربية\n\nالاسم: ${employee.fullName}\nالرقم الوطني: ${employee.nationalNumber}\nالدرجة: ${employee.jobGrade || "-"}\nالإدارة: ${employee.department || "-"}\nالهاتف: ${employee.phone || "-"}\nالحالة: ${employee.status || "-"}`; addLog({ userId: "public", username: "public", fullName: employee.fullName, role: "public" }, "share_employee", `مشاركة بيانات: ${employee.nationalNumber}`); if (navigator.share) { try { await navigator.share({ title: "بياناتي", text }); } catch {} } else { try { await navigator.clipboard.writeText(text); alert("✅ تم نسخ البيانات إلى الحافظة"); } catch { alert("لا يمكن النسخ، استخدم زر الطباعة"); } } };
  const print = () => { printIndividualForm(employee, missing, customFields); addLog({ userId: "public", username: "public", fullName: employee.fullName, role: "public" }, "print_employee", `طباعة بياناتي: ${employee.nationalNumber}`); };
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100"><header className="bg-white border-b-2 border-emerald-500 shadow-sm"><div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><img src={NACC_LOGO} alt="NACC" className="h-10 w-10 object-contain" /><div><h1 className="text-sm font-bold text-slate-900">بياناتي الشخصية</h1><p className="text-[10px] text-slate-500">ديوان المنطقة الغربية - جبل نفوسة</p></div></div><button onClick={onBack} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>رجوع</button></div></header><main className="max-w-4xl mx-auto p-4 space-y-4"><div className={`rounded-2xl p-5 text-white shadow-lg ${isComplete ? "bg-gradient-to-l from-emerald-500 to-teal-600" : "bg-gradient-to-l from-amber-500 to-orange-600"}`}><div className="flex items-center justify-between"><div><p className="text-xs opacity-90">مرحباً</p><h2 className="text-xl font-bold mt-1">{employee.fullName}</h2><p className="text-xs mt-2 font-mono opacity-90" dir="ltr">الرقم الوطني: {employee.nationalNumber}</p></div><div className="text-4xl">{isComplete ? "✅" : "⚠️"}</div></div><div className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-bold ${isComplete ? "bg-white/20" : "bg-white/20"}`}>{isComplete ? "بياناتك مكتملة - يمكنك طباعة نموذجك" : `بياناتك تحتوي على ${missing.length} نقص - يرجى مراجعة الإدارة`}</div></div>{loginResult.codeType && (<div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4"><div className="flex items-center gap-2 mb-3"><span className="text-2xl">🔐</span><div><h3 className="font-bold text-indigo-800 text-sm">{loginResult.codeType}</h3><p className="text-[11px] text-indigo-600">احتفظ بهذا الكود في مكان آمن</p></div></div><div className="bg-white border-2 border-indigo-400 rounded-xl p-4 text-center"><p className="text-[10px] text-slate-500 mb-1">كودك الشخصي الجديد</p><p className="text-3xl font-mono font-bold text-indigo-700 tracking-widest">{loginResult.personalCode}</p>{loginResult.expiry && <p className="text-[10px] text-slate-400 mt-1">صالح حتى: {loginResult.expiry}</p>}</div><p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 text-center">⚠️ ستحتاج هذا الكود في كل مرة تدخل فيها. لا تشاركه مع أحد.</p></div>)}{isComplete ? (<div className="flex gap-2"><button onClick={print} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>طباعة نموذجي</button><button onClick={share} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>مشاركة</button></div>) : (<div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center"><div className="text-4xl mb-2">🏢</div><h3 className="font-bold text-amber-800">يرجى مراجعة الإدارة</h3><p className="text-xs text-amber-700 mt-1">لاستكمال بياناتك الناقصة وتفعيل صلاحية الطباعة</p></div>)}{missing.length > 0 && (<div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4"><h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2"><span>⚠️</span> تنبيه: بياناتك بحاجة لتحديث</h3><p className="text-xs text-amber-700 mb-2">يرجى مراجعة الإدارة لاستكمال البيانات التالية:</p><div className="flex flex-wrap gap-1.5">{missing.map((m, i) => (<span key={i} className="bg-white text-amber-800 px-2 py-1 rounded-lg text-[10px] font-medium border border-amber-300">{m}</span>))}</div></div>)}<div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"><DataSection title="البيانات الأساسية" color="indigo" rows={[["الاسم رباعي", employee.fullName], ["الرقم الوطني", employee.nationalNumber, true], ["الرقم الوظيفي", employee.jobNumber, true], ["الجنس", employee.gender], ["الحالة الوظيفية", employee.jobStatus], ["نوع التوظيف", employee.employmentType]]} /><DataSection title="البيانات الأكاديمية والوظيفية" color="emerald" rows={[["الدرجة الوظيفية", employee.jobGrade], ["المؤهل العلمي", employee.qualification], ["التخصص", employee.specialization], ["التقدير", employee.grade], ["أصل المؤهل / مكان الحصول", employee.qualificationOrigin]]} /><DataSection title="البيانات المالية" color="amber" rows={[["المصرف", employee.bankName], ["رقم الحساب (IBAN)", employee.iban, true], ["يتقاضى معاش", employee.receivesPension]]} /><DataSection title="البيانات الإدارية" color="violet" rows={[["رقم قرار التعيين", employee.appointmentDecision, true], ["تاريخ المباشرة", employee.startDate], ["آخر ترقية", employee.promotionDate], ["الإدارة", employee.department], ["القسم", employee.section], ["رقم الهاتف", employee.phone, true]]} />{customFields.length > 0 && (<DataSection title="بيانات إضافية" color="cyan" rows={customFields.map((cf) => [cf.label, employee[cf.label] || employee[cf.key] || ""])} />)}</div></main><footer className="bg-slate-900 text-white py-3 mt-6"><div className="max-w-4xl mx-auto px-4 text-center"><p className="text-xs"><span className="opacity-70">تصميم وتطوير المنظومة:</span><span className="font-bold mr-2 text-amber-400 tracking-wider">{SYSTEM_NAME}</span></p></div></footer></div>
  );
}

function DataSection({ title, color, rows }: { title: string; color: string; rows: (string | boolean | undefined)[][] }) {
  const colors: Record<string, string> = { indigo: "bg-indigo-600", emerald: "bg-emerald-600", amber: "bg-amber-600", violet: "bg-violet-600", cyan: "bg-cyan-600" };
  return (<div><div className={`${colors[color]} text-white px-3 py-1.5 rounded-t-lg text-xs font-bold`}>{title}</div><div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">{rows.map((row, i) => { const label = row[0] as string; const value = row[1] as string; const mono = row[2] as boolean; const empty = isEmpty(value); return (<div key={i} className={`grid grid-cols-3 gap-2 px-3 py-2 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"} border-b border-slate-100 last:border-b-0`}><span className="text-xs text-slate-500">{label}</span><span className={`col-span-2 text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`} dir={mono && !empty ? "ltr" : undefined}>{empty ? "— لم يتم تسجيله —" : value}</span></div>); })}</div></div>);
}

type TabName = "employees" | "reports" | "codes" | "delete_requests" | "archive" | "users" | "logs" | "fields" | "settings" | "about";

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
        {tab === "about" && <AboutTab />}
      </main>
      <footer className="border-t border-slate-200 bg-slate-900 text-white mt-6 py-3"><div className="max-w-7xl mx-auto px-4 text-center space-y-1"><p className="text-xs"><span className="opacity-70">منظومة بيانات موظفي ديوان الغربية</span><span className="mx-2 opacity-50">|</span><span className="opacity-70">تصميم وتطوير:</span><span className="font-bold mr-1 text-amber-400 tracking-wider">S-BUTTO</span></p><p className="text-[10px] opacity-50">© {new Date().getFullYear()} الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p></div></footer>
    </div>
  );
}

function DashboardHeader({ session, onLogout, tab, setTab }: { session: Session; onLogout: () => void; tab: TabName; setTab: (t: TabName) => void }) {
  const perms = session.permissions;
  const [pendingDeletes, setPendingDeletes] = useState(0);
  useEffect(() => { if (!perms.canApproveDelete) return; let mounted = true; const loadPending = async () => { const { getDeleteRequests } = await import("./data/employees"); const requests = await getDeleteRequests(); if (mounted) setPendingDeletes(requests.filter((r: any) => r.status === "قيد المراجعة").length); }; loadPending(); const timer = window.setInterval(loadPending, 15000); window.addEventListener("delete-requests-changed", loadPending); return () => { mounted = false; window.clearInterval(timer); window.removeEventListener("delete-requests-changed", loadPending); }; }, [perms.canApproveDelete]);
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={NACC_LOGO} alt="NACC" className="h-12 w-12 object-contain" />
            <div><h1 className="text-base font-bold text-slate-900">{session.role === "admin" ? "لوحة تحكم المدير" : "منظومة بيانات موظفي ديوان الغربية"}</h1><p className="text-[11px] text-slate-500">ديوان المنطقة الغربية - جبل نفوسة</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-left ml-2 hidden sm:block"><p className="text-xs font-bold text-slate-700">{session.fullName}</p><p className="text-[10px] text-slate-400">{session.role === "admin" ? "👑 مدير" : "👤 موظف"} • @{session.username}</p></div>
            <button onClick={onLogout} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>خروج
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
          <TabBtn active={tab === "about"} onClick={() => setTab("about")} icon="ℹ️">حول النظام</TabBtn>
        </div>
      </div>
    </header>
  );
}

function TabBtn({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon: string }) {
  return (<button onClick={onClick} className={`px-4 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}><span>{icon}</span><span>{children}</span></button>);
}
