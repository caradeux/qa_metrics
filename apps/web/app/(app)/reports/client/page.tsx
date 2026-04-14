"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function Page() {
  const [clients, setClients] = useState<any[]>([]);
  useEffect(() => {
    apiClient<any>("/api/clients")
      .then((res) => {
        // apiClient may return either an array or { clients: [...] }
        if (Array.isArray(res)) setClients(res);
        else if (Array.isArray(res?.clients)) setClients(res.clients);
        else setClients([]);
      })
      .catch(() => setClients([]));
  }, []);
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#1F3864]">
        Reportes por cliente
      </h1>
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
