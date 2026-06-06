import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session } from "../lib/storage";
import { type DeleteRequest, DELETE_REASONS, getDeleteRequests, requestEmployeeDelete, approveDeleteRequest, rejectDeleteRequest, cleanDeleteRequests } from "../data/employees";
import { addLog } from "../lib/storage";
import { StatCard } from "./Shared";
import { getHeaderHTML, getFooterHTML } from "./PrintTemplates";

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

export default function DeleteRequestsTab({ session }: { session: Session }) {
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
        setTimeout(() => { window.location.reload(); }, 1500);
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
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
      res = res.filter((r) => {
        const dateStr = r.docDate || r.submitDate;
        if (!dateStr) return false;
        const parts = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (!parts) return true;
        const dt = new Date(`${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`).setHours(0, 0, 0, 0);
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
                <th className="px-3 py-2 text-right">تاريخ القرار</th>
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
                  <td className="px-3 py-2 text-slate-600">{req.docDate || "—"}</td>
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
