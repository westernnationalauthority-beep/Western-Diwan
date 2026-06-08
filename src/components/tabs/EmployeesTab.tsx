// ============================================================
// EmployeesTab.tsx - تبويب الموظفين الكامل
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Employee, fetchEmployeesFromSheet, updateEmployeeInSheet, addEmployeeToSheet, clearEmployeesCache, getCacheAge } from "../../data/employees";
import { type Session, type CustomField, addLog, getCustomFields, mergeAllEmployees, filterByUserDepartments, isUserRestricted } from "../../lib/storage";
import { getMissingFields, syncCustomFieldsFromSheet, exportCSV, sendMissingFieldsViaWhatsApp, openWhatsApp } from "../../utils";
import { printIndividualForm, printAllForms, printSummaryTable, printAlertTable } from "../../utils/print";
import { ALL_FIELD_LABELS } from "../../constants";
import { isEmpty } from "../../utils";
import {
  StatCard, Th, SortIcon, Pagination,
  getStatusBadge, getDataCompleteBadge,
  LoadingSpinner, ErrorCard,
} from "../ui";

// ──────────────────────────────────────────────
// الحقول القابلة للتعديل
// ──────────────────────────────────────────────
const EDITABLE_FIELDS: { key: string; label: string; mono?: boolean }[] = [
  { key: "fullName",             label: "الاسم رباعي" },
  { key: "jobNumber",            label: "الرقم الوظيفي",             mono: true },
  { key: "jobGrade",             label: "الدرجة الوظيفية" },
  { key: "qualification",        label: "المؤهل العلمي" },
  { key: "specialization",       label: "التخصص" },
  { key: "grade",                label: "التقدير" },
  { key: "qualificationOrigin",  label: "أصل المؤهل / مكان الحصول" },
  { key: "bankName",             label: "المصرف" },
  { key: "iban",                 label: "رقم الحساب (IBAN)",          mono: true },
  { key: "receivesPension",      label: "يتقاضى معاش" },
  { key: "appointmentDecision",  label: "رقم قرار التعيين",           mono: true },
  { key: "startDate",            label: "تاريخ المباشرة" },
  { key: "promotionDate",        label: "آخر ترقية" },
  { key: "phone",                label: "رقم الهاتف",                 mono: true },
  { key: "department",           label: "الإدارة" },
  { key: "section",              label: "القسم" },
  { key: "jobStatus",            label: "الحالة الوظيفية" },
  { key: "employmentType",       label: "نوع التوظيف" },
  { key: "gender",               label: "الجنس" },
  { key: "status",               label: "الحالة" },
  { key: "dataComplete",         label: "اكتمال البيانات" },
  { key: "notes",                label: "ملاحظات" },
  { key: "requiredAction",       label: "الإجراء المطلوب" },
];

