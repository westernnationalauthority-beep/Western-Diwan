// ============================================================
// App.tsx - نقطة الدخول الرئيسية للمنظومة
// تم تقسيم المنطق إلى ملفات منفصلة لسهولة الصيانة
// ============================================================

import { useState } from "react";
import { type User, type Session } from "./lib/storage";
import { type EmployeeLoginResult } from "./data/employees";
import { getSession, setSession, addLog } from "./lib/storage";
import { ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS } from "./lib/storage";
import { AuthScreen } from "./components/AuthScreen";
import { Dashboard } from "./components/Dashboard";
import { PublicEmployeeView } from "./components/PublicEmployeeView";
import { type Employee } from "./data/employees";

export default function App() {
  const [session, setSessionState] = useState<Session | null>(() => getSession());
  const [publicEmployee, setPublicEmployee] = useState<Employee | null>(null);
  const [loginResult, setLoginResult] = useState<(EmployeeLoginResult & { employee?: Employee }) | null>(null);

  const handleLogin = (user: User) => {
    const s: Session = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions || (user.role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_EMPLOYEE_PERMISSIONS),
      loginTime: new Date().toISOString(),
      allowedDepartments: user.allowedDepartments || [],
    };
    setSession(s);
    setSessionState(s);
    addLog(s, "login", `تسجيل دخول - ${user.role === "admin" ? "حساب مدير" : "حساب موظف"}`);
  };

  const handleLogout = () => {
    if (session) addLog(session, "logout", "تسجيل خروج");
    setSession(null);
    setSessionState(null);
  };

  const handleEmployeeLoginResult = (result: EmployeeLoginResult & { employee?: Employee }) => {
    setLoginResult(result);
    if (result.employee) setPublicEmployee(result.employee);
  };

  if (publicEmployee && loginResult) {
    return (
      <PublicEmployeeView
        employee={publicEmployee}
        loginResult={loginResult}
        onBack={() => {
          setPublicEmployee(null);
          setLoginResult(null);
        }}
      />
    );
  }

  if (!session) {
    return <AuthScreen onLogin={handleLogin} onPublicView={handleEmployeeLoginResult} />;
  }

  return <Dashboard session={session} onLogout={handleLogout} />;
}
