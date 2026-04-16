"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";

export const MIN_REASON_LENGTH = 10;

interface ReasonDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  confirmLabel?: string;
  saving?: boolean;
}

export function ReasonDialog({
  open,
  title = "Motivo del cambio",
  description = "Estás modificando fechas. Indica el motivo para dejar registro.",
  onCancel,
  onConfirm,
  confirmLabel = "Confirmar y guardar",
  saving = false,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const tooShort = reason.trim().length < MIN_REASON_LENGTH;

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Motivo (mínimo {MIN_REASON_LENGTH} caracteres)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
            placeholder="Ej: Se extendió el plazo por retraso en ambiente de pruebas"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {reason.trim().length}/{MIN_REASON_LENGTH} caracteres mínimos
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-foreground bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            disabled={tooShort || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-secondary transition disabled:opacity-50"
          >
            {saving ? "Guardando..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
