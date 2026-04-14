"use client";

import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

export function useHolidays(year: number) {
  const [data, setData] = useState<Record<string, string>>({});
  useEffect(() => {
    apiClient<Array<{ date: string; name: string }>>(`/api/holidays?year=${year}`)
      .then((rows) => {
        const map: Record<string, string> = {};
        rows.forEach((r) => {
          map[String(r.date).slice(0, 10)] = r.name;
        });
        setData(map);
      })
      .catch(() => {});
  }, [year]);
  return data;
}
