"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type Section = {
  key: string;
  title?: string;   // undefined = sin encabezado (sección principal superior)
  items: NavItem[];
};

// ───── Iconos ─────
const iconCalendar = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const iconDashboard = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const iconClipboard = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const iconGantt = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h10M8 12h6M8 17h8M4 7h.01M4 12h.01M4 17h.01" />
  </svg>
);
const iconBuilding = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const iconFolder = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const iconUsers = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const iconUserSingle = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const iconReport = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-6h13M9 17H4V5a1 1 0 011-1h3l2 2h10v5M9 17l3-3m0 0l3 3m-3-3v6" />
  </svg>
);
const iconGear = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const iconClock = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const iconChartBar = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const iconTag = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

export function Sidebar() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const { user } = useAuth();
  const roleName = user?.role?.name;
  const isAnalyst = roleName === "QA_ANALYST";
  const isClientPm = roleName === "CLIENT_PM";

  // ───── Armar secciones según rol/permisos ─────
  const sections: Section[] = [];

  if (isAnalyst) {
    // QA_ANALYST: vista simplificada
    sections.push({
      key: "work",
      items: [
        { label: "Mi semana", href: "/mi-semana", icon: iconCalendar },
        { label: "Planificación", href: "/gantt", icon: iconGantt },
        { label: "Asignaciones", href: "/assignments", icon: iconUsers },
        { label: "Proyectos", href: "/projects", icon: iconFolder },
      ],
    });
  } else if (isClientPm) {
    // CLIENT_PM: solo lectura
    sections.push({
      key: "client",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: iconDashboard },
        { label: "Mis Proyectos", href: "/projects", icon: iconFolder },
        { label: "Planificación", href: "/gantt", icon: iconGantt },
        { label: "Reportes", href: "/reports/client", icon: iconReport },
      ],
    });
  } else {
    // ADMIN / QA_LEAD
    sections.push({
      key: "overview",
      title: "Visión General",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: iconDashboard },
      ],
    });

    const operacion: NavItem[] = [];
    if (can("assignments", "read")) {
      operacion.push({ label: "Planificación", href: "/gantt", icon: iconGantt });
      operacion.push({ label: "Asignaciones", href: "/assignments", icon: iconUsers });
    }
    operacion.push({ label: "Registro Diario", href: "/equipo", icon: iconClipboard });
    if (operacion.length > 0) {
      sections.push({ key: "operacion", title: "Operación", items: operacion });
    }

    const gestion: NavItem[] = [
      { label: "Clientes", href: "/clients", icon: iconBuilding },
      { label: "Proyectos", href: "/projects", icon: iconFolder },
    ];
    if (can("users", "read")) {
      gestion.push({ label: "Usuarios", href: "/users", icon: iconUserSingle });
    }
    sections.push({ key: "gestion", title: "Gestión", items: gestion });

    if (can("reports", "read")) {
      const reportItems: NavItem[] = [
        { label: "Por cliente", href: "/reports/client", icon: iconReport },
        { label: "Por tester", href: "/reports/testers", icon: iconUsers },
        { label: "Conglomerado por HU", href: "/reports/stories", icon: iconReport },
      ];
      if (can("activities", "read")) {
        reportItems.push({ label: "Ocupación", href: "/reports/occupation", icon: iconChartBar });
      }
      sections.push({
        key: "reportes",
        title: "Reportes",
        items: reportItems,
      });
    }

    // Configuración (última)
    const config: NavItem[] = [];
    if (can("roles", "read")) {
      config.push({ label: "Roles y Permisos", href: "/settings/roles", icon: iconGear });
    }
    if (can("activity-categories", "update")) {
      config.push({ label: "Categorías de actividad", href: "/settings/activity-categories", icon: iconTag });
    }
    if (can("holidays", "read")) {
      config.push({ label: "Feriados", href: "/settings/holidays", icon: iconCalendar });
    }
    if (can("audit", "read")) {
      config.push({ label: "Auditoría de fechas", href: "/audit", icon: iconClock });
    }
    if (config.length > 0) {
      sections.push({ key: "config", title: "Configuración", items: config });
    }
  }

  const renderLink = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group relative flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-none ${
          isActive
            ? "bg-white/5 text-white border-l-[3px] border-l-[#4A90D9]"
            : "text-white/50 hover:text-white/80 hover:bg-white/[0.03] border-l-[3px] border-l-transparent"
        }`}
      >
        <span
          className={`absolute left-3 w-1 h-1 rounded-full bg-[#4A90D9] transition-opacity duration-200 ${
            isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
          }`}
        />
        <span className="ml-2 shrink-0">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      className="w-64 shrink-0 min-h-screen flex flex-col relative"
      style={{
        width: 256,
        minWidth: 256,
        maxWidth: 256,
        background: "linear-gradient(180deg, #0D1B2A 0%, #1B2D4A 100%)",
        boxShadow: "inset 0 8px 16px -4px rgba(0,0,0,0.3)",
      }}
    >
      {/* Logo area */}
      <div className="px-6 pt-7 pb-4">
        <div className="flex flex-col items-start">
          <span className="text-[28px] font-bold text-white leading-none">QA</span>
          <div className="mt-2 mb-2" style={{ width: 24, height: 1, backgroundColor: "#4A90D9" }} />
          <span className="text-[11px] font-medium text-white/70 uppercase" style={{ letterSpacing: "0.2em" }}>
            METRICS
          </span>
        </div>
      </div>

      {/* Gradient divider */}
      <div
        className="mx-4 mb-1"
        style={{
          height: 1,
          background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, transparent 100%)",
        }}
      />

      {/* Navigation con secciones */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {sections.map((sec, idx) => (
          <div key={sec.key} className={idx > 0 ? "mt-4" : ""}>
            {sec.title && (
              <div className="px-4 mb-1.5 flex items-center gap-2">
                <span
                  className="block text-[9px] font-semibold text-white/30 uppercase"
                  style={{ letterSpacing: "0.18em" }}
                >
                  {sec.title}
                </span>
                <span className="flex-1 h-px bg-white/10" />
              </div>
            )}
            <div className="space-y-0.5">
              {sec.items.map(renderLink)}
            </div>
          </div>
        ))}
      </nav>

      {/* Version footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/20">v1.0</span>
          {user?.name && (
            <span className="text-[10px] font-medium text-white/40 truncate ml-2">
              {user.name}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
