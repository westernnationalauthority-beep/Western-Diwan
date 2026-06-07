import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session } from "../lib/storage";
import { type DeleteRequest, getDeleteRequests, approveDeleteRequest, rejectDeleteRequest, cleanDeleteRequests, updateDeleteRequest, deleteDeleteRequest } from "../data/employees";
import { addLog } from "../lib/storage";
import { StatCard } from "./Shared";
import { getHeaderHTML, getFooterHTML } from "./PrintTemplates";

function printDeleteRequestReport(req: DeleteRequest) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="UTF-8"><title>طلب حذف - ${req.employeeName}</title><style>body{font-family:Tahoma;padding:20px}.card{border:2px solid #1e3a8a;padding:20px;border-radius:10px}.row{display:flex;justify-content:space-between;margin:10px 0;border-bottom:1px solid #eee;padding-bottom:5px}.label{font-weight:bold;color:#555}.val{color:#000}@media print{.no-print{display:none}}</style></head><body>${getHeaderHTML()}<div class="card"><h2 style="text-align:center;color:#1e3a8a">تفاصيل طلب حذف موظف</h2><div class="row"><span class="label">رقم الطلب:</span><span class="val">${req.refNum}</span></div><div class="row"><span class="label">الموظف:</span><span class="val">${req.employeeName}</span></div><div class="row"><span class="label">الرقم الوطني:</span><span class="val" dir="ltr">${req.nationalNumber}</span></div><div class="row"><span class="label">السبب:</span><span class="val">${req.reason}</span></div><div class="row"><span class="label">رقم القرار:</span><span class="val">${req.docNumber || '-'}</span></div><div class="row"><span class="label">تاريخ القرار:</span><span class="val">${req.docDate || '-'}</span></div><div class="row"><span class="label">الحالة:</span><span class="val">${req.status}</span></div><div class="row"><span class="label">ملاحظة المدير:</span><span class="val">${req.adminNote || '-'}</span></div></div>${getFooterHTML()}<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px;background:#1e3a8a;color:white;border:none;border-radius:5px">طباعة</button></body></html>`);
  w.document.close();
}

