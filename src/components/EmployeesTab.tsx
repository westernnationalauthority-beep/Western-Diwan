import { useState, useEffect, useMemo, useCallback } from "react";
import { type Employee, fetchEmployeesFromSheet, updateEmployeeInSheet, addEmployeeToSheet, requestEmployeeDelete } from "../data/employees";
import { addLog, getCustomFields, type CustomField, type Session, mergeAllEmployees } from "../lib/storage";
import { isEmpty, getMissingFields, openWhatsApp, sendMissingFieldsViaWhatsApp, ALL_FIELD_LABELS } from "../utils/helpers";
import { StatCard, Th, SortIcon, PageBtn, Pagination, getStatusBadge, getDataCompleteBadge } from "./Shared";
import { printIndividualForm, printAllForms, printSummaryTable, exportCSV } from "./PrintTemplates";

const EDITABLE_FIELDS: { key: string; label: string; mono?: boolean }[] = [
  { key: "fullName", label: "الاسم رباعي" },
  { key: "jobNumber", label: "الرقم الوظيفي", mono: true },
  { key: "jobGrade", label: "الدرجة الوظيفية" },
  { key: "qualification", label: "المؤهل العلمي" },
  { key: "specialization", label: "التخصص" },
  { key: "grade", label: "التقدير" },
  { key: "qualificationOrigin", label: "أصل المؤهل / مكان الحصول" },
  { key: "bankName", label: "المصرف" },
  { key: "iban", label: "رقم الحساب (IBAN)", mono: true },
  { key: "receivesPension", label: "يتقاضى معاش" },
  { key: "appointmentDecision", label: "رقم قرار التعيين", mono: true },
  { key: "startDate", label: "تاريخ المباشرة" },
  { key: "promotionDate", label: "آخر ترقية" },
  { key: "phone", label: "رقم الهاتف", mono: true },
  { key: "department", label: "الإدارة" },
  { key: "section", label: "القسم" },
  { key: "jobStatus", label: "الحالة الوظيفية" },
  { key: "employmentType", label: "نوع التوظيف" },
  { key: "gender", label: "الجنس" },
  { key: "status", label: "الحالة" },
  { key: "dataComplete", label: "اكتمال البيانات" },
  { key: "notes", label: "ملاحظات" },
  { key: "requiredAction", label: "الإجراء المطلوب" },
];

