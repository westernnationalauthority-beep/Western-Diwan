// ============================================================
// AuthScreen.tsx - شاشة تسجيل الدخول
// ============================================================

import { useState } from "react";
import { type User, findUser, addLog } from "../lib/storage";
import { type EmployeeLoginResult, fetchEmployeesFromSheet } from "../data/employees";
import { findEmployeeByNationalNumber } from "../lib/storage";

import { NACC_LOGO, LIBYA_FLAG, SYSTEM_NAME, INIT_CODE, MAX_LOGIN_ATTEMPTS } from "../constants";
import { type Employee } from "../data/employees";

// ──────────────────────────────────────────────
// AuthScreen الرئيسية
// ──────────────────────────────────────────────
export function AuthScreen({
  onLogin,
  onPublicView,
}: {
  onLogin: (u: User) => void;
  onPublicView: (result: EmployeeLoginResult & { employee?: Employee }) => void;
}) {
  const [isEmployeeMode, setIsEmployeeMode] = useState(false);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-amber-500 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-center gap-4">
          <img src={NACC_LOGO} alt="NACC" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <div className="text-[10px] text-slate-500 tracking-wide">
              NATIONAL ANTI-CORRUPTION COMMISSION - WESTERN REGION OFFICE
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">الهيئة الوطنية لمكافحة الفساد</h1>
            <p className="text-sm font-semibold text-amber-700 mt-0.5">ديوان المنطقة الغربية</p>
          </div>
          <img src={LIBYA_FLAG} alt="ليبيا" className="h-12 w-20 object-contain border border-slate-200" />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">نظام إدارة بيانات الموظفين</h2>
            <p className="text-sm text-slate-600 mt-1">خاص بموظفي ديوان المنطقة الغربية - جبل نفوسة</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* بطاقة الموظفين */}
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
                  <input
                    type="checkbox"
                    checked={isEmployeeMode}
                    onChange={(e) => setIsEmployeeMode(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-emerald-600"
                  />
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
                    <p className="text-xs text-slate-500">
                      ضع علامة ✓ على "أنا موظف" أعلاه
                      <br />
                      ثم أدخل رقمك الوطني للبحث
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* بطاقة الإدارة */}
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

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-3">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs">
            <span className="opacity-70">تصميم وتطوير المنظومة:</span>
            <span className="font-bold mr-2 text-amber-400 tracking-wider">{SYSTEM_NAME}</span>
          </p>
          <p className="text-[10px] opacity-60 mt-1">
            جميع الحقوق محفوظة © {new Date().getFullYear()} - الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
          </p>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────
// نموذج بحث الموظف بالرقم الوطني
// ──────────────────────────────────────────────
function EmployeeSearchForm({
  onFound,
}: {
  onFound: (result: EmployeeLoginResult & { employee?: Employee }) => void;
}) {
  const [step, setStep] = useState<"national" | "code">("national");
  const [nn, setNn] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const goToCode = () => {
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    if (cleaned.length !== 12) {
      setError("الرقم الوطني يجب أن يكون 12 رقماً بالضبط");
      return;
    }
    setError("");
    setStep("code");
  };

  const login = async () => {
    setError("");
    setLoading(true);
    const cleaned = nn.replace(/[^\d]/g, "").trim();
    const codeUp = code.trim().toUpperCase();

    if (!codeUp) {
      setError("أدخل الكود أولاً");
      setLoading(false);
      return;
    }

    try {
      const employees = await fetchEmployeesFromSheet();
      const found = findEmployeeByNationalNumber(employees, cleaned);

      if (!found) {
        setError("❌ الرقم الوطني غير موجود في المنظومة. راجع إدارة المنظومة.");
        setLoading(false);
        return;
      }

      const codeKey = `emp_code_${cleaned}`;
      const stored = JSON.parse(localStorage.getItem(codeKey) || "{}");

      if (stored.blocked === true) {
        setError("🚫 الحساب محجوب بسبب 3 محاولات خاطئة. يرجى مراجعة الإدارة.");
        setLoading(false);
        return;
      }

      const expectedCode = stored.code || INIT_CODE;
      const currentAttempts = stored.attempts || 0;

      if (codeUp !== expectedCode) {
        const newAttempts = currentAttempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          localStorage.setItem(
            codeKey,
            JSON.stringify({
              ...stored,
              attempts: MAX_LOGIN_ATTEMPTS,
              blocked: true,
              blockDate: new Date().toISOString(),
              blockReason: "3 محاولات خاطئة",
            })
          );
          setError("🚫 تم حجب الحساب بعد 3 محاولات خاطئة. راجع الإدارة.");
        } else {
          localStorage.setItem(codeKey, JSON.stringify({ ...stored, attempts: newAttempts }));
          setError(`❌ كود خاطئ. المحاولات المتبقية: ${MAX_LOGIN_ATTEMPTS - newAttempts}`);
        }
        setLoading(false);
        return;
      }

      // كود صحيح - إعادة ضبط المحاولات
      localStorage.setItem(
        codeKey,
        JSON.stringify({ ...stored, attempts: 0, lastLogin: new Date().toISOString() })
      );

      addLog(
        { userId: "public", username: cleaned, fullName: (found as Record<string, string>).fullName || "", role: "public" },
        "login",
        `دخول موظف: ${cleaned}`
      );

      onFound({ employee: found, isComplete: true, missing: [] });
    } catch {
      setError("حدث خطأ أثناء التحقق. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {step === "national" ? (
        <>
          <div>
            <label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني</label>
            <input
              type="text"
              value={nn}
              onChange={(e) => {
                setNn(e.target.value.replace(/[^\d]/g, "").slice(0, 12));
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && goToCode()}
              placeholder="أدخل رقمك الوطني"
              inputMode="numeric"
              maxLength={12}
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none tracking-widest"
              dir="ltr"
              autoFocus
            />
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">يتكون من 12 رقماً بالضبط</span>
              <span dir="ltr" className={`font-bold ${nn.length === 12 ? "text-emerald-600" : "text-slate-400"}`}>
                {nn.length}/12
              </span>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">
              {error}
            </div>
          )}
          <button
            onClick={goToCode}
            disabled={nn.length !== 12}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
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
            <button
              onClick={() => { setStep("national"); setCode(""); setError(""); setAttempts(0); }}
              className="text-[10px] text-emerald-600 hover:text-emerald-800 underline"
            >
              تغيير
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-600 mb-1 block font-medium">كود الدخول</label>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().slice(0, 10)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="NACC2026"
              className="w-full px-3 py-3 border-2 border-slate-300 rounded-xl text-base font-mono text-center tracking-widest focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
              dir="ltr"
              autoFocus
            />
            <p className="text-[10px] text-slate-400 mt-1 text-center">
              أول مرة؟ استخدم الكود المبدئي:{" "}
              <span className="font-bold text-emerald-700 tracking-wider">{INIT_CODE}</span>
            </p>
          </div>
          {attempts > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-center text-red-600 font-medium">
                المحاولات المتبقية: {Math.max(0, MAX_LOGIN_ATTEMPTS - attempts)}/{MAX_LOGIN_ATTEMPTS}
              </p>
              <div className="flex gap-1.5 justify-center">
                {Array.from({ length: MAX_LOGIN_ATTEMPTS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 w-10 rounded-full transition-all ${i < attempts ? "bg-red-500" : "bg-slate-200"}`}
                  />
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 text-center">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setStep("national"); setCode(""); setError(""); }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
            >
              ← رجوع
            </button>
            <button
              onClick={login}
              disabled={loading || !code.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-sm transition shadow-md disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري التحقق...
                </span>
              ) : (
                "🔐 دخول"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// نموذج دخول الإدارة
// ──────────────────────────────────────────────
function AdminLoginForm({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const tryLogin = () => {
    const user = findUser(username, password);
    if (!user) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      setPassword("");
      return;
    }
    onLogin(user);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-500 mb-1 block">اسم المستخدم</label>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && tryLogin()}
          placeholder="username"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          dir="ltr"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 mb-1 block">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && tryLogin()}
          placeholder="••••••"
          className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          dir="ltr"
        />
      </div>
      {error && (
        <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-center">{error}</p>
      )}
      <button
        onClick={tryLogin}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl font-medium text-sm transition shadow-md"
      >
        🔓 دخول
      </button>
    </div>
  );
}
