"use client";
import { useEffect, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { apiClient } from "@/lib/api-client";

interface DailyActivityResponse {
  weekStart: string;
  days: Array<{
    date: string;
    designed: number;
    executed: number;
    defects: number;
  }>;
}

export function DailyActivityChart({ projectId }: { projectId: string }) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const mondayStr = format(monday, "yyyy-MM-dd");
  const [data, setData] = useState<
    Array<{
      date: string;
      designed: number;
      executed: number;
      defects: number;
      label: string;
    }>
  >([]);

  useEffect(() => {
    apiClient<DailyActivityResponse>(
      `/api/metrics/projects/${projectId}/daily-activity?weekStart=${mondayStr}`
    )
      .then((r) => {
        setData(
          r.days.map((d) => ({
            ...d,
            label: format(new Date(d.date + "T12:00:00"), "EEE d", {
              locale: es,
            }),
          }))
        );
      })
      .catch(() => setData([]));
  }, [projectId, mondayStr]);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-[#1F3864]">
        Actividad diaria (semana actual)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="designed" fill="#1F3864" name="Diseñados" />
          <Bar dataKey="executed" fill="#2E5FA3" name="Ejecutados" />
          <Bar dataKey="defects" fill="#E74C3C" name="Defectos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
