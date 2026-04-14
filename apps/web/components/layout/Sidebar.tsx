"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  {
    label: "Mi semana",
    href: "/mi-semana",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Proyectos",
    href: "/projects",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: "Equipo",
    href: "/equipo",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Reportes por cliente",
    href: "/reports/client",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6h13M9 17H4V5a1 1 0 011-1h3l2 2h10v5M9 17l3-3m0 0l3 3m-3-3v6" />
      </svg>
    ),
  },
  {
    label: "Importar Excel",
    href: "/records/import",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    label: "Usuarios",
    href: "/users",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: "Asignaciones",
    href: "/assignments",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { user } = useAuth();
  const roleName = user?.role?.name;
  const isAnalyst = roleName === "QA_ANALYST";
  const isClientPm = roleName === "CLIENT_PM";

  const visibleItems = navItems
    .filter(item => {
      // QA_ANALYST: solo "Mi semana"
      if (isAnalyst) return item.href === "/mi-semana";
      // CLIENT_PM: solo proyectos, dashboard y reportes por cliente
      if (isClientPm) return ["/projects", "/dashboard", "/reports/client"].includes(item.href);
      // Líderes no ven "Mi semana" (no aplica a su rol)
      if (item.href === "/mi-semana") return false;
      if (item.href === "/users") return can("users", "read");
      if (item.href === "/assignments") return can("assignments", "read");
      return true;
    })
    .map(item => isClientPm && item.href === "/projects" ? { ...item, label: "Mis Proyectos" } : item);

  return (
    <aside
      className="w-64 min-h-screen flex flex-col relative"
      style={{
        background: "linear-gradient(180deg, #0D1B2A 0%, #1B2D4A 100%)",
        boxShadow: "inset 0 8px 16px -4px rgba(0,0,0,0.3)",
      }}
    >
      {/* Logo area */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex flex-col items-start">
          <span className="text-[28px] font-bold text-white leading-none">
            QA
          </span>
          <div
            className="mt-2 mb-2"
            style={{
              width: 24,
              height: 1,
              backgroundColor: "#4A90D9",
            }}
          />
          <span
            className="text-[11px] font-medium text-white/70 uppercase"
            style={{ letterSpacing: "0.2em" }}
          >
            METRICS
          </span>
        </div>
      </div>

      {/* Gradient divider */}
      <div
        className="mx-4 mb-2"
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
        }}
      />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-none ${
                isActive
                  ? "bg-white/5 text-white border-l-[3px] border-l-[#4A90D9]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border-l-[3px] border-l-transparent"
              }`}
            >
              {/* Hover indicator dot */}
              <span
                className={`absolute left-3 w-1 h-1 rounded-full bg-[#4A90D9] transition-opacity duration-200 ${
                  isActive
                    ? "opacity-0"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              />
              <span className="ml-2">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Configuracion section */}
      {!isAnalyst && !isClientPm && can("roles", "read") && (
        <div className="px-3 pb-3">
          <div
            className="mx-1 mb-2"
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
            }}
          />
          <span
            className="px-4 mb-1 block text-[10px] font-semibold text-white/30 uppercase"
            style={{ letterSpacing: "0.15em" }}
          >
            Configuracion
          </span>
          <Link
            href="/settings/roles"
            className={`group relative flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-none ${
              pathname.startsWith("/settings/roles")
                ? "bg-white/5 text-white border-l-[3px] border-l-[#4A90D9]"
                : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border-l-[3px] border-l-transparent"
            }`}
          >
            <span
              className={`absolute left-3 w-1 h-1 rounded-full bg-[#4A90D9] transition-opacity duration-200 ${
                pathname.startsWith("/settings/roles")
                  ? "opacity-0"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            />
            <span className="ml-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            Roles y Permisos
          </Link>
        </div>
      )}

      {/* Version footer */}
      <div className="px-6 pb-6">
        <span className="text-[10px] font-mono text-white/20">v1.0</span>
      </div>
    </aside>
  );
}
