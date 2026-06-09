import { useState, useMemo, useCallback, useEffect } from "react";
import { type Session, addLog } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import { generateRandomCode, sendCodeViaWhatsApp } from "../../utils";
import { StatCard } from "../ui";
import { NACC_LOGO } from "../../constants";

type EnrichedEmployee = Employee & {
  code: string; codeType: string; lastLogin: string;
  expiry: string; attempts: number; blockReason: string; empStatus: string;
};

export function CodesTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired" | "no_code">("all");
  const [loading, setLoading] = useState(true);
  const [showCodeModal, setShowCodeModal] = useState<{ emp: Employee; code: string } | null>(null);

  const getEmpCode = (nn: string) => {
    try { return JSON.parse(localStorage.getItem(`emp_code_${nn}`) || "{}"); } catch { return {}; }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      setEmployees(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo<EnrichedEmployee[]>(() => employees.map((e) => {
    const stored = getEmpCode(e.nationalNumber);
    let empStatus = "بدون كود";
    if (stored.blocked) empStatus = "محجوب";
    else if (stored.code) {
      const lastLogin = stored.lastLogin ? new Date(stored.lastLogin) : null;
      if (lastLogin) {
        const diffDays = (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
        empStatus = diffDays > 90 ? "منتهي" : "نشط";
      } else empStatus = "جديد";
    }
    return {
      ...e,
      code: stored.code || "",
      codeType: stored.type || "",
      lastLogin: stored.lastLogin ? new Date(stored.lastLogin).toLocaleDateString("ar-LY") : "—",
      expiry: stored.expiry ? new Date(stored.expiry).toLocaleDateString("ar-LY") : "—",
      attempts: stored.attempts || 0,
      blockReason: stored.blockReason || "",
      empStatus,
    };
  }), [employees]);

  const filtered = useMemo(() => {
    let r = enriched;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((e) => e.nationalNumber.includes(s) || e.fullName.toLowerCase().includes(s));
    }
    if (statusFilter !== "all") {
      const map: Record<string, string> = { active: "نشط", blocked: "محجوب", expired: "منتهي", no_code: "بدون كود" };
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

  const generateCodeFor = (emp: Employee) => {
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
    addLog(session, "create_user", `توليد كود للموظف: ${emp.fullName} (${emp.nationalNumber})`);
    load();
  };

  const unblock = (emp: Employee) => {
    if (!confirm(`فك حجب "${emp.fullName}" وتوليد كود جديد؟`)) return;
    generateCodeFor(emp);
  };

  const resetAttempts = (emp: Employee) => {
    const stored = getEmpCode(emp.nationalNumber);
    localStorage.setItem(`emp_code_${emp.nationalNumber}`, JSON.stringify({ ...stored, attempts: 0 }));
    load();
  };

  const printCard = (emp: Employee, code: string) => {
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>بطاقة كود - ${emp.fullName}</title>
<style>
  body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px;background:#f1f5f9;}
  .card{background:white;border:3px solid #1e3a8a;border-radius:16px;padding:24px;max-width:400px;margin:0 auto;box-shadow:0 10px 30px rgba(0,0,0,.1);}
  .header{text-align:center;border-bottom:2px dashed #b8860b;padding-bottom:12px;margin-bottom:16px;}
  .code-box{background:linear-gradient(135deg,#1e3a8a,#4338ca);color:white;padding:16px;border-radius:12px;text-align:center;margin:16px 0;}
  .code-value{font-family:monospace;font-size:32px;font-weight:bold;letter-spacing:6px;}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:10px;margin-top:12px;font-size:10px;color:#92400e;text-align:center;}
  @media print{body{background:white;padding:0;}.no-print{display:none;}}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="${NACC_LOGO}" width="60" height="60" alt="NACC"/>
    <div style="color:#1e3a8a;font-size:14px;font-weight:bold;margin:8px 0 4px;">الهيئة الوطنية لمكافحة الفساد</div>
    <div style="color:#b8860b;font-size:11px;">ديوان المنطقة الغربية</div>
  </div>
  <div style="text-align:center;font-size:13px;font-weight:bold;color:#1e3a8a;margin-bottom:12px;">بطاقة دخول المنظومة</div>
  <div style="color:#64748b;font-size:10px;margin-top:12px;">الاسم:</div>
  <div style="color:#1e293b;font-size:14px;font-weight:bold;">${emp.fullName}</div>
  <div style="color:#64748b;font-size:10px;margin-top:8px;">الرقم الوطني:</div>
  <div style="font-family:monospace;direction:ltr;text-align:right;font-weight:bold;">${emp.nationalNumber}</div>
  <div class="code-box">
    <div style="font-size:10px;opacity:.8;margin-bottom:6px;">🔐 كود الدخول:</div>
    <div class="code-value">${code}</div>
  </div>
  <div class="warning">⚠️ هذا الكود سري. لا تشاركه مع أي شخص.</div>
  <div style="text-align:center;margin-top:16px;font-size:9px;color:#94a3b8;">تصميم: S-BUTTO • ${new Date().toLocaleDateString("ar-LY")}</div>
</div>
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ طباعة</button>
</body></html>`);
    w.document.close();
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري التحميل...</div>;

  const statusBadge = (s: string) => {
    if (s === "نشط") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (s === "محجوب") return "bg-red-100 text-red-800 border-red-200";
    if (s === "منتهي") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🔑 إدارة أكواد الموظفين</h2>
          <p className="text-xs text-slate-500">عرض، توليد، فك حجب، وطباعة بطاقات الأكواد</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">🔄 تحديث</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="👥" />
        <StatCard label="نشط" value={stats.active} color="emerald" icon="✅" />
        <StatCard label="محجوب" value={stats.blocked} color="red" icon="🚫" />
        <StatCard label="منتهي" value={stats.expired} color="amber" icon="⏰" />
        <StatCard label="بدون كود" value={stats.noCode} color="slate" icon="❓" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="ابحث بالاسم أو الرقم الوطني..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="blocked">محجوب</option>
          <option value="expired">منتهي</option>
          <option value="no_code">بدون كود</option>
        </select>
        <span className="text-xs text-slate-500">{filtered.length} / {enriched.length}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right">الرقم الوطني</th>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">الكود</th>
                <th className="px-3 py-2 text-right">آخر دخول</th>
                <th className="px-3 py-2 text-right">الانتهاء</th>
                <th className="px-3 py-2 text-right">المحاولات</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.nationalNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp.nationalNumber}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{emp.fullName}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{emp.code || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{emp.lastLogin}</td>
                  <td className="px-3 py-2 text-slate-500">{emp.expiry}</td>
                  <td className="px-3 py-2 text-center">
                    {emp.attempts > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${emp.attempts >= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {emp.attempts}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(emp.empStatus)}`}>
                      {emp.empStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {emp.empStatus === "محجوب" ? (
                        <button onClick={() => unblock(emp)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                          فك الحجب
                        </button>
                      ) : (
                        <button onClick={() => generateCodeFor(emp)}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-medium">
                          {emp.code ? "تجديد" : "توليد"} كود
                        </button>
                      )}
                      {emp.attempts > 0 && (
                        <button onClick={() => resetAttempts(emp)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px]">
                          إعادة ضبط
                        </button>
                      )}
                      {emp.code && emp.phone && (
                        <button onClick={() => sendCodeViaWhatsApp(emp.phone, emp.fullName, emp.code)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px]">
                          💬
                        </button>
                      )}
                      {emp.code && (
                        <button onClick={() => printCard(emp, emp.code)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px]">
                          🖨️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال عرض الكود */}
      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCodeModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl">🔑</div>
            <h3 className="font-bold text-slate-900">تم توليد الكود</h3>
            <p className="text-sm text-slate-600">{showCodeModal.emp.fullName}</p>
            <div className="bg-indigo-900 text-white rounded-xl p-5">
              <p className="text-[10px] opacity-70 mb-2">كود الدخول</p>
              <p className="font-mono text-3xl font-bold tracking-widest">{showCodeModal.code}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { printCard(showCodeModal.emp, showCodeModal.code); }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">🖨️ طباعة</button>
              {showCodeModal.emp.phone && (
                <button onClick={() => sendCodeViaWhatsApp(showCodeModal.emp.phone, showCodeModal.emp.fullName, showCodeModal.code)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">💬 واتساب</button>
              )}
            </div>
            <button onClick={() => setShowCodeModal(null)} className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm">إغلاق</button>
          </div>
        </div>
      )}
    </div>
  );
}
