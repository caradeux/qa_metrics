"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAttention } from "@/hooks/useAttention";

export function Header() {
  const { user, logout } = useAuth();
  const { eligible, count, openDialog } = useAttention();

  const userName = user?.name ?? "Usuario";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Left side - breadcrumb area */}
      <div />

      {/* Right side - user info */}
      <div className="flex items-center gap-3">
        {/* Campana: temas que requieren gestión */}
        {eligible && (
          <button
            onClick={openDialog}
            className="relative w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={count > 0 ? `${count} tema(s) requieren gestión` : "Sin temas pendientes"}
            aria-label="Temas que requieren gestión"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        )}

        {/* Separator dot */}
        <span className="w-1 h-1 rounded-full bg-gray-300" />

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#1F3864]/10 flex items-center justify-center">
          <span className="text-xs font-semibold text-[#1F3864]">
            {initials}
          </span>
        </div>

        <span className="text-sm font-medium text-gray-700">{userName}</span>

        {/* Separator dot */}
        <span className="w-1 h-1 rounded-full bg-gray-300" />

        <button
          onClick={() => logout()}
          className="text-sm text-gray-400 hover:text-red-500 transition-colors duration-200 font-medium"
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  );
}
