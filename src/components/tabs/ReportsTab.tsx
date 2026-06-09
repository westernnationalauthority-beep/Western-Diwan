// ============================================================
// ReportsTab.tsx - تبويب التقارير والرسوم البيانية
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { type Session, addLog, getCustomFields, mergeAllEmployees } from "../../lib/storage";
import { type Employee, fetchEmployeesFromSheet } from "../../data/employees";
import { syncCustomFieldsFromSheet } from "../../utils";
import { NACC_LOGO } from "../../constants";

// ──────────────────────────────────────────────
// ترتيب المؤهلات من الأعلى للأدنى
// ──────────────────────────────────────────────
const QUALIFICATION_ORDER = [
  "الدكتوراه", "دكتوراه", "الماجستير", "ماجستير",
  "البكالوريوس", "بكالوريوس", "الليسانس", "ليسانس",
  "الدبلوم العالي", "المعهد العالي", "المعهد المتوسط",
  "الدبلوم المتوسط", "الشهادة الثانوية", "الإعدادية", "الابتدائية",
];

function normalizeQualification(value: string): string {
  const v = (value || "").trim();
  const found = QUALIFICATION_ORDER.find((q) => v.includes(q));
  return found || (v || "غير مسجل");
}

// ──────────────────────────────────────────────
// دالة الترويسة للطباعة
// ──────────────────────────────────────────────
function getHeaderHTML(): string {
  return `<div style="display:flex;align-items:center;gap:14px;padding:8px 0 14px;border-bottom:3px double #b8860b;margin-bottom:14px;">
    <img src="${NACC_LOGO}" width="70" height="70" alt="NACC" style="object-fit:contain;"/>
    <div style="flex:1;text-align:center;">
      <div style="font-size:8px;color:#64748b;letter-spacing:1px;">NATIONAL ANTI-CORRUPTION COMMISSION</div>
      <div style="font-size:15px;font-weight:bold;color:#1e3a8a;margin:4px 0;">الهيئة الوطنية لمكافحة الفساد</div>
      <div style="font-size:12px;font-weight:bold;color:#1e3a8a;">ديوان المنطقة الغربية</div>
    </div>
  </div>`;
}

function getFooterHTML(): string {
  return `<div style="margin-top:30px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:8px;color:#94a3b8;">
    تصميم وتطوير المنظومة: <strong style="color:#b8860b;">S-BUTTO</strong>
    &nbsp;|&nbsp; الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
  </div>`;
}

