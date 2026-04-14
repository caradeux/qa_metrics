"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Lista opcional de ítems afectados (se mostrarán como chips) */
  details?: { label: string; value: string | number; tone?: "default" | "danger" | "warning" }[];
  /** Nombre del recurso a eliminar. Si se pasa, el usuario debe escribirlo para habilitar el botón. */
  confirmType?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Variant: destructive para subrayar lo irreversible */
  variant?: "destructive" | "default";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmType,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  loading = false,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const requiresTyping = Boolean(confirmType);
  const typedOk = !requiresTyping || typed.trim() === confirmType;
  const canConfirm = typedOk && !loading;

  const accent = variant === "destructive"
    ? { bg: "bg-red-50", border: "border-red-100", iconColor: "text-red-500", buttonBg: "bg-red-600 hover:bg-red-700" }
    : { bg: "bg-amber-50", border: "border-amber-100", iconColor: "text-amber-500", buttonBg: "bg-[#1F3864] hover:bg-[#2E5FA3]" };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Header con ícono */}
        <div className={`flex items-start gap-3 rounded-lg ${accent.bg} ${accent.border} border p-3`}>
          <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center shrink-0">
            <svg className={`w-5 h-5 ${accent.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Ítems afectados */}
        {details && details.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Se eliminarán también
            </p>
            <div className="flex flex-wrap gap-2">
              {details.map((d, i) => {
                const toneClass =
                  d.tone === "danger"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : d.tone === "warning"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-white text-gray-700 border-gray-200";
                return (
                  <span key={i} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${toneClass}`}>
                    <span className="font-medium">{d.label}:</span>
                    <span className="font-mono font-semibold tabular-nums">{d.value}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Input de confirmación (si aplica) */}
        {requiresTyping && (
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">
              Para confirmar, escribe <span className="font-mono font-semibold text-gray-900">{confirmType}</span>:
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmType}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              autoFocus
            />
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-gray-400">Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all duration-150 uppercase tracking-wider"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`px-4 py-2 text-xs font-medium text-white ${accent.buttonBg} rounded-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider`}
            >
              {loading ? "Eliminando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
