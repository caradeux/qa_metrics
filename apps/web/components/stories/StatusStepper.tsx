"use client";

import { STATUSES, statusMap } from "./StatusBadge";

// Camino lineal principal del flujo QA (en orden de `step`).
const MAIN_PATH = ["REGISTERED", "ANALYSIS", "TEST_DESIGN", "WAITING_QA_DEPLOY", "EXECUTION", "UAT", "PRODUCTION"] as const;

// Estados fuera de la secuencia lineal (desvíos / lateral).
const OFF_PATH = ["RETURNED_TO_DEV", "ON_HOLD"] as const;

// Hasta qué `step` se considera "recorrido" cuando el estado activo es un desvío.
// RETURNED_TO_DEV ocurre tras haber llegado a ejecución (paso 5) → marca hasta ahí como hecho.
function progressStepFor(value: string): number {
  if (value === "RETURNED_TO_DEV") return 6; // EXECUTION (5) queda como hecho
  if (value === "ON_HOLD") return 0; // pausa: no afirmamos avance
  return statusMap[value]?.step ?? 1;
}

export function StatusStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange?: (status: string) => void;
  disabled?: boolean;
}) {
  const isOffPath = (OFF_PATH as readonly string[]).includes(value);
  const progress = progressStepFor(value);
  const interactive = !!onChange && !disabled;

  const nodes = MAIN_PATH.map((v) => statusMap[v]).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Camino lineal */}
      <ol className="flex items-start">
        {nodes.map((s, i) => {
          const done = s.step < progress;
          const current = !isOffPath && s.step === progress;
          const filled = done || current;
          const accent = s.color;

          const circleStyle: React.CSSProperties = filled
            ? { backgroundColor: accent, borderColor: accent }
            : {};
          if (current) circleStyle.boxShadow = `0 0 0 4px ${accent}33`;
          const segmentDone = s.step <= progress - 1; // segmento ANTES de este nodo está recorrido

          return (
            <li key={s.value} className="flex-1 flex flex-col items-center relative min-w-0">
              {/* Conector izquierdo */}
              {i > 0 && (
                <span
                  className="absolute top-3.5 right-1/2 left-[-50%] h-0.5 -z-0"
                  style={{ backgroundColor: segmentDone ? accent : "#e5e7eb" }}
                />
              )}
              <button
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onChange!(s.value)}
                title={s.label}
                className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition
                  ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}
                  ${filled ? "text-white" : "bg-white text-gray-400 border-gray-300"}`}
                style={circleStyle}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{s.step}</span>
                )}
              </button>
              <span
                className={`mt-1.5 text-[9px] leading-tight text-center px-0.5 ${
                  current ? "font-bold" : done ? "font-medium text-gray-600" : "text-gray-400"
                }`}
                style={current ? { color: accent } : undefined}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Estados fuera de la secuencia */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Otros:</span>
        {OFF_PATH.map((v) => {
          const s = statusMap[v];
          if (!s) return null;
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onChange!(v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-semibold transition
                ${interactive ? "cursor-pointer hover:border-current" : "cursor-default"}
                ${active ? "text-white shadow-sm" : "bg-white text-gray-500 border-gray-200"}`}
              style={active ? { backgroundColor: s.color, borderColor: s.color } : undefined}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : s.dot}`} />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Variante compacta para tablas densas: dots clicables sin etiquetas (tooltip),
// + dos pills cortas para los estados fuera de la secuencia.
export function StatusStepperCompact({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange?: (status: string) => void;
  disabled?: boolean;
}) {
  const isOffPath = (OFF_PATH as readonly string[]).includes(value);
  const progress = progressStepFor(value);
  const interactive = !!onChange && !disabled;
  const nodes = MAIN_PATH.map((v) => statusMap[v]).filter(Boolean);

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex items-center">
        {nodes.map((s, i) => {
          const done = s.step < progress;
          const current = !isOffPath && s.step === progress;
          const filled = done || current;
          const accent = s.color;
          const dotStyle: React.CSSProperties = filled ? { backgroundColor: accent, borderColor: accent } : {};
          if (current) dotStyle.boxShadow = `0 0 0 3px ${accent}33`;

          return (
            <div key={s.value} className="flex items-center">
              {i > 0 && (
                <span className="w-2 h-0.5" style={{ backgroundColor: s.step <= progress - 1 ? accent : "#e5e7eb" }} />
              )}
              <button
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onChange!(s.value)}
                title={s.label}
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition
                  ${interactive ? "cursor-pointer hover:scale-125" : "cursor-default"}
                  ${filled ? "" : "bg-white border-gray-300"}`}
                style={dotStyle}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <span className="w-px h-3.5 bg-gray-200" />
      {OFF_PATH.map((v) => {
        const s = statusMap[v];
        if (!s) return null;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange!(v)}
            title={s.label}
            className={`px-1.5 h-4 rounded text-[8px] font-bold leading-none border transition
              ${interactive ? "cursor-pointer hover:border-current" : "cursor-default"}
              ${active ? "text-white" : "bg-white text-gray-400 border-gray-200"}`}
            style={active ? { backgroundColor: s.color, borderColor: s.color } : undefined}
          >
            {s.short}
          </button>
        );
      })}
    </div>
  );
}
