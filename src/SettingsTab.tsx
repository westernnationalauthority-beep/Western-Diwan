import { useState } from "react";
import { type Session, addLog, changePassword } from "../../lib/storage";

export function SettingsTab({ session }: { session: Session }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    setMsg(""); setErr("");
    if (newPwd !== confirmPwd) { setErr("كلمتا المرور غير متطابقتين"); return; }
    const r = changePassword(session.userId, oldPwd, newPwd);
    if (!r.ok) { setErr(r.error || ""); return; }
    addLog(session, "change_password", "تغيير كلمة المرور");
    setMsg("✅ تم تغيير كلمة المرور بنجاح");
    setOldPwd(""); setNewPwd(""); setConfirmPwd("");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">الإعدادات الشخصية</h2>
        <p className="text-xs text-slate-500">تغيير كلمة المرور الخاصة بك</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500">الحساب الحالي</p>
          <p className="font-bold text-slate-800">{session.fullName}</p>
          <p className="text-[10px] text-slate-500 font-mono" dir="ltr">@{session.username} • {session.role === "admin" ? "👑 مدير" : "👤 موظف"}</p>
        </div>
        <div>
          <label className="text-xs text-slate-500">كلمة المرور الحالية</label>
          <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-slate-500">كلمة المرور الجديدة</label>
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-slate-500">تأكيد كلمة المرور الجديدة</label>
          <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:ring-2 focus:ring-indigo-500 outline-none" dir="ltr" />
        </div>
        {err && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}
        {msg && <p className="text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">{msg}</p>}
        <button onClick={submit} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition">
          تغيير كلمة المرور
        </button>
      </div>
    </div>
  );
}