export default function EmployeesTab({ session }: { session: Session }) {
  const [employeesRaw, setEmployeesRaw] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataTimestamp, setDataTimestamp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState<"nationalNumber" | "fullName" | "all">("nationalNumber");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [dataCompleteFilter, setDataCompleteFilter] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [alertPage, setAlertPage] = useState(1);
  const rowsPerPage = 15;
  const alertPerPage = 10;
  const perms = session.permissions;
  const customFields = getCustomFields();

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await fetchEmployeesFromSheet();
      setEmployeesRaw(data);
      setDataTimestamp(new Date().toLocaleString("ar-LY"));
      addLog(session, "refresh_data", `تحميل ${data.length} موظف`);
    } catch { setError("فشل في تحميل البيانات من Google Sheets"); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handleRemove = (e: any) => {
      const removedNN = (e.detail?.nationalNumber || "").toString().replace(/[^\d]/g, "").trim();
      if (removedNN) setEmployeesRaw((prev) => prev.filter((emp) => emp.nationalNumber !== removedNN));
    };
    window.addEventListener("employee-removed", handleRemove);
    return () => window.removeEventListener("employee-removed", handleRemove);
  }, []);

  const employees = useMemo(() => mergeAllEmployees(employeesRaw), [employeesRaw]);

  const filtered = useMemo(() => {
    let result = [...employees];
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((emp) => {
        if (searchBy === "nationalNumber") return emp.nationalNumber.includes(term);
        if (searchBy === "fullName") return emp.fullName.toLowerCase().includes(term);
        return emp.nationalNumber.includes(term) || emp.fullName.toLowerCase().includes(term) || emp.jobNumber.includes(term) || (emp.phone || "").includes(term) || (emp.department || "").toLowerCase().includes(term) || (emp.bankName || "").toLowerCase().includes(term);
      });
    }
    if (statusFilter) result = result.filter((e) => (e.status || "").trim() === statusFilter);
    if (genderFilter) result = result.filter((e) => (e.gender || "").trim() === genderFilter);
    if (dataCompleteFilter) result = result.filter((e) => (e.dataComplete || "").trim() === dataCompleteFilter);
    if (sortKey) result.sort((a: any, b: any) => { const va = a[sortKey] || ""; const vb = b[sortKey] || ""; return sortDir === "asc" ? String(va).localeCompare(String(vb), "ar") : String(vb).localeCompare(String(va), "ar"); });
    return result;
  }, [employees, searchTerm, searchBy, statusFilter, genderFilter, dataCompleteFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const alertEmployees = useMemo(() => employees.filter((e) => e.status === "ناقص"), [employees]);
  const alertTotalPages = Math.ceil(alertEmployees.length / alertPerPage);
  const alertPaginated = alertEmployees.slice((alertPage - 1) * alertPerPage, alertPage * alertPerPage);

  const stats = useMemo(() => ({
    total: employees.length,
    complete: employees.filter((e) => e.dataComplete === "نعم مكتملة").length,
    incomplete: employees.filter((e) => e.dataComplete === "غير مكتملة").length,
    underProcess: employees.filter((e) => e.status === "تحت الاجراء").length,
    completeStatus: employees.filter((e) => e.status === "مستوفي").length,
    missing: employees.filter((e) => e.status === "ناقص").length,
    male: employees.filter((e) => e.gender === "ذكر").length,
    female: employees.filter((e) => e.gender === "أنثى").length,
    hasJobNumber: employees.filter((e) => e.jobNumber && e.jobNumber.trim().length > 0).length,
    noJobNumber: employees.filter((e) => !e.jobNumber || e.jobNumber.trim() === "").length,
  }), [employees]);

  const handleSort = (k: string) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("asc"); } setCurrentPage(1); };
  const clearFilters = () => { setSearchTerm(""); setStatusFilter(""); setGenderFilter(""); setDataCompleteFilter(""); setSortKey(""); setSortDir("asc"); setCurrentPage(1); };

  const handleView = (emp: any) => { setSelectedEmployee(emp); addLog(session, "view_employee", `عرض: ${emp.fullName} (${emp.nationalNumber})`); };
  const handleEdit = (emp: any) => { if (!perms.canEdit) { alert("ليس لديك صلاحية التعديل"); return; } setEditingEmployee(emp); setSelectedEmployee(null); addLog(session, "edit_employee", `فتح تعديل: ${emp.fullName} (${emp.nationalNumber})`); };
  const handleDeleteEmployee = (emp: any) => { if (!perms.canRequestDelete) { alert("ليس لديك صلاحية طلب حذف موظف"); return; } setSelectedEmployee(null); setDeleteRequestEmp(emp); };
  
  const handleSaveEdit = async (nn: string, overrides: Record<string, string>, name: string) => {
    const sheetUpdates: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in overrides) { const cf = cfs.find((c) => c.key === key); if (cf) sheetUpdates[cf.label] = overrides[key]; else sheetUpdates[key] = overrides[key]; }
    const ok = await updateEmployeeInSheet(nn, sheetUpdates);
    if (ok) { addLog(session, "save_employee", `تحديث بيانات الموظف: ${name} (${nn})`); alert("✅ تم إرسال التحديثات بنجاح. ستظهر التغييرات خلال لحظات."); setTimeout(() => loadData(), 3500); } else { alert("❌ فشل الاتصال."); }
    setEditingEmployee(null);
  };

  const [deleteRequestEmp, setDeleteRequestEmp] = useState<any | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  
  const handleAddEmployee = async (employee: any) => {
    const nn = (employee.nationalNumber || "").replace(/[^\d]/g, "").trim();
    if (nn && employees.some((e) => e.nationalNumber === nn)) { alert("❌ الرقم الوطني موجود مسبقاً. لا يمكن إضافة موظف مكرر."); return; }
    const sheetEmployee: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in employee) { const cf = cfs.find((c) => c.key === key); if (cf) sheetEmployee[cf.label] = employee[key]; else sheetEmployee[key] = employee[key]; }
    const result = await addEmployeeToSheet(sheetEmployee);
    if (result) { addLog(session, "create_user", `إضافة موظف جديد للإكسل: ${employee.fullName} (${employee.nationalNumber})`); alert("✅ تم إضافة الموظف بنجاح! سيظهر في القائمة خلال لحظات."); setTimeout(() => loadData(), 3500); } else { alert("❌ فشل الاتصال."); }
    setShowAddEmployee(false);
  };

  const handlePrintIndividual = (emp: any) => { if (!perms.canPrint) { alert("ليس لديك صلاحية الطباعة"); return; } printIndividualForm(emp, getMissingFields(emp), customFields); addLog(session, "print_employee", `طباعة: ${emp.fullName} (${emp.nationalNumber})`); };
  const handlePrintAll = (data: any[], label: string) => { if (!perms.canPrint) return; printAllForms(data, getMissingFields, customFields); addLog(session, "print_all", `طباعة ${data.length} نموذج - ${label}`); setShowExportMenu(false); };
  const handlePrintSummary = (data: any[], label: string) => { if (!perms.canPrint) return; printSummaryTable(data, [], (e: any) => getMissingFields(e).length); addLog(session, "print_summary", `طباعة ملخص ${data.length} - ${label}`); setShowExportMenu(false); };
  const handleExportCSV = (data: any[], filename: string, label: string) => { if (!perms.canExport) return; exportCSV(data, filename, customFields, (e: any) => getMissingFields(e).length); addLog(session, "export_csv", `تصدير ${data.length} - ${label}`); setShowExportMenu(false); };

  if (loading) return (<div className="flex items-center justify-center py-20"><div className="text-center space-y-4"><div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /><p className="text-slate-500">جاري التحميل...</p></div></div>);
  if (error && employees.length === 0) return (<div className="bg-white rounded-2xl shadow-lg border border-red-200 max-w-md mx-auto p-8 text-center space-y-4"><h2 className="text-lg font-bold text-slate-900">خطأ في التحميل</h2><p className="text-sm text-slate-500">{error}</p><button onClick={loadData} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm">إعادة المحاولة</button></div>);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h2 className="text-base font-bold text-slate-800">قاعدة بيانات الموظفين</h2>{perms.canEdit && (<button onClick={() => setShowAddEmployee(true)} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-medium transition flex items-center gap-1"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>إضافة موظف</button>)}</div>
        <div className="flex items-center gap-2">
          {dataTimestamp && <span className="text-[10px] text-slate-400 hidden sm:block">آخر تحديث: {dataTimestamp}</span>}
          <button onClick={loadData} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تحديث"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
          {(perms.canPrint || perms.canExport) && (
            <div className="relative"><button onClick={() => setShowExportMenu(!showExportMenu)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>تصدير / طباعة</button>{showExportMenu && (<><div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} /><div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[230px]">{perms.canExport && <><button onClick={() => handleExportCSV(employees, "موظفي_ديوان_الغربية_كامل", "كل البيانات")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>تصدير CSV (كامل)</span><span>📄</span></button><button onClick={() => handleExportCSV(filtered, "موظفي_ديوان_الغربية_تصفية", "التصفية")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>تصدير CSV (التصفية)</span><span>🔍</span></button><div className="border-t border-slate-100 my-1" /></>}{perms.canPrint && <><button onClick={() => handlePrintAll(filtered, "التصفية")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة النماذج (التصفية)</span><span>📝</span></button><button onClick={() => handlePrintSummary(paginated, "الصفحة")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة (الصفحة الحالية)</span><span>📋</span></button><button onClick={() => handlePrintAll(employees, "الكل")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة النماذج (الكل)</span><span>📚</span></button><button onClick={() => handlePrintSummary(filtered, "ملخص")} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end"><span>طباعة ملخص (جدول)</span><span>📊</span></button></>}</div></>)}</div>
          )}
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">{employees.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        <StatCard label="الإجمالي" value={stats.total} color="slate" icon="👥" /><StatCard label="مكتملة" value={stats.complete} color="emerald" icon="✅" /><StatCard label="غير مكتملة" value={stats.incomplete} color="red" icon="⚠️" /><StatCard label="تحت الإجراء" value={stats.underProcess} color="blue" icon="⏳" /><StatCard label="مستوفي" value={stats.completeStatus} color="emerald" icon="✔️" /><StatCard label="ناقص" value={stats.missing} color="amber" icon="📋" /><StatCard label="ذكور" value={stats.male} color="indigo" icon="👨" /><StatCard label="إناث" value={stats.female} color="pink" icon="👩" /><StatCard label="برقم وظيفي" value={stats.hasJobNumber} color="cyan" icon="🆔" /><StatCard label="بدون رقم" value={stats.noJobNumber} color="orange" icon="❓" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1"><div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div><input type="text" placeholder="ابحث..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            <select value={searchBy} onChange={(e) => { setSearchBy(e.target.value as any); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="nationalNumber">الرقم الوطني</option><option value="fullName">الاسم</option><option value="all">جميع الحقول</option></select>
          </div>
          <div className="flex flex-wrap gap-2"><select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">الحالة</option><option value="مستوفي">مستوفي</option><option value="ناقص">ناقص</option><option value="تحت الاجراء">تحت الإجراء</option></select><select value={dataCompleteFilter} onChange={(e) => { setDataCompleteFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">البيانات</option><option value="نعم مكتملة">مكتملة</option><option value="غير مكتملة">غير مكتملة</option></select><select value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"><option value="">الجنس</option><option value="ذكر">ذكر</option><option value="أنثى">أنثى</option></select>{(searchTerm || statusFilter || genderFilter || dataCompleteFilter) && <button onClick={clearFilters} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-medium hover:bg-red-100">مسح</button>}</div>
        </div>
      </div>

      <p className="text-xs text-slate-500">تم العثور على <span className="font-bold text-slate-700">{filtered.length}</span> موظف{filtered.length !== employees.length && <span className="text-indigo-500 text-[10px] mr-1">(من {employees.length})</span>}</p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b border-slate-200"><Th onClick={() => handleSort("nationalNumber")}>الرقم الوطني <SortIcon column="nationalNumber" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("fullName")}>الاسم <SortIcon column="fullName" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("jobGrade")}>الدرجة <SortIcon column="jobGrade" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("qualification")}>المؤهل <SortIcon column="qualification" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("department")}>الإدارة <SortIcon column="department" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("status")}>الحالة <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} /></Th><Th onClick={() => handleSort("dataComplete")}>البيانات <SortIcon column="dataComplete" sortKey={sortKey} sortDir={sortDir} /></Th><Th>النواقص</Th><Th>إجراءات</Th></tr></thead><tbody className="divide-y divide-slate-100">{paginated.map((emp, idx) => { const missingCount = getMissingFields(emp).length; return (<tr key={emp.nationalNumber + "-" + idx} className="hover:bg-indigo-50/50 cursor-pointer" onClick={() => handleView(emp)}><td className="px-3 py-2.5 font-mono font-medium text-indigo-700 whitespace-nowrap" dir="ltr">{emp.nationalNumber}</td><td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap max-w-[160px] truncate">{emp.fullName}</td><td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.jobGrade || "-"}</td><td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.qualification || "-"}</td><td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{emp.department || "-"}</td><td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(emp.status)}`}>{emp.status || "-"}</span></td><td className="px-3 py-2.5 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getDataCompleteBadge(emp.dataComplete)}`}>{emp.dataComplete || "-"}</span></td><td className="px-3 py-2.5 whitespace-nowrap text-center">{missingCount > 0 ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">{missingCount} ⚠️</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✓</span>}</td><td className="px-3 py-2.5 whitespace-nowrap"><div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); handleView(emp); }} className="text-indigo-600 hover:text-indigo-800 font-medium text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition">عرض</button>{perms.canEdit && <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }} className="text-amber-700 hover:text-white hover:bg-amber-600 font-medium text-[10px] bg-amber-50 px-2 py-1 rounded border border-amber-200 transition">تعديل</button>}{perms.canPrint && <button onClick={(e) => { e.stopPropagation(); handlePrintIndividual(emp); }} className="text-slate-700 hover:text-white font-medium text-[10px] bg-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition" title="طباعة">🖨️</button>}</div></td></tr>); })}{paginated.length === 0 && <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400">لا توجد نتائج</td></tr>}</tbody></table>
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />}
      </div>

      {alertEmployees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2"><span className="text-lg">⚠️</span><h3 className="font-bold text-amber-800 text-sm">تنبيه: موظفون بحاجة لمراجعة الإدارة</h3><span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{alertEmployees.length}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-700">صفحة {alertPage} من {alertTotalPages}</span>
              {perms.canPrint && (
                <button onClick={() => { printSummaryTable([], alertEmployees, (e: any) => getMissingFields(e).length); addLog(session, "print_summary", `طباعة قائمة النواقص (${alertEmployees.length})`); }} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm transition">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  طباعة النواقص
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-amber-200 text-amber-700"><th className="text-right px-2 py-1">الرقم الوطني</th><th className="text-right px-2 py-1">الاسم</th><th className="text-right px-2 py-1">النواقص</th><th className="text-right px-2 py-1">الملاحظات</th><th className="text-right px-2 py-1">الإجراء</th></tr></thead><tbody>{alertPaginated.map((emp, i) => (<tr key={i} className="border-b border-amber-100 hover:bg-amber-100/50 cursor-pointer" onClick={() => handleView(emp)}><td className="px-2 py-1.5 font-mono text-amber-900" dir="ltr">{emp.nationalNumber}</td><td className="px-2 py-1.5 font-medium text-amber-900">{emp.fullName}</td><td className="px-2 py-1.5"><span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">{getMissingFields(emp).length}</span></td><td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.notes}</td><td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.requiredAction}</td></tr>))}</tbody></table></div>
          {alertTotalPages > 1 && (<div className="mt-3 flex items-center justify-center gap-1"><PageBtn onClick={() => setAlertPage(1)} disabled={alertPage === 1}>⟪</PageBtn><PageBtn onClick={() => setAlertPage(Math.max(1, alertPage - 1))} disabled={alertPage === 1}>السابق</PageBtn><span className="px-3 text-xs text-amber-800 font-bold">{alertPage} / {alertTotalPages}</span><PageBtn onClick={() => setAlertPage(Math.min(alertTotalPages, alertPage + 1))} disabled={alertPage === alertTotalPages}>التالي</PageBtn><PageBtn onClick={() => setAlertPage(alertTotalPages)} disabled={alertPage === alertTotalPages}>⟫</PageBtn></div>)}
        </div>
      )}

      {selectedEmployee && <EmployeeDetailModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onPrint={() => handlePrintIndividual(selectedEmployee)} onEdit={() => handleEdit(selectedEmployee)} onDelete={() => handleDeleteEmployee(selectedEmployee)} canEdit={perms.canEdit} canDelete={perms.canRequestDelete} canPrint={perms.canPrint} customFields={customFields} />}
      {editingEmployee && <EmployeeEditModal employee={editingEmployee} customFields={customFields} onClose={() => setEditingEmployee(null)} onSave={(overrides) => handleSaveEdit(editingEmployee.nationalNumber, overrides, editingEmployee.fullName)} />}
      {showAddEmployee && <AddEmployeeModal customFields={customFields} onClose={() => setShowAddEmployee(false)} onSave={handleAddEmployee} />}
      {deleteRequestEmp && <DeleteRequestModal employee={deleteRequestEmp} session={session} onClose={() => setDeleteRequestEmp(null)} onSuccess={() => setDeleteRequestEmp(null)} />}
    </div>
  );
}