// ──────────────────────────────────────────────
// EmployeesTab الرئيسي
// ──────────────────────────────────────────────
export function EmployeesTab({ session }: { session: Session }) {
  const [employeesRaw, setEmployeesRaw] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataTimestamp, setDataTimestamp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchBy, setSearchBy] = useState<"nationalNumber" | "fullName" | "all">("nationalNumber");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [dataCompleteFilter, setDataCompleteFilter] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState("");
  const [hasJobNumberFilter, setHasJobNumberFilter] = useState("");
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteRequestEmp, setDeleteRequestEmp] = useState<Employee | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const ROWS_PER_PAGE = 15;
  const ALERT_PER_PAGE = 10;
  const perms = session.permissions;
  const customFields = getCustomFields();

  // ── تحميل البيانات ──
  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError("");
    try {
      if (forceRefresh) clearEmployeesCache();
      const data = await fetchEmployeesFromSheet(forceRefresh);
      syncCustomFieldsFromSheet(data);
      setEmployeesRaw(data);
      setDataTimestamp(new Date().toLocaleString("ar-LY"));
      addLog(session, "refresh_data", `تحميل ${data.length} موظف`);
    } catch {
      setError("فشل في تحميل البيانات من Google Sheets");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  // الاستماع لحذف موظف
  useEffect(() => {
    const handleRemove = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const removedNN = (detail?.nationalNumber || "").toString().replace(/[^\d]/g, "").trim();
      if (removedNN) {
        setEmployeesRaw((prev) => prev.filter((emp) => emp.nationalNumber !== removedNN));
      }
    };
    window.addEventListener("employee-removed", handleRemove);
    return () => window.removeEventListener("employee-removed", handleRemove);
  }, []);

  // ── دمج التعديلات المحلية + فلترة الأقسام ──
  const employees = useMemo(() => {
    const merged = mergeAllEmployees(employeesRaw);
    return filterByUserDepartments(merged, session);
  }, [employeesRaw, session]);

  // ── القوائم المتسلسلة الذكية ──
  const allBranches = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.branch).filter(Boolean))).sort()
  , [employees]);

  const availableDepartments = useMemo(() => {
    const base = branchFilter ? employees.filter((e) => e.branch === branchFilter) : employees;
    return Array.from(new Set(base.map((e) => e.department).filter(Boolean))).sort();
  }, [employees, branchFilter]);

  const availableSections = useMemo(() => {
    let base = employees;
    if (branchFilter) base = base.filter((e) => e.branch === branchFilter);
    if (departmentFilter) base = base.filter((e) => e.department === departmentFilter);
    return Array.from(new Set(base.map((e) => e.section).filter(Boolean))).sort();
  }, [employees, branchFilter, departmentFilter]);

  // ── القيم الديناميكية للفلاتر من البيانات الفعلية ──
  const allStatuses = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.status).filter(Boolean))).sort()
  , [employees]);

  const allGenders = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.gender).filter(Boolean))).sort()
  , [employees]);

  const allDataComplete = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.dataComplete).filter(Boolean))).sort()
  , [employees]);
  const allQualifications = useMemo(() =>
    Array.from(new Set(employees.map((e) => e.qualification).filter(Boolean))).sort()
  , [employees]);

  const filtered = useMemo(() => {
    let result = [...employees];
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter((emp) => {
        if (searchBy === "nationalNumber") return emp.nationalNumber.includes(term);
        if (searchBy === "fullName") return emp.fullName.toLowerCase().includes(term);
        return (
          emp.nationalNumber.includes(term) ||
          emp.fullName.toLowerCase().includes(term) ||
          emp.jobNumber.includes(term) ||
          (emp.phone || "").includes(term) ||
          (emp.branch || "").toLowerCase().includes(term) ||
          (emp.department || "").toLowerCase().includes(term) ||
          (emp.bankName || "").toLowerCase().includes(term)
        );
      });
    }
    if (branchFilter) result = result.filter((e) => e.branch === branchFilter);
    if (departmentFilter) result = result.filter((e) => e.department === departmentFilter);
    if (sectionFilter) result = result.filter((e) => e.section === sectionFilter);
    if (statusFilter) result = result.filter((e) => e.status === statusFilter);
    if (genderFilter) result = result.filter((e) => e.gender === genderFilter);
    if (dataCompleteFilter) result = result.filter((e) => e.dataComplete === dataCompleteFilter);
    if (qualificationFilter) result = result.filter((e) => e.qualification === qualificationFilter);
    if (hasJobNumberFilter === "yes") result = result.filter((e) => e.jobNumber?.trim());
    if (hasJobNumberFilter === "no") result = result.filter((e) => !e.jobNumber?.trim());
    if (startDateFrom) result = result.filter((e) => e.jobStatus === startDateFrom);
    if (sortKey) {
      result.sort((a, b) => {
        const va = (a as Record<string, string>)[sortKey] || "";
        const vb = (b as Record<string, string>)[sortKey] || "";
        return sortDir === "asc"
          ? String(va).localeCompare(String(vb), "ar")
          : String(vb).localeCompare(String(va), "ar");
      });
    }
    return result;
  }, [employees, searchTerm, searchBy, branchFilter, departmentFilter, sectionFilter,
      statusFilter, genderFilter, dataCompleteFilter, qualificationFilter,
      hasJobNumberFilter, startDateFrom, startDateTo, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  const alertEmployees = useMemo(() => employees.filter((e) => e.status === "ناقص"), [employees]);
  const alertTotalPages = Math.ceil(alertEmployees.length / ALERT_PER_PAGE);
  const alertPaginated = alertEmployees.slice((alertPage - 1) * ALERT_PER_PAGE, alertPage * ALERT_PER_PAGE);

  // ── الإحصائيات ──
  const stats = useMemo(() => ({
    total:         employees.length,
    complete:      employees.filter((e) => e.dataComplete === "نعم مكتملة").length,
    incomplete:    employees.filter((e) => e.dataComplete === "غير مكتملة").length,
    underProcess:  employees.filter((e) => e.status === "تحت الاجراء").length,
    completeStatus:employees.filter((e) => e.status === "مستوفي").length,
    missing:       employees.filter((e) => e.status === "ناقص").length,
    male:          employees.filter((e) => e.gender === "ذكر").length,
    female:        employees.filter((e) => e.gender === "أنثى").length,
    hasJobNumber:  employees.filter((e) => e.jobNumber?.trim()).length,
    noJobNumber:   employees.filter((e) => !e.jobNumber?.trim()).length,
  }), [employees]);

  // ── handlers ──
  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm(""); setBranchFilter(""); setDepartmentFilter("");
    setSectionFilter(""); setStatusFilter(""); setGenderFilter("");
    setDataCompleteFilter(""); setQualificationFilter("");
    setHasJobNumberFilter(""); setStartDateFrom(""); setStartDateTo("");
    setSortKey(""); setSortDir("asc"); setCurrentPage(1);
  };

  useEffect(() => {
    if (searchTerm.trim().length >= 3)
      addLog(session, "search", `بحث: "${searchTerm.trim()}" بواسطة ${searchBy}`);
  }, [searchTerm]); // eslint-disable-line

  const handleView = (emp: Employee) => {
    setSelectedEmployee(emp);
    addLog(session, "view_employee", `عرض: ${emp.fullName} (${emp.nationalNumber})`);
  };

  const handleEdit = (emp: Employee) => {
    if (!perms.canEdit) { alert("ليس لديك صلاحية التعديل"); return; }
    setEditingEmployee(emp);
    setSelectedEmployee(null);
    addLog(session, "edit_employee", `فتح تعديل: ${emp.fullName} (${emp.nationalNumber})`);
  };

  const handleSaveEdit = async (nn: string, overrides: Record<string, string>, name: string) => {
    const sheetUpdates: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in overrides) {
      const cf = cfs.find((c) => c.key === key);
      sheetUpdates[cf ? cf.label : key] = overrides[key];
    }
    const ok = await updateEmployeeInSheet(nn, sheetUpdates);
    if (ok) {
      addLog(session, "save_employee", `تحديث: ${name} (${nn})`);
      alert("✅ تم الحفظ بنجاح. ستظهر التغييرات خلال لحظات.");
      setTimeout(() => loadData(), 3500);
    } else {
      alert("❌ فشل الاتصال.");
    }
    setEditingEmployee(null);
  };

  const handleDeleteEmployee = (emp: Employee) => {
    if (!perms.canRequestDelete) { alert("ليس لديك صلاحية طلب حذف موظف"); return; }
    setSelectedEmployee(null);
    setDeleteRequestEmp(emp);
  };

  const handleAddEmployee = async (employee: Record<string, string>) => {
    const nn = (employee.nationalNumber || "").replace(/[^\d]/g, "").trim();
    if (nn && employees.some((e) => e.nationalNumber === nn)) {
      alert("❌ الرقم الوطني موجود مسبقاً.");
      return;
    }
    const sheetEmployee: Record<string, string> = {};
    const cfs = getCustomFields();
    for (const key in employee) {
      const cf = cfs.find((c) => c.key === key);
      sheetEmployee[cf ? cf.label : key] = employee[key];
    }
    const result = await addEmployeeToSheet(sheetEmployee);
    if (result) {
      addLog(session, "create_user", `إضافة موظف: ${employee.fullName} (${employee.nationalNumber})`);
      alert("✅ تمت الإضافة بنجاح!");
      setTimeout(() => loadData(), 3500);
    } else {
      alert("❌ فشل الاتصال.");
    }
    setShowAddEmployee(false);
  };

  const handlePrintIndividual = (emp: Employee) => {
    if (!perms.canPrint) { alert("ليس لديك صلاحية الطباعة"); return; }
    printIndividualForm(emp);
    addLog(session, "print_employee", `طباعة: ${emp.fullName} (${emp.nationalNumber})`);
  };

  const handlePrintAll = (data: Employee[], label: string) => {
    if (!perms.canPrint) return;
    printAllForms(data);
    addLog(session, "print_all", `طباعة ${data.length} نموذج - ${label}`);
    setShowExportMenu(false);
  };

  const handlePrintSummary = (data: Employee[], label: string) => {
    if (!perms.canPrint) return;
    printSummaryTable(data);
    addLog(session, "print_summary", `طباعة ملخص ${data.length} - ${label}`);
    setShowExportMenu(false);
  };

  const handlePrintAlerts = () => {
    if (!perms.canPrint) return;
    printAlertTable(alertEmployees);
    addLog(session, "print_summary", `طباعة تنبيهات ${alertEmployees.length} موظف`);
    setShowExportMenu(false);
  };

  const handleExportCSV = (data: Employee[], filename: string, label: string) => {
    if (!perms.canExport) return;
    exportCSV(data, filename);
    addLog(session, "export_csv", `تصدير ${data.length} - ${label}`);
    setShowExportMenu(false);
  };

  // ── render ──
  if (loading) return <LoadingSpinner />;
  if (error && employees.length === 0) return <ErrorCard message={error} onRetry={loadData} />;

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">قاعدة بيانات الموظفين</h2>
          {isUserRestricted(session) && (
            <div className="flex flex-wrap gap-1">
              {(session.allowedDepartments || []).map((dep) => (
                <span key={dep} className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {dep}
                </span>
              ))}
            </div>
          )}
          {perms.canEdit && (
            <button onClick={() => setShowAddEmployee(true)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-medium transition flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              إضافة موظف
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dataTimestamp && <span className="text-[10px] text-slate-400 hidden sm:block">آخر تحديث: {dataTimestamp} {getCacheAge() ? `(كاش: ${getCacheAge()})` : ""}</span>}
          <button onClick={() => loadData(false)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تحديث من الكاش">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={() => loadData(true)} className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg" title="تحديث إجباري من Sheets">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* قائمة التصدير */}
          {(perms.canPrint || perms.canExport) && (
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                تصدير / طباعة
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 min-w-[230px]">
                    {perms.canExport && (
                      <>
                        <ExportBtn onClick={() => handleExportCSV(employees, "موظفي_ديوان_الغربية_كامل", "كل البيانات")} icon="📄">تصدير CSV (كامل)</ExportBtn>
                        <ExportBtn onClick={() => handleExportCSV(filtered, "موظفي_ديوان_الغربية_تصفية", "التصفية")} icon="🔍">تصدير CSV (التصفية)</ExportBtn>
                        <div className="border-t border-slate-100 my-1" />
                      </>
                    )}
                    {perms.canPrint && (
                      <>
                        <ExportBtn onClick={() => handlePrintAll(filtered, "التصفية")} icon="📝">طباعة النماذج (التصفية)</ExportBtn>
                        <ExportBtn onClick={() => handlePrintSummary(paginated, "الصفحة")} icon="📋">طباعة (الصفحة الحالية)</ExportBtn>
                        <ExportBtn onClick={() => handlePrintAll(employees, "الكل")} icon="📚">طباعة النماذج (الكل)</ExportBtn>
                        <ExportBtn onClick={() => handlePrintSummary(filtered, "ملخص")} icon="📊">طباعة ملخص (جدول)</ExportBtn>
                        <ExportBtn onClick={() => handlePrintAlerts()} icon="⚠️">طباعة تنبيهات الناقصين ({alertEmployees.length})</ExportBtn>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <span className="text-xs bg-slate-100 rounded-lg px-2.5 py-1 font-medium text-slate-600">{employees.length}</span>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-2">
        <StatCard label="الإجمالي"      value={stats.total}          color="slate"   icon="👥" />
        <StatCard label="مكتملة"        value={stats.complete}        color="emerald" icon="✅" />
        <StatCard label="غير مكتملة"   value={stats.incomplete}      color="red"     icon="⚠️" />
        <StatCard label="تحت الإجراء"  value={stats.underProcess}    color="blue"    icon="⏳" />
        <StatCard label="مستوفي"        value={stats.completeStatus}  color="emerald" icon="✔️" />
        <StatCard label="ناقص"          value={stats.missing}         color="amber"   icon="📋" />
        <StatCard label="ذكور"          value={stats.male}            color="indigo"  icon="👨" />
        <StatCard label="إناث"          value={stats.female}          color="pink"    icon="👩" />
        <StatCard label="برقم وظيفي"   value={stats.hasJobNumber}    color="cyan"    icon="🆔" />
        <StatCard label="بدون رقم"      value={stats.noJobNumber}     color="orange"  icon="❓" />
      </div>

      {/* أدوات البحث والفلترة */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* الصف الأول: البحث النصي */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input type="text" placeholder="ابحث..." value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pr-9 pl-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <select value={searchBy} onChange={(e) => { setSearchBy(e.target.value as "nationalNumber" | "fullName" | "all"); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="nationalNumber">الرقم الوطني</option>
            <option value="fullName">الاسم</option>
            <option value="all">جميع الحقول</option>
          </select>
        </div>

        {/* الصف الثاني: الفلترة المتسلسلة الذكية */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* الفرع */}
          {allBranches.length > 0 && (
            <select value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setDepartmentFilter(""); setSectionFilter(""); setCurrentPage(1); }}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
              <option value="">🏢 كل الفروع</option>
              {allBranches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* الإدارة — تتغير حسب الفرع */}
          <select value={departmentFilter}
            onChange={(e) => { setDepartmentFilter(e.target.value); setSectionFilter(""); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">🏛️ كل الإدارات</option>
            {availableDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* القسم — يتغير حسب الإدارة */}
          <select value={sectionFilter}
            onChange={(e) => { setSectionFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">📂 كل الأقسام</option>
            {availableSections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* فلاتر أساسية */}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">الحالة</option>
            {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={dataCompleteFilter} onChange={(e) => { setDataCompleteFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">البيانات</option>
            {allDataComplete.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={genderFilter} onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white">
            <option value="">الجنس</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
            {allGenders.filter((g) => g !== "ذكر" && g !== "أنثى").map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* زر الفلاتر المتقدمة */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 border rounded-xl text-xs font-medium transition flex items-center gap-1 ${
              showAdvanced || qualificationFilter || hasJobNumberFilter || startDateFrom || startDateTo
                ? "bg-violet-100 text-violet-700 border-violet-300"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}>
            ⚙️ فلاتر متقدمة
            {(qualificationFilter || hasJobNumberFilter || startDateFrom || startDateTo) && (
              <span className="bg-violet-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">
                {[qualificationFilter, hasJobNumberFilter, startDateFrom || startDateTo].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* زر مسح الكل */}
          {(searchTerm || branchFilter || departmentFilter || sectionFilter || statusFilter || genderFilter || dataCompleteFilter || qualificationFilter || hasJobNumberFilter || startDateFrom || startDateTo) && (
            <button onClick={clearFilters}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-medium hover:bg-red-100">
              ✕ مسح الكل
            </button>
          )}
        </div>

        {/* الفلاتر المتقدمة */}
        {showAdvanced && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">المؤهل:</span>
              <select value={qualificationFilter} onChange={(e) => { setQualificationFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="">الكل</option>
                {allQualifications.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">الرقم الوظيفي:</span>
              <select value={hasJobNumberFilter} onChange={(e) => { setHasJobNumberFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="">الكل</option>
                <option value="yes">لديه رقم وظيفي</option>
                <option value="no">بدون رقم وظيفي</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">الحالة الوظيفية:</span>
              <select value={startDateFrom} onChange={(e) => { setStartDateFrom(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                <option value="">الكل</option>
                {Array.from(new Set(employees.map((e) => e.jobStatus).filter(Boolean))).sort().map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* شارات الفلاتر النشطة */}
        {(branchFilter || departmentFilter || sectionFilter) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {branchFilter && (
              <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                🏢 {branchFilter}
                <button onClick={() => { setBranchFilter(""); setDepartmentFilter(""); setSectionFilter(""); }} className="hover:text-indigo-900">✕</button>
              </span>
            )}
            {departmentFilter && (
              <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                🏛️ {departmentFilter}
                <button onClick={() => { setDepartmentFilter(""); setSectionFilter(""); }} className="hover:text-emerald-900">✕</button>
              </span>
            )}
            {sectionFilter && (
              <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1">
                📂 {sectionFilter}
                <button onClick={() => setSectionFilter("")} className="hover:text-amber-900">✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        تم العثور على <span className="font-bold text-slate-700">{filtered.length}</span> موظف
        {filtered.length !== employees.length && (
          <span className="text-indigo-500 text-[10px] mr-1">(من {employees.length})</span>
        )}
      </p>

      {/* جدول الموظفين */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <Th onClick={() => handleSort("nationalNumber")}>الرقم الوطني <SortIcon column="nationalNumber" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("fullName")}>الاسم <SortIcon column="fullName" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("jobGrade")}>الدرجة <SortIcon column="jobGrade" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("qualification")}>المؤهل <SortIcon column="qualification" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("department")}>الإدارة <SortIcon column="department" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("status")}>الحالة <SortIcon column="status" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th onClick={() => handleSort("dataComplete")}>البيانات <SortIcon column="dataComplete" sortKey={sortKey} sortDir={sortDir} /></Th>
                <Th>النواقص</Th>
                <Th>إجراءات</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((emp, idx) => {
                const missingCount = getMissingFields(emp).length;
                return (
                  <tr key={emp.nationalNumber + "-" + idx}
                    className="hover:bg-indigo-50/50 cursor-pointer"
                    onClick={() => handleView(emp)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-indigo-700 whitespace-nowrap" dir="ltr">{emp.nationalNumber}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap max-w-[160px] truncate">{emp.fullName}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.jobGrade || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{emp.qualification || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{emp.department || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(emp.status)}`}>{emp.status || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${getDataCompleteBadge(emp.dataComplete)}`}>{emp.dataComplete || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      {missingCount > 0
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">{missingCount} ⚠️</span>
                        : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✓</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleView(emp); }}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-[10px] bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition">عرض</button>
                        {perms.canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(emp); }}
                            className="text-amber-700 hover:text-white hover:bg-amber-600 font-medium text-[10px] bg-amber-50 px-2 py-1 rounded border border-amber-200 transition">تعديل</button>
                        )}
                        {perms.canPrint && (
                          <button onClick={(e) => { e.stopPropagation(); handlePrintIndividual(emp); }}
                            className="text-slate-700 hover:text-white font-medium text-[10px] bg-slate-100 hover:bg-slate-700 px-2 py-1 rounded transition" title="طباعة">🖨️</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400">لا توجد نتائج</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />}
      </div>

      {/* تنبيهات الناقصين */}
      {alertEmployees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h3 className="font-bold text-amber-800 text-sm">تنبيه: موظفون بحاجة لمراجعة الإدارة</h3>
              <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{alertEmployees.length}</span>
            </div>
            <span className="text-[10px] text-amber-700">صفحة {alertPage} من {alertTotalPages}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-amber-200 text-amber-700">
                  <th className="text-right px-2 py-1">الرقم الوطني</th>
                  <th className="text-right px-2 py-1">الاسم</th>
                  <th className="text-right px-2 py-1">النواقص</th>
                  <th className="text-right px-2 py-1">الملاحظات</th>
                  <th className="text-right px-2 py-1">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {alertPaginated.map((emp, i) => (
                  <tr key={i} className="border-b border-amber-100 hover:bg-amber-100/50 cursor-pointer" onClick={() => handleView(emp)}>
                    <td className="px-2 py-1.5 font-mono text-amber-900" dir="ltr">{emp.nationalNumber}</td>
                    <td className="px-2 py-1.5 font-medium text-amber-900">{emp.fullName}</td>
                    <td className="px-2 py-1.5">
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">{getMissingFields(emp).length}</span>
                    </td>
                    <td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.notes}</td>
                    <td className="px-2 py-1.5 text-amber-700 max-w-[180px] truncate">{emp.requiredAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {alertTotalPages > 1 && (
            <Pagination currentPage={alertPage} totalPages={alertTotalPages} onChange={setAlertPage} />
          )}
        </div>
      )}

      {/* المودالات */}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          customFields={customFields}
          canEdit={perms.canEdit}
          canDelete={perms.canRequestDelete}
          canPrint={perms.canPrint}
          onClose={() => setSelectedEmployee(null)}
          onPrint={() => handlePrintIndividual(selectedEmployee)}
          onEdit={() => handleEdit(selectedEmployee)}
          onDelete={() => handleDeleteEmployee(selectedEmployee)}
        />
      )}
      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          customFields={customFields}
          onClose={() => setEditingEmployee(null)}
          onSave={(overrides) => handleSaveEdit(editingEmployee.nationalNumber, overrides, editingEmployee.fullName)}
        />
      )}
      {showAddEmployee && (
        <AddEmployeeModal
          customFields={customFields}
          onClose={() => setShowAddEmployee(false)}
          onSave={handleAddEmployee}
        />
      )}
      {deleteRequestEmp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="text-4xl">🗑️</div>
            <h3 className="font-bold text-slate-900">طلب حذف موظف</h3>
            <p className="text-sm text-slate-600">{deleteRequestEmp.fullName}</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteRequestEmp(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">إلغاء</button>
              <button onClick={() => setDeleteRequestEmp(null)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">تأكيد الطلب</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// مكوّن مساعد - زر في قائمة التصدير
// ──────────────────────────────────────────────
function ExportBtn({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon: string }) {
  return (
    <button onClick={onClick}
      className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 justify-end">
      <span>{children}</span><span>{icon}</span>
    </button>
  );
}

// ──────────────────────────────────────────────
// مودال عرض تفاصيل الموظف
// ──────────────────────────────────────────────
function EmployeeDetailModal({
  employee, customFields, canEdit, canDelete, canPrint, onClose, onPrint, onEdit, onDelete,
}: {
  employee: Employee; customFields: CustomField[];
  canEdit: boolean; canDelete: boolean; canPrint: boolean;
  onClose: () => void; onPrint: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const emp = employee as Record<string, string>;
  const missing = getMissingFields(employee);
  const total = Object.keys(ALL_FIELD_LABELS).length;
  const filled = total - missing.length;
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{emp.fullName}</h2>
            <p className="text-xs text-slate-500 font-mono" dir="ltr">#{emp.nationalNumber}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canDelete && <button onClick={onDelete} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium">🗑️ طلب حذف</button>}
            {canEdit && <button onClick={onEdit} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium">✏️ تعديل</button>}
            {canPrint && <button onClick={onPrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium">🖨️ طباعة</button>}
            {emp.phone && missing.length > 0 && (
              <button onClick={() => sendMissingFieldsViaWhatsApp(emp.phone, emp.fullName, missing)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">💬 واتساب النواقص</button>
            )}
            {emp.phone && (
              <button onClick={() => openWhatsApp(emp.phone, "")}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">📱 واتساب</button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
              <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* الشارات */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(emp.status)}`}>الحالة: {emp.status || "-"}</span>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getDataCompleteBadge(emp.dataComplete)}`}>البيانات: {emp.dataComplete || "-"}</span>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200">{emp.gender || "-"}</span>
          </div>

          {/* شريط الاكتمال */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700">نسبة اكتمال البيانات</span>
              <span className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600"}`}>{pct}% ({filled}/{total})</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* النواقص */}
          {missing.length > 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚠️</span>
                <h3 className="font-bold text-red-800 text-sm">نواقص البيانات ({missing.length} من {total})</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((m, i) => (
                  <span key={i} className="bg-white text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-red-300 flex items-center gap-1">
                    <span className="text-red-500">✗</span>{m}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2"><span className="text-lg">✅</span><span className="font-bold text-emerald-800 text-sm">جميع البيانات مكتملة</span></div>
            </div>
          )}

          {/* أقسام البيانات */}
          <DetailSection title="البيانات الأساسية">
            <DF label="الاسم رباعي" value={emp.fullName} required />
            <DF label="الرقم الوطني" value={emp.nationalNumber} mono required />
            <DF label="الرقم الوظيفي" value={emp.jobNumber} mono required />
            <DF label="الحالة الوظيفية" value={emp.jobStatus} />
            <DF label="نوع التوظيف" value={emp.employmentType} />
            <DF label="الجنس" value={emp.gender} />
          </DetailSection>
          <DetailSection title="البيانات الأكاديمية والوظيفية">
            <DF label="الدرجة الوظيفية" value={emp.jobGrade} required />
            <DF label="المؤهل العلمي" value={emp.qualification} required />
            <DF label="التخصص" value={emp.specialization} required />
            <DF label="التقدير" value={emp.grade} required />
            <DF label="أصل المؤهل / مكان الحصول" value={emp.qualificationOrigin} required full />
          </DetailSection>
          <DetailSection title="البيانات الإدارية والمالية">
            <DF label="اسم المصرف" value={emp.bankName} required />
            <DF label="رقم الحساب (IBAN)" value={emp.iban} mono required full />
            <DF label="يتقاضى معاش" value={emp.receivesPension} />
            <DF label="رقم قرار التعيين" value={emp.appointmentDecision} mono required />
            <DF label="تاريخ المباشرة" value={emp.startDate} required />
            <DF label="آخر ترقية" value={emp.promotionDate} required />
          </DetailSection>
          <DetailSection title="بيانات الاتصال والتنظيم">
            <DF label="الإدارة" value={emp.department} required />
            <DF label="القسم" value={emp.section} required />
            <DF label="رقم الهاتف" value={emp.phone} mono required />
          </DetailSection>
          {customFields.length > 0 && (
            <DetailSection title="بيانات إضافية (مخصصة)">
              {customFields.map((cf) => <DF key={cf.id} label={cf.label} value={emp[cf.label] || emp[cf.key] || ""} />)}
            </DetailSection>
          )}
          <DetailSection title="ملاحظات وإجراءات">
            <DF label="ملاحظات" value={emp.notes} full />
            <DF label="الإجراء المطلوب" value={emp.requiredAction} full />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-t-lg text-xs font-bold">{title}</div>
      <div className="border border-indigo-200 border-t-0 rounded-b-lg p-3 grid grid-cols-2 gap-3 bg-white">{children}</div>
    </div>
  );
}

function DF({ label, value, mono, required, full }: { label: string; value: string; mono?: boolean; required?: boolean; full?: boolean }) {
  const empty = isEmpty(value);
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">
        {label}{required && empty && <span className="text-red-500">*</span>}
      </p>
      <p className={`text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`}
        dir={mono && !empty ? "ltr" : undefined}>
        {empty ? "— فارغ" : value}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────
// مودال إضافة موظف
// ──────────────────────────────────────────────
function AddEmployeeModal({ customFields, onClose, onSave }: {
  customFields: CustomField[];
  onClose: () => void;
  onSave: (emp: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    fullName: "", nationalNumber: "", jobNumber: "", bankName: "", iban: "",
    jobGrade: "", qualification: "", specialization: "",
    status: "تحت الاجراء", dataComplete: "غير مكتملة",
  });

  const handleSave = () => {
    if (!values.fullName.trim()) { alert("يرجى إدخال الاسم رباعي"); return; }
    if (values.nationalNumber.length !== 12) { alert("يرجى إدخال الرقم الوطني (12 رقماً)"); return; }
    onSave(values);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">👤+</span>
            <h2 className="text-lg font-bold text-slate-900">إضافة موظف جديد</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-100 rounded-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-800 mb-3">🔴 الحقول الأساسية (مطلوبة)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block font-medium">الاسم رباعي <span className="text-red-500">*</span></label>
                <input type="text" value={values.fullName}
                  onChange={(e) => setValues({ ...values, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="الاسم الكامل" />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1 block font-medium">الرقم الوطني <span className="text-red-500">*</span></label>
                <input type="text" value={values.nationalNumber}
                  onChange={(e) => setValues({ ...values, nationalNumber: e.target.value.replace(/[^\d]/g, "").slice(0, 12) })}
                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-mono text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                  dir="ltr" placeholder="12 رقماً" maxLength={12} inputMode="numeric" />
                <div className="mt-1 text-left text-[10px]" dir="ltr">
                  <span className={values.nationalNumber.length === 12 ? "text-emerald-600 font-bold" : "text-slate-400"}>{values.nationalNumber.length}/12</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-600">باقي البيانات (اختيارية)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.filter((f) => f.key !== "fullName").map((f) => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input type="text" value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  dir={f.mono ? "ltr" : undefined} />
              </div>
            ))}
            {customFields.map((cf) => (
              <div key={cf.id}>
                <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
                <input type="text" value={values[cf.key] || ""}
                  onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={handleSave} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">➕ إضافة الموظف</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// مودال تعديل موظف
// ──────────────────────────────────────────────
function EmployeeEditModal({ employee, customFields, onClose, onSave }: {
  employee: Employee;
  customFields: CustomField[];
  onClose: () => void;
  onSave: (o: Record<string, string>) => void;
}) {
  const emp = employee as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    EDITABLE_FIELDS.forEach((f) => { v[f.key] = emp[f.key] || ""; });
    customFields.forEach((cf) => { v[cf.key] = emp[cf.label] || emp[cf.key] || ""; });
    return v;
  });

  const handleSave = () => {
    const toSave: Record<string, string> = {};
    Object.entries(values).forEach(([k, v]) => { if (v !== undefined) toSave[k] = v; });
    onSave(toSave);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">تعديل بيانات الموظف</h2>
              <p className="text-xs text-slate-500 font-mono" dir="ltr">{emp.fullName} • #{emp.nationalNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-xl">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚠️ سيتم تحديث البيانات مباشرة في ملف Google Sheets. يرجى التأكد من دقة المعلومات.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                <input type="text" value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  dir={f.mono ? "ltr" : undefined} />
              </div>
            ))}
            {customFields.length > 0 && (
              <div className="col-span-2 pt-3 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-700 mb-2">📝 الحقول المخصصة</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customFields.map((cf) => (
                    <div key={cf.id}>
                      <label className="text-xs text-slate-500 mb-1 block">{cf.label}</label>
                      <input type="text" value={values[cf.key] || ""}
                        onChange={(e) => setValues({ ...values, [cf.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={handleSave} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">💾 حفظ التعديلات</button>
        </div>
      </div>
    </div>
  );
}
