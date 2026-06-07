import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session, type User, type Permissions, type ActivityLog, type CustomField, ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS, PERMISSION_LABELS, ACTION_LABELS } from "../lib/storage";
import { getUsers, createUser, updateUser, deleteUser, changePassword, addLog, getLogs, getUserStats, clearLogs, getCustomFields, addCustomField, deleteCustomField, toggleFieldRequired, getRequiredFieldsConfig, saveRequiredFieldsConfig } from "../lib/storage";
import { generateRandomCode, sendCodeViaWhatsApp } from "../utils/helpers";
import { addColumnToSheet, deleteColumnFromSheet, getSystemInfo } from "../data/employees";
import { StatCard, Pagination } from "./Shared";

// CodesTab
export function CodesTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "expired" | "no_code">("all");
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<{ emp: any; code: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Mock fetch for now, should import fetchEmployeesFromSheet
      const { fetchEmployeesFromSheet } = await import("../data/employees");
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
    // نافذة طباعة تلقائية فور التوليد
    setTimeout(() => printCard(emp, newCode), 500);
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="👥" />
        <StatCard label="نشط" value={stats.active} color="emerald" icon="✅" />
        <StatCard label="محجوب" value={stats.blocked} color="red" icon="🚫" />
        <StatCard label="منتهي" value={stats.expired} color="amber" icon="⏰" />
        <StatCard label="بدون كود" value={stats.noCode} color="slate" icon="❓" />
      </div>
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

// UsersTab
export function UsersTab({ session }: { session: Session }) {
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

// FieldsTab
export function FieldsTab({ session }: { session: Session }) {
  const [fields, setFields] = useState<CustomField[]>(getCustomFields());
  const [newLabel, setNewLabel] = useState("");
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [error, setError] = useState("");
  const [reqConfig, setReqConfig] = useState<Record<string, boolean>>(getRequiredFieldsConfig());
  const LOCAL_ALL_FIELD_LABELS: Record<string, string> = {
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-amber-50">
          <h3 className="font-bold text-amber-800 text-sm">⚙️ إعدادات النواقص - الحقول الأصلية</h3>
          <p className="text-[10px] text-amber-600 mt-1">فعّل الحقول التي تريد حسابها من النواقص (الحقول المعطلة لن تظهر كنقص)</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(LOCAL_ALL_FIELD_LABELS).map(([key, label]) => (
            <label key={key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition text-sm ${reqConfig[key] ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
              <input type="checkbox" checked={!!reqConfig[key]} onChange={() => handleToggleStdRequired(key)} className="w-3.5 h-3.5 accent-red-600" />
              <span className="text-xs">{label}</span>
              {reqConfig[key] ? <span className="text-[9px] text-red-600 mr-auto">مهم</span> : <span className="text-[9px] text-slate-400 mr-auto">غير مهم</span>}
            </label>
          ))}
        </div>
      </div>
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

// LogsTab
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

export function LogsTab() {
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

// SettingsTab
export function SettingsTab({ session }: { session: Session }) {
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

// AboutTab - شاشة حول النظام
export function AboutTab() {
  const [info, setInfo] = useState<{ "الإصدار": string; "المصمم": string }>({ "الإصدار": "v5", "المصمم": "S-BUTTO" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const data = await getSystemInfo();
        setInfo(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadInfo();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">حول المنظومة</h2>
        <p className="text-sm text-slate-500 mt-1">معلومات عن نظام إدارة بيانات الموظفين</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-xl p-8 text-white text-center">
        <div className="text-6xl mb-4">🏛️</div>
        <h3 className="text-2xl font-bold mb-2">نظام إدارة بيانات الموظفين</h3>
        <p className="text-lg opacity-90">الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="bg-white/20 backdrop-blur rounded-xl px-6 py-3">
            <p className="text-xs opacity-80">الإصدار الحالي</p>
            <p className="text-2xl font-bold tracking-wider">{loading ? "..." : info["الإصدار"] || "v5"}</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl px-6 py-3">
            <p className="text-xs opacity-80">المصمم والمطور</p>
            <p className="text-2xl font-bold tracking-wider">{loading ? "..." : info["المصمم"] || "S-BUTTO"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-2xl">ℹ️</span> معلومات النظام
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">اسم المنظومة</p>
            <p className="font-bold text-slate-800">منظومة بيانات موظفي ديوان الغربية</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">الإصدار</p>
            <p className="font-bold text-indigo-700">{loading ? "جاري التحميل..." : info["الإصدار"] || "v5"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">المصمم والمطور</p>
            <p className="font-bold text-slate-800">{loading ? "جاري التحميل..." : info["المصمم"] || "S-BUTTO"}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">الجهة</p>
            <p className="font-bold text-slate-800">الهيئة الوطنية لمكافحة الفساد</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <span className="text-2xl">📋</span> مميزات المنظومة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>إدارة بيانات الموظفين بشكل كامل</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>تقارير وإحصائيات متقدمة</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>نظام أكواد دخول آمن للموظفين</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>أرشيف الموظفين مع إمكانية الاستعادة</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>طباعة النماذج والتقارير</span></div>
          <div className="flex items-start gap-2"><span className="text-emerald-600 mt-0.5">✅</span><span>إدارة الصلاحيات والمستخدمين</span></div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pb-4">
        <p>جميع الحقوق محفوظة © {new Date().getFullYear()} - الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية</p>
        <p className="mt-1">تصميم وتطوير: <span className="font-bold text-amber-600">S-BUTTO</span></p>
      </div>
    </div>
  );
}
