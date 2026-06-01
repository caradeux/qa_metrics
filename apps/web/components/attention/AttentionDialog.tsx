"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/stories/StatusBadge";
import { useAttention } from "@/hooks/useAttention";
import type { AttentionReason } from "@/lib/api-client";

const REASON_META: Record<AttentionReason, { label: string; cls: string }> = {
  returned: { label: "Devuelto a Dev", cls: "bg-red-50 text-red-700 border-red-200" },
  on_hold: { label: "Detenido", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  stuck: { label: "+14d en estado", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue: { label: "Vencida", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const REASON_ORDER: AttentionReason[] = ["returned", "stuck", "overdue", "on_hold"];

export function AttentionDialog() {
  const { open, closeDialog, items } = useAttention();
  const router = useRouter();

  // Conteo por motivo para el resumen.
  const counts = REASON_ORDER.map((r) => ({
    reason: r,
    n: items.filter((i) => i.reasons.includes(r)).length,
  })).filter((c) => c.n > 0);

  function goTo(projectId: string) {
    closeDialog();
    router.push(`/projects/${projectId}/stories`);
  }

  return (
    <Modal open={open} onClose={closeDialog} title="Temas que requieren gestión" maxWidth="max-w-2xl">
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay temas pendientes de gestión. 🎉</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              <strong className="text-gray-900">{items.length}</strong> tema(s) requieren atención del equipo:
            </span>
            {counts.map((c) => (
              <span
                key={c.reason}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${REASON_META[c.reason].cls}`}
              >
                {c.n} {REASON_META[c.reason].label}
              </span>
            ))}
          </div>

          <ul className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {items.map((it) => (
              <li key={it.assignmentId}>
                <button
                  onClick={() => goTo(it.projectId)}
                  className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-gray-50 transition flex items-start gap-3"
                  title="Ir a la HU"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {it.externalId && <span className="text-[10px] font-mono text-gray-400">{it.externalId}</span>}
                      <span className="text-sm font-medium text-gray-900 truncate">{it.storyTitle}</span>
                      <StatusBadge status={it.status} />
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {it.clientName} / {it.projectName}
                      {it.testerName ? ` · ${it.testerName}` : ""} · {it.daysInStatus}d en estado
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...it.reasons]
                        .sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b))
                        .map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-semibold ${REASON_META[r].cls}`}
                          >
                            {REASON_META[r].label}
                          </span>
                        ))}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end pt-1">
            <button
              onClick={closeDialog}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
