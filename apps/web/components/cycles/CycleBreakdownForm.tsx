"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

const FIELDS: [string, string][] = [
  ["designedFunctional", "Diseñados Funcional"],
  ["designedRegression", "Diseñados Regresión"],
  ["designedSmoke", "Diseñados Humo"],
  ["designedExploratory", "Diseñados Exploratorio"],
  ["executedFunctional", "Ejecutados Funcional"],
  ["executedRegression", "Ejecutados Regresión"],
  ["executedSmoke", "Ejecutados Humo"],
  ["executedExploratory", "Ejecutados Exploratorio"],
  ["defectsCritical", "Defectos Crítico"],
  ["defectsHigh", "Defectos Alto"],
  ["defectsMedium", "Defectos Medio"],
  ["defectsLow", "Defectos Bajo"],
];

export function CycleBreakdownForm({ cycleId }: { cycleId: string }) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, 0]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient<Record<string, number>>(`/api/cycles/${cycleId}/breakdown`)
      .then((bd) => setValues((v) => ({ ...v, ...bd })))
      .catch(() => {
        /* 404 = sin breakdown aún, quedamos en ceros */
      });
  }, [cycleId]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    const payload = Object.fromEntries(
      FIELDS.map(([k]) => [k, Number(values[k] ?? 0)])
    );
    try {
      await apiClient(`/api/cycles/${cycleId}/breakdown`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="flex flex-col text-sm">
            <span className="mb-1 text-gray-700">{label}</span>
            <input
              type="number"
              min={0}
              value={values[key] ?? 0}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: Number(e.target.value) }))
              }
              className="rounded border border-gray-300 p-1"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-[#1F3864] px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar desglose"}
        </button>
        {saved && <span className="text-xs text-green-700">✓ Guardado</span>}
      </div>
    </div>
  );
}
