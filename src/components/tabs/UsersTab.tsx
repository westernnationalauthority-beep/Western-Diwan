import { useState, useEffect } from "react";
import {
  type Session, type User, type Permissions,
  addLog, getUsers, getUserStats, createUser, updateUser, deleteUser,
  ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS, PERMISSION_LABELS,
  updateUserDepartments, isUserRestricted,
} from "../../lib/storage";
import { fetchEmployeesFromSheet } from "../../data/employees";

export function UsersTab({ session }: { session: Session }) {
  const [users, setUsers] = useState<User[]>(() => getUsers());
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permsUser, setPermsUser] = useState<User | null>(null);
  const [depsUser, setDepsUser] = useState<User | null>(null);
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchEmployeesFromSheet().then((emps) => {
      const deps = Array.from(new Set(emps.map((e) => e.department).filter(Boolean))).sort();
      setAllDepartments(deps);
    }).catch(() => {});
  }, []);

  const refresh = () => setUsers(getUsers());

  const handleToggle = (u: User) => {
    if (!confirm(`${u.isActive ? "تعطيل" : "تفعيل"} المستخدم "${u.fullName}"؟`)) return;
    updateUser(u.id, { isActive: !u.isActive });
    addLog(session, "toggle_user", `${u.isActive ? "تعطيل" : "تفعيل"}: ${u.fullName}`);
    refresh();
  };

  const handleDelete = (u: User) => {
    if (!confirm(`حذف المستخدم "${u.fullName}" نهائياً؟`)) return;
    const r = deleteUser(u.id);
    if (!r.ok) { alert(r.error); return; }
    addLog(session, "delete_user", `حذف: ${u.fullName} (${u.username})`);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">🔐 إدارة المستخدمين</h2>
          <p className="text-xs text-slate-500">إضافة مستخدمين وتحديد صلاحياتهم وأقسامهم</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-md flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          إضافة مستخدم
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["اسم المستخدم","الاسم الكامل","الدور","الصلاحيات","الأقسام","الحالة","النشاط","إجراءات"].map((h) => (
                  <th key={h} className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const stats = getUserStats(u.id);
                const activePermsCount = Object.values(u.permissions || {}).filter(Boolean).length;
                const restricted = isUserRestricted(u);
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-indigo-700" dir="ltr">{u.username}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{u.fullName}</td>
                    <td className="px-3 py-3">
                      {u.role === "admin"
                        ? <span className="bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-violet-200">👑 مدير</span>
                        : <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-200">👤 موظف</span>}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setPermsUser(u)}
                        className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">
                        {activePermsCount} / {Object.keys(PERMISSION_LABELS).length} صلاحية
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {u.role === "admin" ? (
                        <span className="text-[10px] text-slate-400">كل الأقسام</span>
                      ) : (
                        <button onClick={() => setDepsUser(u)}
                          className={`px-2 py-1 rounded text-[10px] font-medium border transition ${
                            restricted
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}>
                          {restricted ? `${u.allowedDepartments!.length} قسم` : "كل الأقسام"}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {u.isActive
                        ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">نشط</span>
                        : <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-bold">معطل</span>}
                    </td>
                    <td className="px-3 py-3 text-[10px] text-slate-500">
                      {stats.totalLogins} دخول<br />{stats.totalOperations} عملية
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => setEditingUser(u)}
                          className="text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 px-2 py-1 rounded text-[10px] font-medium transition">تعديل</button>
                        <button onClick={() => handleToggle(u)}
                          className="text-amber-700 hover:text-white hover:bg-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-medium transition">
                          {u.isActive ? "تعطيل" : "تفعيل"}
                        </button>
                        {u.id !== session.userId && (
                          <button onClick={() => handleDelete(u)}
                            className="text-red-600 hover:text-white hover:bg-red-600 border border-red-200 px-2 py-1 rounded text-[10px] font-medium transition">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <UserFormModal mode="create" onClose={() => setShowCreate(false)} onSave={refresh} session={session} />}
      {editingUser && <UserFormModal mode="edit" user={editingUser} onClose={() => setEditingUser(null)} onSave={refresh} session={session} />}
      {permsUser && <PermissionsModal user={permsUser} onClose={() => setPermsUser(null)} onSave={refresh} session={session} />}
      {depsUser && (
        <DepartmentsModal
          user={depsUser}
          allDepartments={allDepartments}
          onClose={() => setDepsUser(null)}
          onSave={refresh}
          session={session}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// مودال إنشاء / تعديل مستخدم
// ──────────────────────────────────────────────
function UserFormModal({ mode, user, onClose, onSave, session }: {
  mode: "create" | "edit"; user?: User;
  onClose: () => void; onSave: () => void; session: Session;
}) {
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [role, setRole] = useState<"admin" | "employee">(user?.role || "employee");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [error, setError] = useState("");

  const submit = () => {
    setError("");
    if (mode === "create") {
      const perms = role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS;
      const r = createUser({
        username: username.trim(), password, fullName: fullName.trim(),
        role, isActive, permissions: perms, createdBy: session.userId,
        allowedDepartments: [],
      }, session.userId);
      if (!r.ok) { setError(r.error || ""); return; }
      addLog(session, "create_user", `إنشاء: ${fullName} (${username})`);
    } else if (user) {
      const updates: Partial<User> = { username: username.trim(), fullName: fullName.trim(), role, isActive };
      if (password) updates.password = password;
      const r = updateUser(user.id, updates);
      if (!r.ok) { setError(r.error || ""); return; }
      addLog(session, "update_user", `تعديل: ${fullName}`);
    }
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{mode === "create" ? "➕ إضافة مستخدم" : "✏️ تعديل المستخدم"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-500">✕</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">الاسم الكامل</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" placeholder="مثال: أحمد محمد" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">اسم المستخدم</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" dir="ltr" placeholder="ahmad" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">
              كلمة المرور {mode === "edit" && <span className="text-slate-400">(فارغة = بدون تغيير)</span>}
            </label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">الدور الوظيفي</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none mt-1 bg-white">
              <option value="employee">👤 موظف (صلاحيات مخصصة)</option>
              <option value="admin">👑 مدير (كل الصلاحيات)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-slate-700">الحساب نشط</span>
          </label>
          {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        </div>
        <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={submit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
            {mode === "create" ? "إنشاء" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// مودال الصلاحيات
// ──────────────────────────────────────────────
function PermissionsModal({ user, onClose, onSave, session }: {
  user: User; onClose: () => void; onSave: () => void; session: Session;
}) {
  const [perms, setPerms] = useState<Permissions>(
    user.permissions || (user.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS)
  );

  const save = () => {
    updateUser(user.id, { permissions: perms });
    addLog(session, "update_permissions", `تعديل صلاحيات: ${user.fullName}`);
    onSave(); onClose();
  };

  const toggle = (k: keyof Permissions) => setPerms({ ...perms, [k]: !perms[k] });
  const enableAll = () => setPerms(ADMIN_PERMISSIONS);
  const disableAll = () => setPerms(DEFAULT_EMPLOYEE_PERMISSIONS);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-indigo-50 sticky top-0">
          <div>
            <h3 className="font-bold text-slate-800">🔑 صلاحيات المستخدم</h3>
            <p className="text-xs text-slate-500">{user.fullName} • @{user.username}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded text-slate-500">✕</button>
        </div>
        <div className="p-4 space-y-2">
          {user.role === "admin" && (
            <p className="text-xs bg-violet-50 border border-violet-200 text-violet-800 rounded-lg p-2">
              👑 المدير له صلاحيات كاملة افتراضياً
            </p>
          )}
          <div className="flex gap-2 mb-3">
            <button onClick={enableAll} className="flex-1 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">تفعيل الكل</button>
            <button onClick={disableAll} className="flex-1 py-1.5 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">إلغاء الكل</button>
          </div>
          {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((k) => (
            <label key={k} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
              perms[k] ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"
            }`}>
              <input type="checkbox" checked={!!perms[k]} onChange={() => toggle(k)} className="w-4 h-4 accent-emerald-600" />
              <span className="text-sm font-medium text-slate-700 flex-1">{PERMISSION_LABELS[k]}</span>
              {perms[k]
                ? <span className="text-xs text-emerald-600 font-bold">✓ مفعّل</span>
                : <span className="text-xs text-slate-400">معطّل</span>}
            </label>
          ))}
        </div>
        <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={save} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">💾 حفظ</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// مودال الأقسام المسموح بها ✅ جديد
// ──────────────────────────────────────────────
function DepartmentsModal({ user, allDepartments, onClose, onSave, session }: {
  user: User;
  allDepartments: string[];
  onClose: () => void;
  onSave: () => void;
  session: Session;
}) {
  const [selected, setSelected] = useState<string[]>(user.allowedDepartments || []);
  const [search, setSearch] = useState("");

  const toggle = (dep: string) => {
    setSelected((prev) =>
      prev.includes(dep) ? prev.filter((d) => d !== dep) : [...prev, dep]
    );
  };

  const selectAll = () => setSelected([...allDepartments]);
  const clearAll = () => setSelected([]);

  const filtered = allDepartments.filter((d) =>
    d.toLowerCase().includes(search.toLowerCase())
  );

  const save = () => {
    updateUserDepartments(user.id, selected);
    addLog(session, "update_permissions",
      `تحديث أقسام: ${user.fullName} — ${selected.length === 0 ? "كل الأقسام" : selected.join("، ")}`
    );
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">🏢 الأقسام المسموح بها</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.fullName} • @{user.username}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-100 rounded text-slate-500">✕</button>
        </div>

        {/* Info */}
        <div className="px-5 pt-4 pb-2 space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <p className="font-bold mb-1">ℹ️ كيف تعمل؟</p>
            <p>• <strong>بدون تحديد أقسام</strong> = يرى كل موظفي الديوان</p>
            <p>• <strong>مع تحديد أقسام</strong> = يرى موظفي الأقسام المحددة فقط</p>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-2">
            <button onClick={selectAll}
              className="flex-1 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium">
              ✓ تحديد الكل ({allDepartments.length})
            </button>
            <button onClick={clearAll}
              className="flex-1 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium">
              ✗ إلغاء الكل (يرى الكل)
            </button>
          </div>

          {/* البحث */}
          <input type="text" placeholder="🔍 ابحث عن قسم..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" />

          <p className="text-xs text-slate-500">
            محدد: <strong className="text-amber-700">{selected.length}</strong> من {allDepartments.length} قسم
            {selected.length === 0 && <span className="text-emerald-600 mr-2">← يرى كل الأقسام</span>}
          </p>
        </div>

        {/* قائمة الأقسام */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">لا توجد أقسام</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((dep) => (
                <label key={dep} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  selected.includes(dep)
                    ? "bg-amber-50 border-amber-300"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}>
                  <input type="checkbox" checked={selected.includes(dep)} onChange={() => toggle(dep)}
                    className="w-4 h-4 accent-amber-600" />
                  <span className="text-sm font-medium text-slate-700 flex-1">{dep}</span>
                  {selected.includes(dep) && <span className="text-xs text-amber-600 font-bold">✓</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2 bg-white">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm">إلغاء</button>
          <button onClick={save} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium">
            💾 حفظ الأقسام
          </button>
        </div>
      </div>
    </div>
  );
}
