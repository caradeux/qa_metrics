"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ClientLite { id: string; name: string }

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Page() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientFilter, setClientFilter] = useState("");
  const [downloading, setDownloading] = useState(false);
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

  async function downloadWeeklyPptx() {
    setDownloading(true);
    setError("");
    try {
      const qs = clientFilter ? `?clientId=${encodeURIComponent(clientFilter)}` : "";
      // Fetch directo con credentials para traer binario sin pasar por apiClient
      // (apiClient intenta JSON.parse cuando el content-type no matchea su whitelist).
      const res = await fetch(`${API_URL}/api/reports/weekly-pptx${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const data = await res.json();
          msg = data?.error || msg;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const isoWeek = new Date().toISOString().slice(0, 10);
      const suffix = clientFilter
        ? (clients.find((c) => c.id === clientFilter)?.name || "cliente").replace(/[^a-zA-Z0-9_-]+/g, "_")
        : "todos";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Avance_Semanal_QA_${suffix}_${isoWeek}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Error al generar el PPTX");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1F3864] mb-4">Reportes por cliente</h1>

      {/* Exportar Avance Semanal */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Avance Semanal QA (PPTX)</h2>
        <p className="text-xs text-gray-500 mb-3">
          Genera un PPTX con los proyectos que tuvieron actividad esta semana (incluye UAT).
          Las observaciones quedan en blanco para que las completes al presentar.
        </p>
        <div className="flex flex-wrap items-end gap-3">
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
          <button
            type="button"
            onClick={downloadWeeklyPptx}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition shadow-sm disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Generando…" : "Exportar PPTX"}
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
