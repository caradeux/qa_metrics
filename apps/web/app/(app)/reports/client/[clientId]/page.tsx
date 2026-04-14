"use client";
import { use, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { ClientMonthlyReport } from "@/components/reports/ClientMonthlyReport";

export default function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const [mode, setMode] = useState<"monthly" | "weekly">("monthly");
  const [months, setMonths] = useState(6);
  const [weeks, setWeeks] = useState(8);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const path =
      mode === "monthly"
        ? `/api/reports/client/${clientId}/monthly?months=${months}`
        : `/api/reports/client/${clientId}/weekly?weeks=${weeks}`;
    apiClient(path)
      .then((d: any) => {
        // normalize: ensure `labels` exists
        if (d && !d.labels) d.labels = d.months ?? d.weeks ?? [];
        setData(d);
      })
      .catch((e) => setError(e.message ?? "Error"));
  }, [clientId, mode, months, weeks]);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6">Cargando reporte…</div>;
  return (
    <ClientMonthlyReport
      data={data}
      mode={mode}
      months={months}
      weeks={weeks}
      onChangeMode={setMode}
      onChangeMonths={setMonths}
      onChangeWeeks={setWeeks}
    />
  );
}
