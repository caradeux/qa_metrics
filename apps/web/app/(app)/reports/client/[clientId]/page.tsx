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
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    apiClient(`/api/reports/client/${clientId}/monthly?months=${months}`)
      .then(setData)
      .catch((e) => setError(e.message ?? "Error"));
  }, [clientId, months]);

  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6">Cargando reporte…</div>;
  return (
    <ClientMonthlyReport
      data={data}
      months={months}
      onChangeMonths={setMonths}
    />
  );
}
