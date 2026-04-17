"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ClientLite { id: string; name: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Page() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientFilter, setClientFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient<any>("/api/clients")
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
      const clientQs = clientFilter ? `clientId=${encodeURIComponent(clientFilter)}` : "";
      let path: string;
      let filename: string;
      const suffix = clientFilter
        ? (clients.find((c) => c.id === clientFilter)?.name || "cliente").replace(/[^a-zA-Z0-9_-]+/g, "_")
        : "todos";
      const now = new Date();

      if (type === "weekly") {
        path = `/api/reports/weekly-pptx${clientQs ? `?${clientQs}` : ""}`;
        filename = `Avance_Semanal_QA_${suffix}_${now.toISOString().slice(0, 10)}.pptx`;
      } else if (type === "monthly") {
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        path = `/api/reports/monthly-pptx?month=${month}${clientQs ? `&${clientQs}` : ""}`;
        filename = `Avance_Mensual_QA_${suffix}_${month}.pptx`;
      } else {
        path = `/api/reports/yearly-pptx?year=${now.getFullYear()}${clientQs ? `&${clientQs}` : ""}`;
        filename = `Avance_Anual_QA_${suffix}_${now.getFullYear()}.pptx`;
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
    } catch (err: any) {
      setError(err?.message || "Error al generar el PPTX");
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
          Genera un PPTX con proyectos activos, métricas y gráficos. Las observaciones quedan en blanco para que las completes al presentar.
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-3">
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
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadPptx("weekly")}
            disabled={!!downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition shadow-sm disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading === "weekly" ? "Generando…" : "Semanal"}
          </button>
          <button
            type="button"
            onClick={() => downloadPptx("monthly")}
            disabled={!!downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2E5FA3] rounded-lg hover:bg-[#1F3864] transition shadow-sm disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {downloading === "monthly" ? "Generando…" : "Mensual"}
          </button>
          <button
            type="button"
            onClick={() => downloadPptx("yearly")}
            disabled={!!downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#22C55E] rounded-lg hover:bg-[#16A34A] transition shadow-sm disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {downloading === "yearly" ? "Generando…" : "Anual"}
          </button>
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
