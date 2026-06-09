// ============================================================
// Dashboard.tsx - الهيكل العام للوحة التحكم
// ============================================================

import { useState, useEffect } from "react";
import { type Session, addLog } from "../lib/storage";
import { getDeleteRequests } from "../data/employees";
import { NACC_LOGO, SYSTEM_NAME } from "../constants";
import { type TabName } from "../types";

// تمديد TabName ليشمل تبويب "حول النظام"
type ExtendedTabName = TabName | "about";

// استيراد التبويبات - كل تبويب في ملفه المستقل
import { EmployeesTab } from "./tabs/EmployeesTab";
import { ReportsTab } from "./tabs/ReportsTab";
import { CodesTab } from "./tabs/CodesTab";
import { DeleteRequestsTab } from "./tabs/DeleteRequestsTab";
import { ArchiveTab } from "./tabs/ArchiveTab";
import { UsersTab } from "./tabs/UsersTab";
import { LogsTab } from "./tabs/LogsTab";
import { FieldsTab } from "./tabs/FieldsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { AboutTab } from "./tabs/AboutTab";

// ──────────────────────────────────────────────
// Dashboard الرئيسي
// ──────────────────────────────────────────────
export function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<ExtendedTabName>("employees");
  const perms = session.permissions;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-100">
      <DashboardHeader session={session} onLogout={onLogout} tab={tab} setTab={setTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {tab === "employees" && <EmployeesTab session={session} />}
        {tab === "reports" && <ReportsTab session={session} />}
        {tab === "codes" && perms.canManageUsers && <CodesTab session={session} />}
        {tab === "delete_requests" && (perms.canRequestDelete || perms.canApproveDelete) && (
          <DeleteRequestsTab session={session} />
        )}
        {tab === "archive" && (perms.canViewArchive || perms.canRestoreArchive) && (
          <ArchiveTab session={session} />
        )}
        {tab === "users" && perms.canManageUsers && <UsersTab session={session} />}
        {tab === "logs" && perms.canViewLogs && <LogsTab />}
        {tab === "fields" && perms.canAddFields && <FieldsTab session={session} />}
        {tab === "settings" && <SettingsTab session={session} />}
        {tab === "about" && <AboutTab />}
      </main>

      <footer className="border-t border-slate-200 bg-slate-900 text-white mt-6 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="text-xs">
            <span className="opacity-70">نظام إدارة بيانات موظفي ديوان المنطقة الغربية</span>
            <span className="mx-2 opacity-50">|</span>
            <span className="opacity-70">تصميم:</span>
            <span className="font-bold mr-1 text-amber-400 tracking-wider">{SYSTEM_NAME}</span>
          </p>
          <p className="text-[10px] opacity-50">
            © {new Date().getFullYear()} الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
          </p>
        </div>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────
// شريط التنقل العلوي
// ──────────────────────────────────────────────
function DashboardHeader({
  session,
  onLogout,
  tab,
  setTab,
}: {
  session: Session;
  onLogout: () => void;
  tab: ExtendedTabName;
  setTab: (t: ExtendedTabName) => void;
}) {
  const perms = session.permissions;
  const [pendingDeletes, setPendingDeletes] = useState(0);

  useEffect(() => {
    if (!perms.canApproveDelete) return;
    let mounted = true;

    const loadPending = async () => {
      const requests = await getDeleteRequests();
      if (mounted) {
        setPendingDeletes(requests.filter((r) => r.status === "قيد المراجعة").length);
      }
    };

    loadPending();
    const timer = window.setInterval(loadPending, 15000);
    window.addEventListener("delete-requests-changed", loadPending);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("delete-requests-changed", loadPending);
    };
  }, [perms.canApproveDelete]);

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* الصف العلوي */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={NACC_LOGO} alt="NACC" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-base font-bold text-slate-900">
                {session.role === "admin" ? "لوحة تحكم المدير" : "نظام إدارة الموظفين"}
              </h1>
              <p className="text-[11px] text-slate-500">
                الهيئة الوطنية لمكافحة الفساد - ديوان المنطقة الغربية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-left ml-2 hidden sm:block">
              <p className="text-xs font-bold text-slate-700">{session.fullName}</p>
              <p className="text-[10px] text-slate-400">
                {session.role === "admin" ? "👑 مدير" : "👤 موظف"} • @{session.username}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              خروج
            </button>
          </div>
        </div>

        {/* التبويبات */}
        <div className="flex gap-1 mt-3 -mb-3 overflow-x-auto">
          <TabBtn active={tab === "employees"} onClick={() => setTab("employees")} icon="👥">
            الموظفين
          </TabBtn>
          <TabBtn active={tab === "reports"} onClick={() => setTab("reports")} icon="📈">
            التقارير
          </TabBtn>
          {perms.canManageUsers && (
            <TabBtn active={tab === "codes"} onClick={() => setTab("codes")} icon="🔑">
              أكواد الموظفين
            </TabBtn>
          )}
          {(perms.canRequestDelete || perms.canApproveDelete) && (
            <TabBtn active={tab === "delete_requests"} onClick={() => setTab("delete_requests")} icon="📋">
              طلبات الحذف
              {pendingDeletes > 0 && (
                <span className="mr-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {pendingDeletes}
                </span>
              )}
            </TabBtn>
          )}
          {(perms.canViewArchive || perms.canRestoreArchive) && (
            <TabBtn active={tab === "archive"} onClick={() => setTab("archive")} icon="🗄️">
              أرشيف الموظفين
            </TabBtn>
          )}
          {perms.canManageUsers && (
            <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon="🔐">
              المستخدمين
            </TabBtn>
          )}
          {perms.canViewLogs && (
            <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon="📊">
              السجلات
            </TabBtn>
          )}
          {perms.canAddFields && (
            <TabBtn active={tab === "fields"} onClick={() => setTab("fields")} icon="➕">
              الحقول المخصصة
            </TabBtn>
          )}
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon="⚙️">
            الإعدادات
          </TabBtn>
          <TabBtn active={tab === "about"} onClick={() => setTab("about")} icon="ℹ️">
            حول النظام
          </TabBtn>
        </div>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────
// زر التبويب
// ──────────────────────────────────────────────
function TabBtn({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <span>{icon}</span>
      <span>{children}</span>
    </button>
  );
}
