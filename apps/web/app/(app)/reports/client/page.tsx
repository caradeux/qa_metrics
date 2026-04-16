"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function Page() {
  const [clients, setClients] = useState<any[]>([]);
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
      const blob = await apiClient<Blob>("/api/reports/weekly-pptx");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const isoWeek = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Avance_Semanal_QA_${isoWeek}.pptx`;
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
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[#1F3864]">Reportes por cliente</h1>
        <button
          type="button"
          onClick={downloadWeeklyPptx}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1F3864] rounded-lg hover:bg-[#2E5FA3] transition shadow-sm disabled:opacity-60"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "Generando…" : "Exportar Avance Semanal (PPTX)"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        El PPTX se genera con todos los proyectos con actividad esta semana (incluye UAT). Las observaciones quedan en blanco para que las completes al presentar.
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {clients.map((c: any) => (
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
