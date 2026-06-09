// ============================================================
// AboutTab.tsx - تبويب "حول النظام"
// ============================================================

import { NACC_LOGO, SYSTEM_NAME } from "../../constants";

const VERSION = "v5";
const RELEASE_DATE = "2026";

const features = [
  { icon: "👥", title: "إدارة بيانات الموظفين", desc: "إضافة وتعديل وحذف بيانات الموظفين بصلاحيات محددة" },
  { icon: "📊", title: "التقارير والإحصائيات", desc: "تقارير شاملة عن الموظفين مع إمكانية الطباعة والتصدير" },
  { icon: "🔐", title: "إدارة المستخدمين والصلاحيات", desc: "نظام صلاحيات متعدد المستويات لضمان أمان البيانات" },
  { icon: "🗄️", title: "الأرشفة والاسترجاع", desc: "أرشفة بيانات الموظفين المنتهية خدمتهم مع إمكانية الاسترجاع" },
  { icon: "📋", title: "طلبات الحذف", desc: "نظام موافقة متدرج لطلبات حذف البيانات" },
  { icon: "➕", title: "الحقول المخصصة", desc: "إضافة حقول بيانات إضافية حسب احتياجات العمل" },
  { icon: "📱", title: "التواصل عبر واتساب", desc: "إشعار الموظفين بالبيانات الناقصة مباشرةً عبر واتساب" },
  { icon: "☁️", title: "مزامنة Google Sheets", desc: "استيراد البيانات مباشرةً من جداول Google Sheets" },
];

const stats = [
  { value: VERSION, label: "الإصدار الحالي" },
  { value: "2026", label: "سنة الإنشاء" },
  { value: "9", label: "تبويب في النظام" },
  { value: "100%", label: "واجهة عربية" },
];

export function AboutTab() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">

      {/* بطاقة الهوية الرئيسية */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
        <div className="bg-gradient-to-l from-indigo-700 via-indigo-600 to-violet-700 px-8 py-10 text-center text-white relative">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <img src={NACC_LOGO} alt="NACC" className="h-28 w-28 object-contain mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-2xl font-bold mb-1">نظام إدارة بيانات الموظفين</h1>
          <p className="text-indigo-200 text-sm">الهيئة الوطنية لمكافحة الفساد — ديوان المنطقة الغربية</p>

          {/* الإحصائيات */}
          <div className="grid grid-cols-4 gap-3 mt-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl py-3 px-2 border border-white/20">
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-[11px] text-indigo-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* المميزات */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block" />
          مميزات المنظومة
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors border border-slate-100">
              <span className="text-xl mt-0.5">{f.icon}</span>
              <div>
                <p className="text-xs font-bold text-slate-800">{f.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* معلومات النظام */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block" />
          معلومات النظام
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          {[
            { label: "الإصدار", value: VERSION },
            { label: "سنة الإصدار", value: RELEASE_DATE },
            { label: "لغة الواجهة", value: "العربية (RTL)" },
            { label: "قاعدة البيانات", value: "Google Sheets" },
            { label: "المنصة", value: "Web App" },
            { label: "التقنيات", value: "React · TypeScript · Vite" },
          ].map((item) => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1">{item.label}</p>
              <p className="font-bold text-slate-700">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* حقوق التطوير */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-amber-400 rounded-full inline-block" />
          التطوير والتصميم
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">👨‍💻</div>
            <p className="text-[10px] text-slate-400 mb-1">المصمم والمطور</p>
            <p className="font-bold text-amber-700 text-sm tracking-wider">{SYSTEM_NAME}</p>
          </div>
          <div className="flex-1 bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">🏛️</div>
            <p className="text-[10px] text-slate-400 mb-1">الجهة المالكة</p>
            <p className="font-bold text-indigo-700 text-sm">الهيئة الوطنية لمكافحة الفساد</p>
            <p className="text-[10px] text-indigo-400 mt-0.5">ديوان المنطقة الغربية</p>
          </div>
        </div>
      </div>

      {/* ملاحظة قانونية */}
      <div className="text-center text-[10px] text-slate-400 pb-2">
        © {new Date().getFullYear()} جميع الحقوق محفوظة — الهيئة الوطنية لمكافحة الفساد
      </div>

    </div>
  );
}
