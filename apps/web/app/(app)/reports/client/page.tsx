"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ClientLite { id: string; name: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Hoy en local (sin desfase UTC).
function todayLocalISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

// Lunes (ISO) de la semana que contiene la fecha dada.
function isoMondayOf(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00`);
  const dow = d.getDay() || 7; // domingo=0 → 7
  if (dow !== 1) d.setDate(d.getDate() - (dow - 1));
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

function isoFridayOf(mondayStr: string): string {
  const d = new Date(`${mondayStr}T00:00:00`);
  d.setDate(d.getDate() + 4);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

function formatDateEs(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

// Número de semana ISO 8601 — el lunes ya es el inicio de su semana.
function isoWeekNumber(mondayIso: string): number {
  const d = new Date(`${mondayIso}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function Page() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientFilter, setClientFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const todayIso = useMemo(() => todayLocalISO(), []);
  const today = useMemo(() => new Date(`${todayIso}T00:00:00`), [todayIso]);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Default: lunes de la semana actual / mes y año actuales.
  const [weekDate, setWeekDate] = useState<string>(() => isoMondayOf(todayIso));
  const [monthYear, setMonthYear] = useState<number>(currentYear);
  const [monthNum, setMonthNum] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);

  const monday = isoMondayOf(weekDate);
  const friday = isoFridayOf(monday);
  const weekNum = isoWeekNumber(monday);

  const monthIsFuture =
    monthYear > currentYear || (monthYear === currentYear && monthNum > currentMonth);
  const yearIsFuture = year > currentYear;

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = 2024; y <= currentYear; y++) out.push(y);
    return out;
  }, [currentYear]);

  useEffect(() => {
    apiClient<ClientLite[] | { clients?: ClientLite[] }>("/api/clients")
      .then((res) => {
        if (Array.isArray(res)) setClients(res);
        else if (Array.isArray(res?.clients)) setClients(res.clients);
        else setClients([]);
      })
      .catch(() => setClients([]));
  }, []);

  async function downloadPptx(type: "weekly" | "monthly" | "yearly") {
    setDownloading(type);
    setError("");
    try {
      const suffix = clientFilter
        ? (clients.find((c) => c.id === clientFilter)?.name || "cliente").replace(/[^a-zA-Z0-9_-]+/g, "_")
        : "todos";
      const params = new URLSearchParams();
      if (clientFilter) params.set("clientId", clientFilter);

      let path: string;
      let filename: string;

      if (type === "weekly") {
        params.set("weekStart", monday);
        path = `/api/reports/weekly-pptx?${params.toString()}`;
        filename = `Avance_Semanal_QA_${suffix}_${monday}.pptx`;
      } else if (type === "monthly") {
        const month = `${monthYear}-${String(monthNum).padStart(2, "0")}`;
        params.set("month", month);
        path = `/api/reports/monthly-pptx?${params.toString()}`;
        filename = `Avance_Mensual_QA_${suffix}_${month}.pptx`;
      } else {
        params.set("year", String(year));
        path = `/api/reports/yearly-pptx?${params.toString()}`;
        filename = `Avance_Anual_QA_${suffix}_${year}.pptx`;
      }

      const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const data = await res.json(); msg = data?.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al generar el PPTX";
      setError(msg);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1F3864] mb-4">Reportes por cliente</h1>

      {/* Exportar Reportes PPTX */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Reportes QA (PPTX)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Genera un PPTX con proyectos activos, métricas y gráficos. Selecciona el periodo a reportar.
        </p>

        {/* Cliente */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Cliente</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]"
              style={{ minWidth: 260 }}
            >
              <option value="">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Periodo: 3 bloques (semanal / mensual / anual) */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Semanal */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Reporte semanal</p>
            <label className="block text-[11px] text-gray-600 mb-1">Cualquier día de la semana</label>
            <input
              type="date"
              value={weekDate}
              max={todayIso}
              onChange={(e) => e.target.value && setWeekDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]"
            />
            <p className="mt-2 text-[11px] text-gray-500">
              Semana ISO {weekNum}: {formatDateEs(monday)} – {formatDateEs(friday)}
            </p>
            <button
              type="button"
              onClick={() => downloadPptx("weekly")}
              disabled={!!downloading}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition shadow-sm disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading === "weekly" ? "Generando…" : "Descargar semanal"}
            </button>
          </div>

          {/* Mensual */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Reporte mensual</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">Mes</label>
                <select
                  value={monthNum}
                  onChange={(e) => setMonthNum(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]"
                >
                  {MONTH_NAMES_ES.map((n, i) => {
                    const isFuture = monthYear === currentYear && i + 1 > currentMonth;
                    return (
                      <option key={i} value={i + 1} disabled={isFuture}>{n}</option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">Año</label>
                <select
                  value={monthYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setMonthYear(y);
                    if (y === currentYear && monthNum > currentMonth) setMonthNum(currentMonth);
                  }}
                  className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              {MONTH_NAMES_ES[monthNum - 1]} {monthYear}
            </p>
            <button
              type="button"
              onClick={() => downloadPptx("monthly")}
              disabled={!!downloading || monthIsFuture}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#2E5FA3] rounded-lg hover:bg-[#1F3864] transition shadow-sm disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {downloading === "monthly" ? "Generando…" : "Descargar mensual"}
            </button>
          </div>

          {/* Anual */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Reporte anual</p>
            <label className="block text-[11px] text-gray-600 mb-1">Año</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5FA3]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-gray-500">Año {year}</p>
            <button
              type="button"
              onClick={() => downloadPptx("yearly")}
              disabled={!!downloading || yearIsFuture}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#22C55E] rounded-lg hover:bg-[#16A34A] transition shadow-sm disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {downloading === "yearly" ? "Generando…" : "Descargar anual"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

      {/* Listado de clientes para ir al reporte mensual */}
      <h2 className="text-sm font-semibold text-gray-800 mb-2">Reporte mensual por cliente</h2>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c) => (
          <li key={c.id}>
            <Link
              href={`/reports/client/${c.id}`}
              className="block rounded-lg border bg-white p-4 shadow-sm hover:bg-gray-50"
            >
              <span className="font-medium text-[#1F3864]">{c.name}</span>
              <span className="ml-2 text-sm text-gray-500">
                Ver reporte mensual →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
