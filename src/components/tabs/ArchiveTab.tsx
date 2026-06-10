import { useState, useMemo, useCallback, useEffect } from "react";
import { type Session, addLog } from "../../lib/storage";
import { getArchivedEmployees, restoreEmployeeFromArchive, cleanArchive, permanentDeleteFromArchive } from "../../data/employees";

export function ArchiveTab({ session }: { session: Session }) {
  const [archived, setArchived] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Record<string, string> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteNote, setDeleteNote] = useState("");
  const [cleanMonths, setCleanMonths] = useState(12);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setArchived(await getArchivedEmployees()); }
    finally { setLoading(false); }
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

  const restore = async (emp: Record<string, string>) => {
    const name = emp["الاســـم ربــاعـــي"];
    const nn = emp["الرقم الوطني"];
    if (!confirm(`استعادة الموظف "${name}"؟`)) return;
    const result = await restoreEmployeeFromArchive(nn.toString());
    if (result.status === "success") {
      addLog(session, "restore_archive", `استعادة: ${name} (${nn})`);
      alert("✅ تم استعادة الموظف بنجاح");
      setTimeout(() => load(), 1000);
    } else alert("❌ فشل الاستعادة");
  };

  const permanentDelete = async (emp: Record<string, string>) => {
    const name = emp["الاســـم ربــاعـــي"];
    const nn = emp["الرقم الوطني"];
    setDeleting(true);
    try {
      const result = await permanentDeleteFromArchive(nn.toString(), deleteNote, session.fullName);
      if (result.status === "success") {
        addLog(session, "delete_user", `حذف نهائي من الأرشيف: ${name} (${nn}) - ${deleteNote}`);
        alert("✅ تم الحذف النهائي للموظف");
        setDeleteModal(null);
        setDeleteNote("");
        setTimeout(() => load(), 1000);
      } else alert("❌ فشل الحذف النهائي");
    } catch { alert("❌ فشل الاتصال"); }
    finally { setDeleting(false); }
  };

  const handleClean = async () => {
    if (!confirm(`حذف نهائي لسجلات الأرشيف الأقدم من ${cleanMonths} شهر؟`)) return;
    setCleaning(true);
    try {
      const result = await cleanArchive(cleanMonths);
      if (result.status === "success") {
        addLog(session, "clean_archive", `تنظيف الأرشيف (${cleanMonths} شهر)`);
        alert("✅ تم التنظيف");
        setShowCleanModal(false);
        setTimeout(() => load(), 1000);
      } else alert("❌ فشل التنظيف");
    } catch { alert("❌ فشل الاتصال"); }
    finally { setCleaning(false); }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الأرشيف...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🗄️ أرشيف الموظفين</h2>
          <p className="text-xs text-slate-500">الموظفون المؤرشفون — يمكن استعادتهم في أي وقت</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">{archived.length} موظف</span>
          {session.permissions.canRestoreArchive && (
            <button onClick={() => setShowCleanModal(true)}
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">🗑️ تنظيف</button>
          )}
          <button onClick={load} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100">🔄 تحديث</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="🔍 ابحث بالاسم أو الرقم الوطني..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <span className="text-xs text-slate-500">إلى</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-xs" />
        <span className="text-xs text-slate-500">{filtered.length} نتيجة</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["الرقم الوطني","الاسم","الإدارة","تاريخ الأرشفة","المؤرشف بواسطة","السبب","الإجراءات"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400">لا توجد سجلات في الأرشيف</td></tr>
              ) : filtered.map((emp, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{emp["الرقم الوطني"]}</td>
                  <td className="px-3 py-2 font-medium">{emp["الاســـم ربــاعـــي"]}</td>
                  <td className="px-3 py-2 text-slate-600">{emp["الإدارة"] || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">{emp["تاريخ الأرشفة"] || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{emp["المؤرشف بواسطة"] || "—"}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate text-slate-600" title={emp["ملاحظة المدير والسبب النهائي"]}>{emp["ملاحظة المدير والسبب النهائي"] || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => setSelected(emp)}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">👁️ تفاصيل</button>
                      {session.permissions.canRestoreArchive && (
                        <button onClick={() => restore(emp)}
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">♻️ استعادة</button>
                      )}
                      {session.permissions.canRestoreArchive && (
                        <button onClick={() => setDeleteModal(emp)}
                          className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">🗑️ حذف نهائي</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال التفاصيل */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">📦 {selected["الاســـم ربــاعـــي"]}</h3>
                <p className="text-xs text-slate-500 font-mono" dir="ltr">{selected["الرقم الوطني"]}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-200 rounded text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-2">
              {Object.entries(selected).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 px-2 py-1.5 bg-slate-50 rounded">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className="col-span-2 text-sm text-slate-800 break-words">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إغلاق</button>
              {session.permissions.canRestoreArchive && (
                <button onClick={() => { setSelected(null); setDeleteModal(selected); }}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">🗑️ حذف نهائي</button>
              )}
              {session.permissions.canRestoreArchive && (
                <button onClick={() => { setSelected(null); restore(selected); }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">♻️ استعادة</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* مودال تأكيد الحذف النهائي */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setDeleteModal(null); setDeleteNote(""); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {/* رأس المودال */}
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-red-800">🗑️ حذف نهائي من الأرشيف</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {deleteModal["الاســـم ربــاعـــي"]} •{" "}
                  <span dir="ltr" className="font-mono">{deleteModal["الرقم الوطني"]}</span>
                </p>
              </div>
              <button onClick={() => { setDeleteModal(null); setDeleteNote(""); }} className="p-2 hover:bg-red-100 rounded text-slate-500">✕</button>
            </div>

            {/* تفاصيل */}
            <div className="p-5 space-y-3">
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                <p><span className="text-slate-500">السبب:</span> <strong>{deleteModal["ملاحظة المدير والسبب النهائي"] || deleteModal["السبب"] || "—"}</strong></p>
                <p><span className="text-slate-500">المؤرشف بواسطة:</span> {deleteModal["المؤرشف بواسطة"] || "—"}</p>
                <p><span className="text-slate-500">تاريخ الأرشفة:</span> {deleteModal["تاريخ الأرشفة"] || "—"}</p>
              </div>

              {/* حقل الملاحظة */}
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">
                  ملاحظة المدير <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deleteNote}
                  onChange={(e) => setDeleteNote(e.target.value)}
                  rows={3}
                  placeholder="سبب الحذف النهائي..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              {/* تحذير */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                ⚠️ سيُحذف سجل الموظف نهائياً ولا يمكن استعادته لاحقاً.
              </div>
            </div>

            {/* أزرار */}
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => { setDeleteModal(null); setDeleteNote(""); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button
                onClick={() => {
                  if (!deleteNote.trim()) { alert("يرجى إدخال ملاحظة المدير"); return; }
                  permanentDelete(deleteModal);
                }}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {deleting ? "⏳ جاري الحذف..." : "🗑️ تأكيد الحذف النهائي"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال التنظيف */}
      {showCleanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCleanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-red-800">🗑️ تنظيف الأرشيف</h3>
              <button onClick={() => setShowCleanModal(false)} className="p-2 hover:bg-red-100 rounded">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">⚠️ تحذير: الحذف نهائي ولا يمكن التراجع عنه.</div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">احذف السجلات الأقدم من (بالأشهر)</label>
                <input type="number" value={cleanMonths} onChange={(e) => setCleanMonths(parseInt(e.target.value) || 12)} min="1" max="120"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCleanModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={handleClean} disabled={cleaning} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {cleaning ? "جاري..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
