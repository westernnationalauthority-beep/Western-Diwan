import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session } from "../lib/storage";
import { getArchivedEmployees, restoreEmployeeFromArchive, cleanArchive } from "../data/employees";
import { addLog } from "../lib/storage";
import { getHeaderHTML, getFooterHTML } from "./PrintTemplates";

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

export default function ArchiveTab({ session }: { session: Session }) {
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
        alert("✅ " + (result.message || "تم تنظيف الأرشيف بنجاح"));
        setShowCleanModal(false);
        setTimeout(() => load(), 1000);
      } else {
        alert("❌ " + (result.message || "فشل تنظيف الأرشيف"));
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
