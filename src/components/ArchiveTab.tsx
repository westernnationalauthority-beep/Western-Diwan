import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session } from "../lib/storage";
import { getArchivedEmployees, restoreEmployeeFromArchive, permanentDeleteArchive } from "../data/employees";
import { addLog } from "../lib/storage";
import { printIndividualForm } from "./PrintTemplates";

export default function ArchiveTab({ session }: { session: Session }) {
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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

  const restore = async (emp: any) => {
    const name = emp["الاســـم ربــاعـــي"];
    const nn = emp["الرقم الوطني"];
    if (!confirm(`هل أنت متأكد من استعادة الموظف "${name}" إلى القائمة الرئيسية؟`)) return;
    const result = await restoreEmployeeFromArchive(nn.toString());
    if (result.status === "success") {
      addLog(session, "restore_archive", `استعادة موظف من الأرشيف: ${name} (${nn})`);
      alert("✅ تم استعادة الموظف بنجاح");
      setTimeout(() => load(), 1500);
    } else { alert("❌ فشل الاستعادة: " + result.message); }
  };

  const printArchiveEmployee = (emp: any) => {
    const mappedEmp = {
      fullName: emp["الاســـم ربــاعـــي"] || "",
      nationalNumber: emp["الرقم الوطني"] || "",
      jobNumber: emp["الرقم الوظيفي"] || "",
      jobGrade: emp["الدرجة الوظيفية الحالية"] || "",
      qualification: emp["المؤهل العلمي  "] || "",
      bankName: emp["أســـــم المصــــرف"] || "",
      iban: emp["رقم الحساب الدولي / الايبان"] || "",
      department: emp["الإدارة"] || "",
      section: emp["القسم"] || "",
      phone: emp["رقم الهاتف"] || "",
      status: emp["الحالة"] || "",
      dataComplete: emp["هل البيانات مكتملة"] || "",
      gender: emp["الجنس"] || "",
      receivesPension: emp["يتقاضى معاش  "] || "",
      specialization: emp["التخصص"] || "",
      grade: emp["التقدير"] || "",
      qualificationOrigin: emp["أصل المؤهل/مكان الحصول علي المؤهل."] || "",
      appointmentDecision: emp["رقم قرار التعيين او قرار النقل / السنة"] || "",
      startDate: emp["تاريخ مباشرة العمل"] || "",
      promotionDate: emp["استحقاق العلاوة  /اخر ترقية "] || "",
      jobStatus: emp["الحالة الوظيفية"] || "",
      employmentType: emp["نوع التوظيف"] || "",
      notes: emp["ملاحظات"] || "",
      requiredAction: emp["الإجراء المطلوب"] || "",
    };
    printIndividualForm(mappedEmp, [], []);
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
                     <div className="flex gap-1 flex-wrap">
                       <button onClick={() => setSelected(emp)} className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">👁️ تفاصيل</button>
                       <button onClick={() => printArchiveEmployee(emp)} className="text-slate-700 hover:text-white hover:bg-slate-700 border border-slate-200 px-2 py-1 rounded text-[10px] font-medium transition">🖨️ طباعة</button>
                       {session.permissions.canRestoreArchive && (
                         <button onClick={() => restore(emp)} className="text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[10px] font-medium transition">♻️ استعادة</button>
                       )}
                       <button onClick={async () => {
                         if(!confirm("حذف نهائي لهذا الموظف من الأرشيف؟ لا يمكن التراجع.")) return;
                         const res = await permanentDeleteArchive(emp["الرقم الوطني"], session.fullName);
                         if(res.status === "success") { alert("✅ " + res.message); load(); } else { alert("❌ " + res.message); }
                       }} className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">🗑️ حذف نهائي</button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
