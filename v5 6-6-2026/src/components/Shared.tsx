import React from "react";

export function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const colors: Record<string, string> = { slate: "from-slate-50 to-slate-100 border-slate-200 text-slate-800", emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-800", red: "from-red-50 to-red-100 border-red-200 text-red-800", blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-800", indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-800", pink: "from-pink-50 to-pink-100 border-pink-200 text-pink-800", amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-800", cyan: "from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-800", orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-800" };
  return (<div className={`bg-gradient-to-br ${colors[color] || colors.slate} border rounded-xl p-2`}><div className="flex items-center gap-1.5"><span className="text-base">{icon}</span><div><p className="text-sm font-bold">{value}</p><p className="text-[9px] opacity-70 whitespace-nowrap">{label}</p></div></div></div>);
}

export function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (<th onClick={onClick} className={`px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 whitespace-nowrap ${onClick ? "cursor-pointer hover:bg-slate-100 select-none" : ""}`}>{children}</th>);
}

export function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey: string; sortDir: string }) {
  if (sortKey !== column) return <span className="text-slate-300 mr-1">⇅</span>;
  return <span className="text-indigo-600 mr-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export function PageBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (<button onClick={onClick} disabled={disabled} className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-medium transition ${active ? "bg-indigo-600 text-white shadow-sm" : disabled ? "text-slate-300 cursor-not-allowed" : "text-slate-600 hover:bg-slate-200 bg-slate-100"}`}>{children}</button>);
}

export function Pagination({ currentPage, totalPages, onChange }: { currentPage: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between bg-slate-50/50">
      <p className="text-[11px] text-slate-500">صفحة {currentPage} من {totalPages}</p>
      <div className="flex items-center gap-0.5">
        <PageBtn onClick={() => onChange(1)} disabled={currentPage === 1}>⟪</PageBtn>
        <PageBtn onClick={() => onChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>⟨</PageBtn>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => { let page: number; if (totalPages <= 5) page = i + 1; else if (currentPage <= 3) page = i + 1; else if (currentPage >= totalPages - 2) page = totalPages - 4 + i; else page = currentPage - 2 + i; return <PageBtn key={page} onClick={() => onChange(page)} active={page === currentPage}>{page}</PageBtn>; })}
        <PageBtn onClick={() => onChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>⟩</PageBtn>
        <PageBtn onClick={() => onChange(totalPages)} disabled={currentPage === totalPages}>⟫</PageBtn>
      </div>
    </div>
  );
}

export function getStatusBadge(s: string): string {
  switch (s) {
    case "مستوفي": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ناقص": return "bg-amber-100 text-amber-800 border-amber-200";
    case "تحت الاجراء": return "bg-blue-100 text-blue-800 border-blue-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function getDataCompleteBadge(v: string): string {
  if (v === "نعم مكتملة") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "غير مكتملة") return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
}
