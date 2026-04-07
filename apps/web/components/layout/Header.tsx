"use client";

import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();

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