function DeleteRequestModal({ employee, session, onClose, onSuccess }: { employee: any; session: Session; onClose: () => void; onSuccess: () => void }) {
  const DELETE_REASONS = ["نقل لجهة أخرى", "استقالة", "تقاعد", "وفاة", "فصل", "انتهاء عقد", "أخرى"];
  const [reason, setReason] = useState(DELETE_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    const finalReason = reason === "أخرى" ? otherReason.trim() : reason;
    if (!finalReason) { setError("يرجى اختيار أو كتابة سبب الحذف"); return; }
    if (!docNumber.trim()) { setError("يرجى إدخال رقم القرار أو المستند"); return; }
    if (!docDate) { setError("يرجى إدخال تاريخ القرار"); return; }
    setSubmitting(true);
    try {
      const ok = await requestEmployeeDelete({
        nationalNumber: employee.nationalNumber,
        employeeName: employee.fullName,
        reason: finalReason,
        docNumber, docDate,
        submittedBy: session.fullName,
      });
      if (ok) {
        addLog(session, "delete_user", `طلب حذف موظف: ${employee.fullName} (${employee.nationalNumber}) - السبب: ${finalReason}`);
        window.dispatchEvent(new Event("delete-requests-changed"));
        alert("✅ تم تقديم طلب الحذف بنجاح. سيتم مراجعته من قبل المدير العام.");
        onSuccess();
      } else {
        setError("فشل الاتصال. حاول مرة أخرى.");
      }
    } catch { setError("فشل الاتصال. حاول مرة أخرى."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-50 border-b border-red-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗑️</span>
            <div>
              <h3 className="font-bold text-red-800">طلب حذف موظف</h3>
              <p className="text-xs text-red-600">سيتم إرسال الطلب للمدير العام للموافقة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500">الموظف</p>
            <p className="font-bold text-slate-800">{employee.fullName}</p>
            <p className="text-xs text-slate-500 font-mono mt-1" dir="ltr">{employee.nationalNumber}</p>
          </div>

          <div>
            <label className="text-xs text-slate-600 font-medium mb-1 block">سبب الحذف <span className="text-red-500">*</span></label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none">
              {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {reason === "أخرى" && (
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">اكتب السبب <span className="text-red-500">*</span></label>
              <textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="اكتب سبب الحذف..." />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">رقم القرار/المستند <span className="text-red-500">*</span></label>
              <input type="text" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" placeholder="مثال: 123/2026" />
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">تاريخ القرار <span className="text-red-500">*</span></label>
              <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none" />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 text-center">{error}</div>}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
            ⚠️ تنبيه: الموظف لن يُحذف فوراً. سيتم إرسال طلبك للمدير العام للموافقة، ثم سيُنقل إلى أرشيف الموظفين (لا حذف نهائي).
          </div>
        </div>
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} disabled={submitting} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "⏳ جاري الإرسال..." : "📤 إرسال الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeDetailModal({ employee, onClose, onPrint, onEdit, onDelete, canEdit, canDelete, canPrint, customFields }: { employee: any; onClose: () => void; onPrint: () => void; onEdit: () => void; onDelete: () => void; canEdit: boolean; canDelete: boolean; canPrint: boolean; customFields: CustomField[] }) {
  const missing = getMissingFields(employee);
  const total = Object.keys(ALL_FIELD_LABELS).length;
  const filled = total - missing.length;
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10"><div><h2 className="text-lg font-bold text-slate-900">{employee.fullName}</h2><p className="text-xs text-slate-500 font-mono" dir="ltr">#{employee.nationalNumber}</p></div><div className="flex items-center gap-2">{canDelete && <button onClick={onDelete} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium flex items-center gap-1">🗑️ طلب حذف</button>}{canEdit && <button onClick={onEdit} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium flex items-center gap-1">✏️ تعديل</button>}{canPrint && <button onClick={onPrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1">🖨️ طباعة</button>}{employee.phone && missing.length > 0 && (<button onClick={() => sendMissingFieldsViaWhatsApp(employee.phone, employee.fullName, missing)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1">💬 واتساب النواقص</button>)}{employee.phone && (<button onClick={() => openWhatsApp(employee.phone, "")} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-1">📱 واتساب</button>)}<button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div><div className="p-6 space-y-4"><div className="flex flex-wrap gap-2"><span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(employee.status)}`}>الحالة: {employee.status || "-"}</span><span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getDataCompleteBadge(employee.dataComplete)}`}>البيانات: {employee.dataComplete || "-"}</span><span className="inline-flex px-3 py-1 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">{employee.gender || "-"}</span></div><div className="bg-slate-50 rounded-xl p-3 border border-slate-200"><div className="flex items-center justify-between mb-1.5"><span className="text-xs font-bold text-slate-700">نسبة اكتمال البيانات</span><span className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>{pct}% ({filled}/{total})</span></div><div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} /></div></div>{missing.length > 0 ? (<div className="bg-red-50 border border-red-200 rounded-xl p-4"><div className="flex items-center gap-2 mb-2"><span className="text-lg">⚠️</span><h3 className="font-bold text-red-800 text-sm">نواقص البيانات ({missing.length} من {total})</h3></div><div className="flex flex-wrap gap-1.5">{missing.map((m, i) => (<span key={i} className="bg-white text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-red-300 flex items-center gap-1"><span className="text-red-500">✗</span>{m}</span>))}</div></div>) : (<div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div className="flex items-center gap-2"><span className="text-lg">✅</span><span className="font-bold text-emerald-800 text-sm">جميع البيانات مكتملة</span></div></div>)}<DetailSection title="البيانات الأساسية"><DF label="الاسم رباعي" value={employee.fullName} required /><DF label="الرقم الوطني" value={employee.nationalNumber} mono required /><DF label="الرقم الوظيفي" value={employee.jobNumber} mono required /><DF label="الحالة الوظيفية" value={employee.jobStatus} /><DF label="نوع التوظيف" value={employee.employmentType} /><DF label="الجنس" value={employee.gender} /></DetailSection><DetailSection title="البيانات الأكاديمية والوظيفية"><DF label="الدرجة الوظيفية" value={employee.jobGrade} required /><DF label="المؤهل العلمي" value={employee.qualification} required /><DF label="التخصص" value={employee.specialization} required /><DF label="التقدير" value={employee.grade} required /><DF label="أصل المؤهل / مكان الحصول" value={employee.qualificationOrigin} required full /></DetailSection><DetailSection title="البيانات الإدارية والمالية"><DF label="اسم المصرف" value={employee.bankName} required /><DF label="رقم الحساب (IBAN)" value={employee.iban} mono required full /><DF label="يتقاضى معاش" value={employee.receivesPension} /><DF label="رقم قرار التعيين" value={employee.appointmentDecision} mono required /><DF label="تاريخ المباشرة" value={employee.startDate} required /><DF label="آخر ترقية" value={employee.promotionDate} required /></DetailSection><DetailSection title="بيانات الاتصال والتنظيم"><DF label="الإدارة" value={employee.department} required /><DF label="القسم" value={employee.section} required /><DF label="رقم الهاتف" value={employee.phone} mono required /></DetailSection>{customFields.length > 0 && (<DetailSection title="بيانات إضافية (مخصصة)">{customFields.map((cf) => <DF key={cf.id} label={cf.label} value={employee[cf.label] || employee[cf.key] || ""} />)}</DetailSection>)}<DetailSection title="ملاحظات وإجراءات"><DF label="ملاحظات" value={employee.notes} full /><DF label="الإجراء المطلوب" value={employee.requiredAction} full /></DetailSection></div></div></div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return (<div><div className="bg-indigo-600 text-white px-3 py-1.5 rounded-t-lg text-xs font-bold">{title}</div><div className="border border-indigo-200 border-t-0 rounded-b-lg p-3 grid grid-cols-2 gap-3 bg-white">{children}</div></div>); }
function DF({ label, value, mono, required, full }: { label: string; value: string; mono?: boolean; required?: boolean; full?: boolean }) { const empty = isEmpty(value); return (<div className={full ? "col-span-2" : ""}><p className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">{label}{required && empty && <span className="text-red-500">*</span>}</p><p className={`text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`} dir={mono && !empty ? "ltr" : undefined}>{empty ? "— فارغ" : value}</p></div>); }

function AddEmployeeModal({ customFields, onClose, onSave }: { customFields: CustomField[]; onClose: () => void; onSave: (emp: any) => void }) {
  const [values, setValues] = useState<Record<string, string>>({ fullName: "", nationalNumber: "", jobNumber: "", bankName: "", iban: "", jobGrade: "", qualification: "", specialization: "", status: "تحت الاجراء", dataComplete: "غير مكتملة" });
  const handleSave = () => { if (!values.fullName.trim()) { alert("يرجى إدخال الاسم رباعي"); return; } if (values.nationalNumber.length !== 12) { alert("يرجى إدخال الرقم الوطني (12 رقماً بالضبط)"); return; } onSave(values); };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-center justify-between z-10"><div className="flex items-center gap-2"><span className="text-xl">👤+</span><h2 className="text-lg font-bold text-slate-900">إضافة موظف جديد لملف الإكسل</h2></div><button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-xl">✕</button></div><div className="p-6 space-y-4"><div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"><p className="text-xs font-bold text-emerald-800 mb-3">🔴 الحقول الأساسية (مطلوبة)</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label className="text-xs text-slate-600 mb-1 block font-medium">الاسم رباعي <span className="text-red-500">*</span></label><input type="text" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="الاسم الكامل" /></div><div><label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني <span className="text-red-500">*</span></label><input type="text" value={values.nationalNumber} onChange={(e) => setValues({ ...values, nationalNumber: e.target.value.replace(/[^\d]/g, "").slice(0, 12) })} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-emerald-500 outline-none" dir="ltr" placeholder="12 رقماً" maxLength={12} inputMode="numeric" /><div className="mt-1 text-left text-[10px]" dir="ltr"><span className={values.nationalNumber.length === 12 ? "text-emerald-600 font-bold" : "text-slate-400"}>{values.nationalNumber.length}/12</span></div></div></div></div><p className="text-xs font-bold text-slate-600">باقي البيانات (اختيارية)</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{EDITABLE_FIELDS.filter((f) => f.key !== "fullName").map((f) => (<div key={f.key}><label className="text-xs text-slate-500 mb-1 block">{f.label}</label><input type="text" value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" dir={f.mono ? "ltr" : undefined} /></div>))}{customFields.length > 0 && customFields.map((cf) => (<div key={cf.id}><label className="text-xs text-slate-500 mb-1 block">{cf.label}</label><input type="text" value={values[cf.key] || ""} onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" /></div>))}</div></div><div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button><button onClick={handleSave} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">➕ إضافة الموظف</button></div></div></div>
  );
}

function EmployeeEditModal({ employee, customFields, onClose, onSave }: { employee: any; customFields: CustomField[]; onClose: () => void; onSave: (o: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => { const v: Record<string, string> = {}; EDITABLE_FIELDS.forEach((f) => { v[f.key] = employee[f.key] || ""; }); customFields.forEach((cf: any) => { v[cf.key] = employee[cf.label] || employee[cf.key] || ""; }); return v; });
  const handleSave = () => { const toSave: Record<string, string> = {}; Object.entries(values).forEach(([k, v]) => { if (v !== undefined) toSave[k] = v; }); onSave(toSave); };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}><div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between z-10"><div className="flex items-center gap-2"><span className="text-xl">✏️</span><div><h2 className="text-lg font-bold text-slate-900">تعديل بيانات الموظف</h2><p className="text-xs text-slate-500 font-mono" dir="ltr">{employee.fullName} • #{employee.nationalNumber}</p></div></div><button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-xl"><svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div><div className="p-6 space-y-4"><div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">⚠️ تنبيه: سيتم تحديث البيانات مباشرة في ملف Google Sheets الأصلي. يرجى التأكد من دقة المعلومات المدخلة.</div><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{EDITABLE_FIELDS.map((f) => (<div key={f.key}><label className="text-xs text-slate-500 mb-1 block">{f.label}</label><input type="text" value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" dir={f.mono ? "ltr" : undefined} /></div>))}{customFields.length > 0 && (<div className="col-span-2 pt-3 border-t border-slate-200"><p className="text-xs font-bold text-slate-700 mb-2">📝 الحقول المخصصة</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{customFields.map((cf: any) => (<div key={cf.id}><label className="text-xs text-slate-500 mb-1 block">{cf.label}</label><input type="text" value={values[cf.key] || ""} onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" /></div>))}</div></div>)}</div></div><div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button><button onClick={handleSave} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">💾 حفظ التعديلات</button></div></div></div>
  );
}