export default function DeleteRequestsTab({ session }: { session: Session }) {
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionModal, setActionModal] = useState<{ request: DeleteRequest; type: "approve" | "reject" } | null>(null);
  const [editModal, setEditModal] = useState<DeleteRequest | null>(null);
  const [viewModal, setViewModal] = useState<DeleteRequest | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanMonths, setCleanMonths] = useState(6);
  const [cleaning, setCleaning] = useState(false);

  const handleCleanRequests = async () => {
    if (!confirm(`هل أنت متأكد من حذف الطلبات المعالجة (مقبول/مرفوض) الأقدم من ${cleanMonths} شهر؟`)) return;
    setCleaning(true);
    try {
      const result = await cleanDeleteRequests(cleanMonths);
      if (result.status === "success") {
        addLog(session, "clean_archive", `تنظيف طلبات الحذف القديمة (${cleanMonths} شهر)`);
        alert("✅ " + (result.message || "تم التنظيف"));
        setShowCleanModal(false);
        setTimeout(() => { load(); }, 1000);
      } else { alert("❌ " + (result.message || "فشل التنظيف")); }
    } catch { alert("❌ فشل الاتصال"); }
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
          <p className="text-xs text-slate-500">مراجعة، تعديل، وطباعة الطلبات</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCleanModal(true)} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">🧹 تنظيف القديم</button>
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
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">لا توجد طلبات</td></tr>
              ) : filtered.map((req) => (
                <tr key={req.refNum} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[10px]" dir="ltr">{req.refNum}</td>
                  <td className="px-3 py-2 font-medium">{req.employeeName}</td>
                  <td className="px-3 py-2 font-mono text-indigo-700" dir="ltr">{req.nationalNumber}</td>
                  <td className="px-3 py-2 max-w-[150px] truncate" title={req.reason}>{req.reason}</td>
                  <td className="px-3 py-2 text-slate-600">{req.docNumber || "—"}</td>
                  <td className="px-3 py-2 text-slate-600 text-[10px]">{req.docDate || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      req.status === "مقبول" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                      req.status === "مرفوض" ? "bg-red-100 text-red-800 border-red-200" :
                      "bg-amber-100 text-amber-800 border-amber-200"
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setViewModal(req)} className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">👁️ عرض</button>
                      <button onClick={() => printDeleteRequestReport(req)} className="text-slate-700 hover:text-white hover:bg-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-medium transition">🖨️ طباعة</button>
                      
                      {req.status === "قيد المراجعة" && session.permissions.canApproveDelete && (
                        <>
                          <button onClick={() => setEditModal(req)} className="text-amber-700 hover:text-white hover:bg-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-medium transition">✏️ تعديل</button>
                          <button onClick={() => setActionModal({ request: req, type: "approve" })} className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">✅ موافقة</button>
                          <button onClick={() => setActionModal({ request: req, type: "reject" })} className="text-red-700 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">❌ رفض</button>
                        </>
                      )}
                      
                      {(req.status === "مقبول" || req.status === "مرفوض") && session.permissions.canApproveDelete && (
                        <button onClick={async () => {
                          if(!confirm("حذف نهائي لهذا الطلب؟")) return;
                          const res = await deleteDeleteRequest(req.refNum, session.fullName);
                          if(res.status === "success") { alert("✅ " + res.message); load(); } else { alert("❌ " + res.message); }
                        }} className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">🗑️ حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionModal && <ActionRequestModal request={actionModal.request} type={actionModal.type} session={session} onClose={() => setActionModal(null)} onSuccess={() => { setActionModal(null); load(); }} />}
      
      {editModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-4">تعديل طلب حذف: {editModal.employeeName}</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500">السبب</label><input id="edit-reason" defaultValue={editModal.reason} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-slate-500">رقم القرار</label><input id="edit-docNum" defaultValue={editModal.docNumber} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="text-xs text-slate-500">تاريخ القرار</label><input id="edit-docDate" type="date" defaultValue={editModal.docDate} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">إلغاء</button>
              <button onClick={async () => {
                const reason = (document.getElementById('edit-reason') as HTMLInputElement).value;
                const docNumber = (document.getElementById('edit-docNum') as HTMLInputElement).value;
                const docDate = (document.getElementById('edit-docDate') as HTMLInputElement).value;
                const res = await updateDeleteRequest(editModal.refNum, { reason, docNumber, docDate }, session.fullName);
                if(res.status === "success") { alert("✅ تم التعديل"); setEditModal(null); load(); } else { alert("❌ " + res.message); }
              }} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-4">تفاصيل الطلب: {viewModal.refNum}</h3>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">الموظف:</span><span className="font-bold">{viewModal.employeeName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الرقم الوطني:</span><span className="font-mono" dir="ltr">{viewModal.nationalNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">السبب:</span><span>{viewModal.reason}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">رقم القرار:</span><span>{viewModal.docNumber || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">تاريخ القرار:</span><span>{viewModal.docDate || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الحالة:</span><span className="font-bold">{viewModal.status}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ملاحظة المدير:</span><span>{viewModal.adminNote || '-'}</span></div>
            </div>
            <button onClick={() => setViewModal(null)} className="w-full mt-4 py-2 bg-slate-100 rounded-lg text-sm">إغلاق</button>
          </div>
        </div>
      )}

      {showCleanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCleanModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-red-800 mb-2">🧹 تنظيف الطلبات القديمة</h3>
            <p className="text-xs text-slate-500 mb-4">سيتم حذف الطلبات المقبولة/المرفوضة الأقدم من المدة المحددة.</p>
            <input type="number" value={cleanMonths} onChange={(e) => setCleanMonths(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg mb-4" placeholder="عدد الأشهر" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCleanModal(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-sm">إلغاء</button>
              <button onClick={handleCleanRequests} disabled={cleaning} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">{cleaning ? "جاري..." : "تأكيد الحذف"}</button>
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
        printDeleteRequestReport({ ...request, status: type === "approve" ? "مقبول" : "مرفوض", adminNote: note, adminDate: new Date().toLocaleString("ar-LY") });
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
