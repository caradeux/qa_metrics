"use client";

import { useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ValidRow {
  row: number;
  testerId: string;
  testerEmail: string;
  cycleId: string;
  cycleName: string;
  date: string;
  designed: number;
  executed: number;
  defects: number;
}

interface PreviewIssue {
  row: number;
  error: string;
}

interface PreviewResult {
  valid: ValidRow[];
  errors: PreviewIssue[];
  summary: { total: number; valid: number; errors: number };
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDownloadTemplate() {
    try {
      const blob = await apiClient<Blob>("/api/records/templates/download");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_registros_diarios.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Error al descargar la plantilla");
    }
  }

  function handleFileSelect(selectedFile: File | null) {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      setErrorMsg("Solo se permiten archivos .xlsx o .csv");
      return;
    }
    setFile(selectedFile);
    setPreview(null);
    setMessage("");
    setErrorMsg("");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiClient<PreviewResult>("/api/records/import", {
        method: "POST",
        body: formData,
      });
      setPreview(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    setErrorMsg("");
    try {
      const data = await apiClient<{ message: string }>(
        "/api/records/import/confirm",
        {
          method: "POST",
          body: JSON.stringify({ records: preview.valid }),
        }
      );
      setMessage(data.message);
      setPreview(null);
      setFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al confirmar la importacion");
    } finally {
      setConfirming(false);
    }
  }

  const hasErrors = preview ? preview.errors.length > 0 : false;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Importar Registros Diarios
      </h1>
      <p className="text-sm text-muted mb-6">
        Columnas requeridas:{" "}
        <code className="bg-gray-100 px-1 rounded">tester_email</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">date (YYYY-MM-DD)</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">cycle_name</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">designed</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">executed</code>,{" "}
        <code className="bg-gray-100 px-1 rounded">defects</code>. No se
        permiten fechas futuras ni feriados.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card p-4 rounded-xl border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2">Plantilla</h3>
          <p className="text-xs text-muted mb-3">
            Descargue la plantilla Excel para comenzar.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition"
            style={{ backgroundColor: "#1F3864" }}
          >
            Descargar Plantilla
          </button>
        </div>

        <div
          className={`bg-card p-4 rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center ${
            dragging ? "border-[#2E5FA3] bg-blue-50" : "border-border hover:border-[#2E5FA3]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFileSelect(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-sm font-medium text-foreground">{file.name}</p>
          ) : (
            <p className="text-xs text-muted text-center">
              Arrastre un archivo .xlsx o .csv aqui<br />o haga clic para seleccionar
            </p>
          )}
        </div>
      </div>

      {file && !preview && (
        <div className="mb-6">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50"
            style={{ backgroundColor: "#2E5FA3" }}
          >
            {uploading ? "Procesando..." : "Cargar y Validar"}
          </button>
        </div>
      )}

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
          {errorMsg}
        </p>
      )}
      {message && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-lg font-medium">
          {message}
        </p>
      )}

      {preview && (
        <div className="mb-6">
          <div className="flex gap-4 mb-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-100 font-medium">
              Total: {preview.summary.total}
            </span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
              Validas: {preview.summary.valid}
            </span>
            {preview.summary.errors > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                Errores: {preview.summary.errors}
              </span>
            )}
          </div>

          {preview.errors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Errores:</h4>
              <ul className="text-xs text-red-700 space-y-1">
                {preview.errors.map((e, i) => (
                  <li key={i}>Fila {e.row}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white text-xs" style={{ backgroundColor: "#1F3864" }}>
                  <th className="px-3 py-2 text-left">Fila</th>
                  <th className="px-3 py-2 text-left">Tester</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Ciclo</th>
                  <th className="px-3 py-2 text-center">Dis.</th>
                  <th className="px-3 py-2 text-center">Ejec.</th>
                  <th className="px-3 py-2 text-center">Def.</th>
                </tr>
              </thead>
              <tbody>
                {preview.valid.map((r) => (
                  <tr key={r.row} className="border-t border-border bg-green-50">
                    <td className="px-3 py-2 font-medium">{r.row}</td>
                    <td className="px-3 py-2">{r.testerEmail}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.cycleName}</td>
                    <td className="px-3 py-2 text-center">{r.designed}</td>
                    <td className="px-3 py-2 text-center">{r.executed}</td>
                    <td className="px-3 py-2 text-center">{r.defects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={hasErrors || confirming || preview.valid.length === 0}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: hasErrors ? "#9CA3AF" : "#1F3864" }}
            >
              {confirming ? "Importando..." : "Confirmar Importacion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
