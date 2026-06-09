// ============================================================
// ui.tsx - مكونات واجهة مستخدم مشتركة بين كل التبويبات
// ============================================================

import React from "react";

// ──────────────────────────────────────────────
// Badge الحالة
// ──────────────────────────────────────────────
export function getStatusBadge(s: string): string {
  switch (s) {
    case "مستوفي":   return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ناقص":     return "bg-amber-100 text-amber-800 border-amber-200";
    case "تحت الاجراء": return "bg-blue-100 text-blue-800 border-blue-200";
    default:         return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getDataCompleteBadge(v: string): string {
  if (v === "نعم مكتملة") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "غير مكتملة") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}

// ──────────────────────────────────────────────
// StatCard - بطاقة إحصائية
// ──────────────────────────────────────────────
const STAT_COLORS: Record<string, string> = {
  slate:  "bg-slate-50  border-slate-200  text-slate-700",
  emerald:"bg-emerald-50 border-emerald-200 text-emerald-700",
  red:    "bg-red-50    border-red-200    text-red-700",
  blue:   "bg-blue-50   border-blue-200   text-blue-700",
  amber:  "bg-amber-50  border-amber-200  text-amber-700",
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  pink:   "bg-pink-50   border-pink-200   text-pink-700",
  cyan:   "bg-cyan-50   border-cyan-200   text-cyan-700",
  orange: "bg-orange-50 border-orange-200 text-orange-700",
};

export function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const cls = STAT_COLORS[color] || STAT_COLORS.slate;
  return (
    <div className={`rounded-xl border p-3 text-center ${cls}`}>
      <div className="text-lg">{icon}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
      <div className="text-[10px] font-medium mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Th - خلية رأس الجدول
// ──────────────────────────────────────────────
export function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap ${
        onClick ? "cursor-pointer hover:text-indigo-700 select-none" : ""
      }`}
    >
      {children}
    </th>
  );
}

// ──────────────────────────────────────────────
// SortIcon - أيقونة الترتيب
// ──────────────────────────────────────────────
export function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: string;
  sortKey: string;
  sortDir: "asc" | "desc";
}) {
  if (sortKey !== column) return <span className="text-slate-300 mr-1">⇅</span>;
  return <span className="text-indigo-600 mr-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// ──────────────────────────────────────────────
// Pagination - ترقيم الصفحات
// ──────────────────────────────────────────────
function PageBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 text-xs rounded-lg transition font-medium ${
        active
          ? "bg-indigo-600 text-white shadow"
          : "bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
    return currentPage - 2 + i;
  });

  return (
    <div className="flex items-center justify-center gap-1.5 mt-4">
      <p className="text-[11px] text-slate-500 ml-3">
        صفحة {currentPage} من {totalPages}
      </p>
      <PageBtn onClick={() => onChange(1)} disabled={currentPage === 1}>⟪</PageBtn>
      <PageBtn onClick={() => onChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>⟨</PageBtn>
      {pages.map((page) => (
        <PageBtn key={page} onClick={() => onChange(page)} active={page === currentPage}>
          {page}
        </PageBtn>
      ))}
      <PageBtn onClick={() => onChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>⟩</PageBtn>
      <PageBtn onClick={() => onChange(totalPages)} disabled={currentPage === totalPages}>⟫</PageBtn>
    </div>
  );
}

// ──────────────────────────────────────────────
// DataSection - قسم عرض بيانات الموظف
// ──────────────────────────────────────────────
import { isEmpty } from "../utils";

const SECTION_COLORS: Record<string, string> = {
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  violet: "bg-violet-600",
  cyan: "bg-cyan-600",
};

export function DataSection({
  title,
  color,
  rows,
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
            <div
              key={i}
              className={`grid grid-cols-3 gap-2 px-3 py-2 ${
                i % 2 === 0 ? "bg-slate-50" : "bg-white"
              } border-b border-slate-100 last:border-b-0`}
            >
              <span className="text-xs text-slate-500">{label}</span>
              <span
                className={`col-span-2 text-sm ${empty ? "text-red-500 italic" : "text-slate-800"} ${
                  mono && !empty ? "font-mono" : ""
                }`}
                dir={mono && !empty ? "ltr" : undefined}
              >
                {empty ? "— لم يتم تسجيله —" : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// LoadingSpinner
// ──────────────────────────────────────────────
export function LoadingSpinner({ text = "جاري التحميل..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-4">
        <div className="inline-block h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500">{text}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ErrorCard
// ──────────────────────────────────────────────
export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-red-200 max-w-md mx-auto p-8 text-center space-y-4">
      <div className="text-4xl">❌</div>
      <h2 className="text-lg font-bold text-slate-900">خطأ في التحميل</h2>
      <p className="text-sm text-slate-500">{message}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
