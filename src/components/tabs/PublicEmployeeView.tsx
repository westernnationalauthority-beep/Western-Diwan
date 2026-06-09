// ============================================================
// PublicEmployeeView.tsx - شاشة عرض بيانات الموظف العام
// ============================================================

import { type Employee } from "../data/employees";
import { type EmployeeLoginResult } from "../data/employees";
import { addLog, getCustomFields } from "../lib/storage";
import { getMissingFields, isEmpty } from "../utils";
import { printIndividualForm } from "../utils/print";
import { NACC_LOGO } from "../constants";

export function PublicEmployeeView({
  employee,
  loginResult,
  onBack,
}: {
  employee: Employee;
  loginResult: EmployeeLoginResult & { employee?: Employee };
  onBack: () => void;
}) {
  const customFields = getCustomFields();
  const missing = loginResult.missing || getMissingFields(employee);
  const isComplete = loginResult.isComplete ?? missing.length === 0;
  const emp = employee as Record<string, string>;

  const share = async () => {
    const text = `بياناتي - ديوان المنطقة الغربية\n\nالاسم: ${emp.fullName}\nالرقم الوطني: ${emp.nationalNumber}\nالدرجة: ${emp.jobGrade || "-"}\nالإدارة: ${emp.department || "-"}\nالهاتف: ${emp.phone || "-"}\nالحالة: ${emp.status || "-"}`;
    addLog(
      { userId: "public", username: "public", fullName: emp.fullName, role: "public" },
      "share_employee",
      `مشاركة بيانات: ${emp.nationalNumber}`
    );
    if (navigator.share) {
      try { await navigator.share({ title: "بياناتي", text }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert("✅ تم نسخ البيانات إلى الحافظة");
      } catch { alert("لا يمكن النسخ، استخدم زر الطباعة"); }
    }
  };

  const print = () => {
    printIndividualForm(employee);
    addLog(
      { userId: "public", username: "public", fullName: emp.fullName, role: "public" },
      "print_employee",
      `طباعة بياناتي: ${emp.nationalNumber}`
    );
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
      {/* Header */}
      <header className="bg-white border-b-2 border-emerald-500 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={NACC_LOGO} alt="NACC" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-slate-900">بياناتي الشخصية</h1>
              <p className="text-[10px] text-slate-500">ديوان المنطقة الغربية - جبل نفوسة</p>
            </div>
          </div>
          <button onClick={onBack}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            رجوع
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">

        {/* بطاقة الترحيب */}
        <div className={`rounded-2xl p-5 text-white shadow-lg ${isComplete ? "bg-gradient-to-l from-emerald-500 to-teal-600" : "bg-gradient-to-l from-amber-500 to-orange-600"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">مرحباً</p>
              <h2 className="text-xl font-bold mt-1">{emp.fullName}</h2>
              <p className="text-xs mt-2 font-mono opacity-90" dir="ltr">الرقم الوطني: {emp.nationalNumber}</p>
            </div>
            <div className="text-4xl">{isComplete ? "✅" : "⚠️"}</div>
          </div>
          <div className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20">
            {isComplete
              ? "بياناتك مكتملة - يمكنك طباعة نموذجك"
              : `بياناتك تحتوي على ${missing.length} نقص - يرجى مراجعة الإدارة`}
          </div>
        </div>

        {/* إشعار الكود الجديد */}
        {loginResult.codeType && (
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🔐</span>
              <div>
                <h3 className="font-bold text-indigo-800 text-sm">{loginResult.codeType}</h3>
                <p className="text-[11px] text-indigo-600">احتفظ بهذا الكود في مكان آمن</p>
              </div>
            </div>
            <div className="bg-white border-2 border-indigo-400 rounded-xl p-4 text-center">
              <p className="text-[10px] text-slate-500 mb-1">كودك الشخصي الجديد</p>
              <p className="text-3xl font-mono font-bold text-indigo-700 tracking-widest">{loginResult.personalCode}</p>
              {loginResult.expiry && <p className="text-[10px] text-slate-400 mt-1">صالح حتى: {loginResult.expiry}</p>}
            </div>
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 text-center">
              ⚠️ ستحتاج هذا الكود في كل مرة تدخل فيها. لا تشاركه مع أحد.
            </p>
          </div>
        )}

        {/* أزرار الإجراءات */}
        {isComplete ? (
          <div className="flex gap-2">
            <button onClick={print}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              طباعة نموذجي
            </button>
            <button onClick={share}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition shadow-md flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              مشاركة
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
            <div className="text-4xl mb-2">🏢</div>
            <h3 className="font-bold text-amber-800">يرجى مراجعة الإدارة</h3>
            <p className="text-xs text-amber-700 mt-1">لاستكمال بياناتك الناقصة وتفعيل صلاحية الطباعة</p>
          </div>
        )}

        {/* تنبيه النواقص */}
        {missing.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
            <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
              <span>⚠️</span> تنبيه: بياناتك بحاجة لتحديث
            </h3>
            <p className="text-xs text-amber-700 mb-2">يرجى مراجعة الإدارة لاستكمال البيانات التالية:</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m, i) => (
                <span key={i} className="bg-white text-amber-800 px-2 py-1 rounded-lg text-[10px] font-medium border border-amber-300">{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* أقسام البيانات */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <DataSection title="البيانات الأساسية" color="indigo" rows={[
            ["الاسم رباعي", emp.fullName], ["الرقم الوطني", emp.nationalNumber, true],
            ["الرقم الوظيفي", emp.jobNumber, true], ["الجنس", emp.gender],
            ["الحالة الوظيفية", emp.jobStatus], ["نوع التوظيف", emp.employmentType],
          ]} />
          <DataSection title="البيانات الأكاديمية والوظيفية" color="emerald" rows={[
            ["الدرجة الوظيفية", emp.jobGrade], ["المؤهل العلمي", emp.qualification],
            ["التخصص", emp.specialization], ["التقدير", emp.grade],
            ["أصل المؤهل / مكان الحصول", emp.qualificationOrigin],
          ]} />
          <DataSection title="البيانات المالية" color="amber" rows={[
            ["المصرف", emp.bankName], ["رقم الحساب (IBAN)", emp.iban, true],
            ["يتقاضى معاش", emp.receivesPension],
          ]} />
          <DataSection title="البيانات الإدارية" color="violet" rows={[
            ["الإدارة", emp.department], ["القسم", emp.section],
            ["رقم الهاتف", emp.phone, true],
            ["رقم قرار التعيين", emp.appointmentDecision, true],
            ["تاريخ المباشرة", emp.startDate], ["آخر ترقية", emp.promotionDate],
          ]} />

          {/* الحقول المخصصة */}
          {customFields.length > 0 && (
            <DataSection title="بيانات إضافية" color="cyan" rows={
              customFields.map((cf) => [cf.label, emp[cf.label] || emp[cf.key] || ""])
            } />
          )}

          {/* الحالة والملاحظات */}
          <DataSection title="الحالة والملاحظات" color="indigo" rows={[
            ["الحالة", emp.status], ["اكتمال البيانات", emp.dataComplete],
            ["ملاحظات", emp.notes], ["الإجراء المطلوب", emp.requiredAction],
          ]} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-3 mt-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs opacity-70">
            الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
          </p>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────
// DataSection - قسم عرض البيانات
// ──────────────────────────────────────────────
const SECTION_COLORS: Record<string, string> = {
  indigo: "bg-indigo-600", emerald: "bg-emerald-600",
  amber: "bg-amber-600", violet: "bg-violet-600", cyan: "bg-cyan-600",
};

function DataSection({
  title, color, rows,
}: {
  title: string;
  color: string;
  rows: (string | boolean | undefined)[][];
}) {
  return (
    <div>
      <div className={`${SECTION_COLORS[color] || "bg-slate-600"} text-white px-3 py-1.5 rounded-t-lg text-xs font-bold`}>
        {title}
      </div>
      <div className="border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">
        {rows.map((row, i) => {
          const label = row[0] as string;
          const value = row[1] as string;
          const mono = row[2] as boolean;
          const empty = isEmpty(value);
          return (
            <div key={i} className={`grid grid-cols-3 gap-2 px-3 py-2 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"} border-b border-slate-100 last:border-b-0`}>
              <span className="text-xs text-slate-500">{label}</span>
              <span
                className={`col-span-2 text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${mono && !empty ? "font-mono" : ""}`}
                dir={mono && !empty ? "ltr" : undefined}>
                {empty ? "— لم يتم تسجيله —" : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
