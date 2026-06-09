import { useState, useMemo } from "react";
import { getLogs, clearLogs, type ActivityLog as Log } from "../../lib/storage";
import { Pagination } from "../ui";

const ACTION_LABELS: Record<string, string> = {
  login: "تسجيل دخول", logout: "خروج", view_employee: "عرض موظف",
  edit_employee: "فتح تعديل", save_employee: "حفظ تعديل", create_user: "إنشاء/كود",
  delete_user: "طلب حذف", print_employee: "طباعة فرد", print_all: "طباعة جماعي",
  print_summary: "طباعة ملخص", export_csv: "تصدير CSV", refresh_data: "تحديث بيانات",
  search: "بحث", change_password: "تغيير كلمة المرور", approve_delete: "موافقة حذف",
  reject_delete: "رفض حذف", restore_archive: "استعادة أرشيف", clean_archive: "تنظيف",
  add_field: "إضافة حقل", remove_field: "حذف حقل",
};

function getActionBadge(action: string): string {
  if (action === "login") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (action === "logout") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (action.startsWith("print")) return "bg-slate-100 text-slate-700 border border-slate-200";
  if (action === "export_csv") return "bg-cyan-100 text-cyan-700 border border-cyan-200";
  if (action === "view_employee") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (action === "edit_employee" || action === "save_employee") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (action.includes("user") || action === "change_password") return "bg-violet-100 text-violet-700 border border-violet-200";
  if (action.includes("field")) return "bg-cyan-100 text-cyan-700 border border-cyan-200";
  if (action.includes("delete") || action.includes("archive")) return "bg-red-100 text-red-700 border border-red-200";
  return "bg-gray-100 text-gray-700 border border-gray-200";
}

export function LogsTab() {
  const [logs] = useState<Log[]>(() => getLogs());
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  // قائمة المستخدمين الفريدة من السجلات
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (!map.has(l.username)) map.set(l.username, l.fullName);
    });
    return Array.from(map.entries()).map(([username, fullName]) => ({ username, fullName }));
  }, [logs]);

  const filtered = useMemo(() => {
    let r = [...logs].reverse();
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      r = r.filter((l) =>
        l.fullName.toLowerCase().includes(s) ||
        l.username.toLowerCase().includes(s) ||
        l.details.toLowerCase().includes(s)
      );
    }
    if (actionFilter) r = r.filter((l) => l.action === actionFilter);
    if (userFilter) r = r.filter((l) => l.username === userFilter);
    return r;
  }, [logs, search, actionFilter, userFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">📊 سجل النشاطات</h2>
          <p className="text-xs text-slate-500">{logs.length} سجل محفوظ</p>
        </div>
        <button
          onClick={() => { if (confirm("حذف كل السجلات؟")) { clearLogs(); window.location.reload(); } }}
          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100"
        >
          🗑️ مسح السجلات
        </button>
      </div>

      {/* شريط الفلاتر */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="بحث بالاسم أو التفاصيل..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        {/* فلتر المستخدم */}
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[160px]"
        >
          <option value="">👤 كل المستخدمين</option>
          {uniqueUsers.map(({ username, fullName }) => (
            <option key={username} value={username}>
              {fullName} (@{username})
            </option>
          ))}
        </select>
        {/* فلتر العملية */}
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="">كل العمليات</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {/* عداد النتائج + زر مسح الفلاتر */}
        <div className="flex items-center gap-2 self-center">
          <span className="text-xs text-slate-500">{filtered.length} سجل</span>
          {(userFilter || actionFilter || search) && (
            <button
              onClick={() => { setUserFilter(""); setActionFilter(""); setSearch(""); setPage(1); }}
              className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200"
            >
              ✕ مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-right">الوقت</th>
                <th className="px-3 py-2 text-right">المستخدم</th>
                <th className="px-3 py-2 text-right">الصلاحية</th>
                <th className="px-3 py-2 text-right">العملية</th>
                <th className="px-3 py-2 text-right">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-[10px]">
                    {new Date(l.timestamp).toLocaleString("ar-LY")}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {l.fullName}
                    <br /><span className="text-[10px] text-slate-400 font-mono" dir="ltr">@{l.username}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      l.role === "admin" ? "bg-violet-100 text-violet-800" :
                      l.role === "public" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {l.role === "admin" ? "مدير" : l.role === "public" ? "عام" : "موظف"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium ${getActionBadge(l.action)}`}>
                      {ACTION_LABELS[l.action] || l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{l.details}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    لا توجد سجلات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onChange={setPage} />}
      </div>
    </div>
  );
}
