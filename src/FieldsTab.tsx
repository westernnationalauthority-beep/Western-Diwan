import { useState } from "react";
import { type Session, type CustomField, addLog, getCustomFields, addCustomField, deleteCustomField, toggleFieldRequired } from "../../lib/storage";

export function FieldsTab({ session }: { session: Session }) {
  const [fields, setFields] = useState<CustomField[]>(() => getCustomFields());
  const [newLabel, setNewLabel] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => setFields(getCustomFields());

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) { setError("أدخل اسم الحقل"); return; }
    if (fields.some((f) => f.label === label)) { setError("الحقل موجود مسبقاً"); return; }
    addCustomField(label, "manual", newRequired);
    addLog(session, "add_field", `إضافة حقل مخصص: ${label}`);
    setNewLabel(""); setNewRequired(false); setError("");
    refresh();
  };

  const handleRemove = (field: CustomField) => {
    if (!confirm(`حذف الحقل "${field.label}"؟ سيُحذف من جميع السجلات.`)) return;
    deleteCustomField(field.id);
    addLog(session, "delete_field", `حذف حقل مخصص: ${field.label}`);
    refresh();
  };

  const handleToggleRequired = (field: CustomField) => {
    toggleFieldRequired(field.id);
    refresh();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-base font-bold text-slate-800">➕ إدارة الحقول المخصصة</h2>
        <p className="text-xs text-slate-500">إضافة حقول إضافية تظهر في نموذج الموظف</p>
      </div>

      {/* إضافة حقل جديد */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">إضافة حقل جديد</h3>
        <div className="flex gap-2">
          <input type="text" value={newLabel} onChange={(e) => { setNewLabel(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="اسم الحقل (مثال: رقم الملف)"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          <button onClick={handleAdd}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition">
            ➕ إضافة
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
            className="w-4 h-4 accent-emerald-600" />
          <span className="text-xs text-slate-600">حقل مطلوب (يؤثر على نسبة اكتمال البيانات)</span>
        </label>
        {error && <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      </div>

      {/* قائمة الحقول */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-700 text-sm">الحقول الحالية</h3>
          <span className="text-xs text-slate-500">{fields.length} حقل</span>
        </div>
        {fields.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">لا توجد حقول مخصصة</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {fields.map((field) => (
              <div key={field.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${field.source === "sheet-sync" ? "bg-blue-400" : "bg-emerald-400"}`} title={field.source === "sheet-sync" ? "من Google Sheets" : "يدوي"} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{field.label}</p>
                    <p className="text-[10px] text-slate-400">
                      {field.source === "sheet-sync" ? "🔗 من Google Sheets" : "✏️ مضاف يدوياً"}
                      {field.isRequired && <span className="mr-2 text-red-500 font-bold">• مطلوب</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleRequired(field)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition ${
                      field.isRequired
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}>
                    {field.isRequired ? "مطلوب ✓" : "اختياري"}
                  </button>
                  {field.source !== "sheet-sync" && (
                    <button onClick={() => handleRemove(field)}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[10px] font-medium transition">
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 space-y-1">
        <p className="font-bold">ℹ️ معلومات:</p>
        <p>• الحقول الزرقاء مزامَنة تلقائياً من Google Sheets ولا يمكن حذفها.</p>
        <p>• الحقول الخضراء مضافة يدوياً ويمكن حذفها.</p>
        <p>• الحقول "المطلوبة" تُحتسب في نسبة اكتمال بيانات الموظف.</p>
      </div>
    </div>
  );
}
