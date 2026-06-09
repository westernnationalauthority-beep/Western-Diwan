import { useState, useMemo, useCallback, useEffect } from "react";
import { type Session, type DeleteRequest, addLog } from "../../lib/storage";
import { getDeleteRequests, approveDeleteRequest, rejectDeleteRequest, cleanDeleteRequests, requestEmployeeDelete } from "../../data/employees";
import { StatCard } from "../ui";

const DELETE_REASONS = [
  "وفاة", "إحالة للتقاعد", "استقالة", "فصل من الخدمة",
  "نقل لجهة أخرى", "انتهاء عقد", "خطأ في الإدخال", "أخرى"
];

export function DeleteRequestsTab({ session }: { session: Session }) {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionModal, setActionModal] = useState<{ request: DeleteRequest; type: "approve" | "reject" } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanMonths, setCleanMonths] = useState(6);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await getDeleteRequests()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let res = filter === "all" ? requests : requests.filter((r) => {
      const map: Record<string, string> = { pending: "قيد المراجعة", approved: "مقبول", rejected: "مرفوض" };
      return r.status === map[filter];
    });
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate + "T23:59:59").getTime() : Date.now() + 86400000;
      res = res.filter((r) => {
        if (!r.submitDate) return false;
        const parts = r.submitDate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (!parts) return true;
        const dt = new Date(`${parts[1]}-${String(parts[2]).padStart(2, "0")}-${String(parts[3]).padStart(2, "0")}`).getTime();
        return dt >= start && dt <= end;
      });
    }
    return res;
  }, [requests, filter, startDate, endDate]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === "قيد المراجعة").length,
    approved: requests.filter((r) => r.status === "مقبول").length,
    rejected: requests.filter((r) => r.status === "مرفوض").length,
  }), [requests]);

  const handleClean = async () => {
    if (!confirm(`حذف الطلبات المعالجة الأقدم من ${cleanMonths} شهر؟`)) return;
    setCleaning(true);
    try {
      const result = await cleanDeleteRequests(cleanMonths, true);
      if (result.status === "success") {
        addLog(session, "clean_archive", `تنظيف طلبات الحذف القديمة (${cleanMonths} شهر)`);
        alert("✅ تم التنظيف");
        setShowCleanModal(false);
        setTimeout(() => load(), 1000);
      }
    } catch { alert("❌ فشل التنظيف"); }
    finally { setCleaning(false); }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">جاري تحميل الطلبات...</div>;

  const statusBadge = (s: string) =>
    s === "مقبول" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
    s === "مرفوض" ? "bg-red-100 text-red-800 border-red-200" :
    "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">📋 طلبات حذف الموظفين</h2>
          <p className="text-xs text-slate-500">مراجعة طلبات الحذف والموافقة أو الرفض</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {session.permissions.canApproveDelete && (
            <button onClick={() => setShowCleanModal(true)}
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">🧹 تنظيف</button>
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
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
          <span className="text-xs text-slate-500">إلى</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs" />
        </div>
        <span className="text-xs text-slate-500">{filtered.length} طلب</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["رقم الطلب","الموظف","الرقم الوطني","السبب","رقم القرار","تاريخ التقديم","بواسطة","الحالة","الإجراءات"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-semibold text-slate-600">{h}</th>
                ))}
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
                  <td className="px-3 py-2 max-w-[130px] truncate" title={req.reason}>{req.reason}</td>
                  <td className="px-3 py-2 text-slate-600">{req.docNumber || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">{req.submitDate}</td>
                  <td className="px-3 py-2 text-slate-600">{req.submittedBy}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(req.status)}`}>{req.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    {req.status === "قيد المراجعة" && session.permissions.canApproveDelete && (
                      <div className="flex gap-1">
                        <button onClick={() => setActionModal({ request: req, type: "approve" })}
                          className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">✅ موافقة</button>
                        <button onClick={() => setActionModal({ request: req, type: "reject" })}
                          className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">❌ رفض</button>
                      </div>
                    )}
                    {req.status !== "قيد المراجعة" && req.adminNote && (
                      <span className="text-[10px] text-slate-500 italic" title={req.adminNote}>ملاحظة محفوظة</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال الموافقة / الرفض */}
      {actionModal && (
        <ActionModal
          request={actionModal.request} type={actionModal.type} session={session}
          onClose={() => setActionModal(null)}
          onSuccess={() => { setActionModal(null); load(); }}
        />
      )}

      {/* مودال التنظيف */}
      {showCleanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCleanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-red-800">🧹 تنظيف الطلبات القديمة</h3>
              <button onClick={() => setShowCleanModal(false)} className="p-2 hover:bg-red-100 rounded">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">⚠️ سيحذف الطلبات المعالجة (مقبول/مرفوض) فقط. الطلبات قيد المراجعة تبقى.</div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">احذف الأقدم من (بالأشهر)</label>
                <input type="number" value={cleanMonths} onChange={(e) => setCleanMonths(parseInt(e.target.value) || 6)} min="1" max="120"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCleanModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={handleClean} disabled={cleaning} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {cleaning ? "جاري..." : "تأكيد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionModal({ request, type, session, onClose, onSuccess }: {
  request: DeleteRequest; type: "approve" | "reject";
  session: Session; onClose: () => void; onSuccess: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (submitting || done) return;
    if (!note.trim()) { setError(type === "approve" ? "أدخل ملاحظة الموافقة" : "أدخل سبب الرفض"); return; }
    setSubmitting(true);
    try {
      const result = type === "approve"
        ? await approveDeleteRequest(request.refNum, note, session.fullName)
        : await rejectDeleteRequest(request.refNum, note);
      if (result.status === "success") {
        setDone(true);
        addLog(session, type === "approve" ? "approve_delete" : "reject_delete",
          `${type === "approve" ? "موافقة حذف" : "رفض حذف"}: ${request.employeeName}`);
        window.dispatchEvent(new Event("delete-requests-changed"));
        if (type === "approve")
          window.dispatchEvent(new CustomEvent("employee-removed", { detail: { nationalNumber: request.nationalNumber } }));
        alert(type === "approve" ? "✅ تم نقل الموظف للأرشيف" : "✅ تم رفض الطلب");
        setTimeout(() => onSuccess(), 500);
      } else {
        setError("فشل التنفيذ، حاول مرة أخرى");
        setSubmitting(false);
      }
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className={`px-5 py-4 border-b ${type === "approve" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <h3 className="font-bold">{type === "approve" ? "✅ موافقة على الحذف" : "❌ رفض الطلب"}</h3>
          <p className="text-xs text-slate-600 mt-1">{request.employeeName} • <span dir="ltr">{request.nationalNumber}</span></p>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <p><span className="text-slate-500">السبب:</span> <strong>{request.reason}</strong></p>
            <p><span className="text-slate-500">طلب بواسطة:</span> {request.submittedBy}</p>
          </div>
          <div>
            <label className="text-xs text-slate-600 font-medium mb-1 block">ملاحظة المدير <span className="text-red-500">*</span></label>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={type === "approve" ? "سبب الموافقة..." : "سبب الرفض..."} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 text-center">{error}</div>}
          {type === "approve" && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
              ⚠️ سيُنقل الموظف للأرشيف ويمكن استعادته لاحقاً.
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} disabled={submitting || done}
            className={`px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
            {done ? "✅ تم" : submitting ? "⏳ جاري..." : type === "approve" ? "تأكيد الموافقة" : "تأكيد الرفض"}
          </button>
        </div>
      </div>
    </div>
  );
}