// ──────────────────────────────────────────────
// ReportsTab الرئيسي
// ──────────────────────────────────────────────
export function ReportsTab({ session }: { session: Session }) {
  const [employees, setEmployees] = useState<(Employee & Record<string, string>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [fieldA, setFieldA] = useState("gender");
  const [fieldB, setFieldB] = useState("receivesPension");
  const [savedComparisons, setSavedComparisons] = useState<{ id: string; fieldA: string; fieldB: string }[]>([]);
  const customFields = getCustomFields();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEmployeesFromSheet();
      syncCustomFieldsFromSheet(data);
      setEmployees(mergeAllEmployees(data));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableFields = [
    { key: "gender",         label: "الجنس" },
    { key: "receivesPension",label: "يتقاضى معاش" },
    { key: "status",         label: "الحالة" },
    { key: "dataComplete",   label: "اكتمال البيانات" },
    { key: "qualification",  label: "المؤهل العلمي" },
    { key: "department",     label: "الإدارة" },
    { key: "section",        label: "القسم" },
    { key: "jobStatus",      label: "الحالة الوظيفية" },
    { key: "employmentType", label: "نوع التوظيف" },
    ...customFields.map((cf) => ({ key: cf.label, label: cf.label })),
  ];

  // ── دالة إحصاء القيم ──
  const countBy = useCallback((field: string, includeUnspecified = true): [string, number][] => {
    const counts: Record<string, number> = {};
    employees.forEach((e) => {
      let value = ((e as Record<string, string>)[field] || "غير مسجل").toString().trim() || "غير مسجل";
      if (field === "qualification") value = normalizeQualification(value);
      if (!includeUnspecified && value === "غير مسجل") return;
      counts[value] = (counts[value] || 0) + 1;
    });
    let entries = Object.entries(counts) as [string, number][];
    if (field === "qualification") {
      entries.sort((a, b) => {
        const ai = QUALIFICATION_ORDER.indexOf(a[0]);
        const bi = QUALIFICATION_ORDER.indexOf(b[0]);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    } else {
      entries.sort((a, b) => b[1] - a[1]);
    }
    return entries;
  }, [employees]);

  const compareCounts = useMemo(() => ({
    a: countBy(fieldA, false),
    b: countBy(fieldB, false),
    aUnspecified: countBy(fieldA, true).find(([k]) => k === "غير مسجل")?.[1] || 0,
    bUnspecified: countBy(fieldB, true).find(([k]) => k === "غير مسجل")?.[1] || 0,
  }), [countBy, fieldA, fieldB]);

  const total = employees.length || 1;
  const totalLabel = `الإجمالي الكلي للموظفين: ${employees.length}`;

  // ── حفظ مقارنة ──
  const saveCurrentComparison = () => {
    setSavedComparisons((prev) => [...prev, { id: Date.now().toString(), fieldA, fieldB }]);
  };

  const removeSavedComparison = (id: string) => {
    setSavedComparisons((prev) => prev.filter((c) => c.id !== id));
  };

  // ── طباعة المقارنات ──
  const printReportsComparison = () => {
    const targets = savedComparisons.length > 0 ? savedComparisons : [{ id: "current", fieldA, fieldB }];
    const w = window.open("", "_blank", "width=1200,height=900,scrollbars=yes");
    if (!w) { alert("يرجى السماح بالنوافذ المنبثقة"); return; }
    const dt = new Date().toLocaleString("ar-LY");

    const renderComparisonBox = (fa: string, fb: string) => {
      const labelA = availableFields.find((f) => f.key === fa)?.label || fa;
      const labelB = availableFields.find((f) => f.key === fb)?.label || fb;
      const dataA = countBy(fa, false);
      const dataB = countBy(fb, false);
      const unA = countBy(fa, true).find(([k]) => k === "غير مسجل")?.[1] || 0;
      const unB = countBy(fb, true).find(([k]) => k === "غير مسجل")?.[1] || 0;

      const makeRows = (data: [string, number][]) =>
        data.map(([label, count], idx) => {
          const pct = Math.round((count / total) * 100);
          return `<tr style="background:${idx % 2 === 0 ? "#f8fafc" : "white"};">
            <td style="padding:7px;border:1px solid #e2e8f0;">${label}</td>
            <td style="padding:7px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:#1e3a8a;">${count}</td>
            <td style="padding:7px;border:1px solid #e2e8f0;text-align:center;">${pct}%</td>
          </tr>`;
        }).join("");

      return `<div class="box" style="page-break-inside:avoid;">
        <div class="box-head">مقارنة: ${labelA} × ${labelB}</div>
        <div class="box-sub">${totalLabel}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;">
          <div>
            <h3 style="font-size:13px;color:#1e3a8a;margin-bottom:8px;">${labelA}</h3>
            <table><thead><tr><th>القيمة</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${makeRows(dataA)}</tbody></table>
            <div style="margin-top:6px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">غير مسجل: <strong>${unA}</strong></div>
          </div>
          <div>
            <h3 style="font-size:13px;color:#1e3a8a;margin-bottom:8px;">${labelB}</h3>
            <table><thead><tr><th>القيمة</th><th>العدد</th><th>النسبة</th></tr></thead><tbody>${makeRows(dataB)}</tbody></table>
            <div style="margin-top:6px;font-size:11px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">غير مسجل: <strong>${unB}</strong></div>
          </div>
        </div>
      </div>`;
    };

    w.document.write(`<!DOCTYPE html><html dir="rtl">
<head><meta charset="UTF-8"><title>طباعة المقارنات</title><style>
  body{font-family:Tahoma,Arial,sans-serif;direction:rtl;padding:20px;color:#222;background:#fff;}
  h1,h2,h3{margin:0;}
  .box{margin-bottom:18px;border:1px solid #dbe4ff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04);}
  .box-head{background:linear-gradient(90deg,#1e3a8a,#4338ca);color:#fff;padding:12px 14px;font-size:14px;font-weight:bold;}
  .box-sub{padding:8px 14px;background:#f8fafc;font-size:11px;color:#475569;border-bottom:1px solid #e2e8f0;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#eef2ff;padding:9px;border:1px solid #cbd5e1;}
  td{padding:9px;border:1px solid #e2e8f0;}
  .note{background:#fff7ed;border:1px solid #fdba74;padding:12px 14px;border-radius:10px;font-size:12px;color:#9a3412;margin-bottom:16px;line-height:1.8;}
  .hero{background:linear-gradient(90deg,#eff6ff,#eef2ff);border:1px solid #c7d2fe;border-radius:14px;padding:16px;margin-bottom:16px;}
  @media print{.no-print{display:none!important;} body{padding:10px;} .box{page-break-inside:avoid;}}
</style></head><body>
  ${getHeaderHTML()}
  <div class="hero">
    <h2 style="color:#1e3a8a;font-size:20px;">تقرير المقارنات الإحصائية</h2>
    <div style="margin-top:6px;font-size:12px;color:#475569;">تاريخ الطباعة: ${dt}</div>
    <div style="margin-top:6px;font-size:12px;color:#0f172a;font-weight:bold;">${totalLabel}</div>
  </div>
  <div class="note"><strong>مهم:</strong> تم استبعاد <strong>غير مسجل</strong> من المقارنة الأساسية حتى تكون النتائج أوضح. النسبة المئوية محسوبة من الإجمالي الكلي.</div>
  ${targets.map((t) => renderComparisonBox(t.fieldA, t.fieldB)).join("")}
  ${getFooterHTML()}
  <button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;left:20px;padding:10px 24px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;">🖨️ طباعة المقارنات</button>
</body></html>`);
    w.document.close();
    addLog(session, "print_summary", `طباعة ${targets.length} مقارنة`);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-4">
        <div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500">جاري تحميل التقارير...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">📈 التقارير والرسوم البيانية</h2>
          <p className="text-xs text-slate-500">إحصاءات واضحة مع استبعاد غير المسجل من المقارنة الأساسية</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={saveCurrentComparison}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
            ➕ حفظ المقارنة الحالية
          </button>
          <button onClick={printReportsComparison}
            className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition">
            🖨️ طباعة المقارنات
          </button>
          <button onClick={() => { load(); addLog(session, "refresh_data", "تحديث التقارير"); }}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100 transition">
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* الرسوم الثابتة */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard
          title="عدد الذكور والإناث" subtitle={totalLabel}
          data={countBy("gender", false)} total={total}
          extraNote={`غير مسجل: ${countBy("gender", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`}
        />
        <ChartCard
          title="يتقاضى معاش / لا يتقاضى" subtitle={totalLabel}
          data={countBy("receivesPension", false)} total={total}
          extraNote={`غير مسجل: ${countBy("receivesPension", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard
          title="المؤهلات العلمية من الأعلى إلى الأدنى" subtitle={totalLabel}
          data={countBy("qualification", false)} total={total}
          extraNote={`غير مسجل: ${countBy("qualification", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`}
        />
        <ChartCard
          title="الحالة الوظيفية" subtitle={totalLabel}
          data={countBy("jobStatus", false)} total={total}
          extraNote={`غير مسجل: ${countBy("jobStatus", true).find(([k]) => k === "غير مسجل")?.[1] || 0}`}
        />
      </div>

      {/* المقارنة المخصصة */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">مقارنة مخصصة احترافية</h3>
          <p className="text-[11px] text-slate-500 mt-1">اختر الحقول التي تريد مقارنتها. سيتم استبعاد "غير مسجل" وعرضه منفصلاً.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-800 leading-6">
          <strong>توضيح:</strong> <strong>غير مسجل</strong> = حقل فارغ أو لم يتم تعبئته.{" "}
          <strong>الإجمالي الكلي</strong> = جميع موظفي المنظومة ({employees.length}).
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">الحقل الأول</label>
            <select value={fieldA} onChange={(e) => setFieldA(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
              {availableFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">الحقل الثاني</label>
            <select value={fieldB} onChange={(e) => setFieldB(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
              {availableFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ChartCard
            title={`${availableFields.find((f) => f.key === fieldA)?.label || fieldA}`}
            subtitle={totalLabel} data={compareCounts.a} total={total}
            extraNote={`غير مسجل: ${compareCounts.aUnspecified}`}
          />
          <ChartCard
            title={`${availableFields.find((f) => f.key === fieldB)?.label || fieldB}`}
            subtitle={totalLabel} data={compareCounts.b} total={total}
            extraNote={`غير مسجل: ${compareCounts.bUnspecified}`}
          />
        </div>
      </div>

      {/* المقارنات المحفوظة */}
      {savedComparisons.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800 text-sm">
              المقارنات المحفوظة للطباعة ({savedComparisons.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              سيتم طباعة هذه المقارنات فقط عند الضغط على زر الطباعة
            </span>
          </div>
          <div className="space-y-2">
            {savedComparisons.map((cmp, idx) => (
              <div key={cmp.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
                <span className="text-sm text-slate-700">
                  {idx + 1}.{" "}
                  {availableFields.find((f) => f.key === cmp.fieldA)?.label || cmp.fieldA}
                  {" × "}
                  {availableFields.find((f) => f.key === cmp.fieldB)?.label || cmp.fieldB}
                </span>
                <button onClick={() => removeSavedComparison(cmp.id)}
                  className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2.5 py-1 rounded text-xs font-medium transition">
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// ChartCard - بطاقة الرسم البياني
// ──────────────────────────────────────────────
const BAR_COLORS = [
  "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-violet-500",
  "bg-cyan-500", "bg-pink-500", "bg-slate-500", "bg-red-500",
  "bg-orange-500", "bg-teal-500",
];

function ChartCard({
  title, subtitle, data, total, extraNote,
}: {
  title: string;
  subtitle: string;
  data: [string, number][];
  total: number;
  extraNote?: string;
}) {
  const max = Math.max(...data.map((d) => d[1]), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="mb-3">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
        {extraNote && (
          <p className="text-[10px] text-amber-600 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-block">
            {extraNote}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {data.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">لا توجد بيانات</p>
        )}
        {data.map(([label, count], idx) => {
          const pct = Math.round((count / total) * 100);
          const barWidth = `${(count / max) * 100}%`;
          return (
            <div key={label + idx}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-medium text-slate-700 truncate flex-1">{label}</span>
                <span className="text-[11px] text-slate-500 whitespace-nowrap font-mono">
                  {count} <span className="text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
