"use client";

import { useEffect, useState, useRef } from "react";
import { apiClient } from "@/lib/api-client";

interface Client {
  id: string;
  name: string;
}
interface Project {
  id: string;
  name: string;
  modality: string;
}

interface ValidRowData {
  testerId: string;
  testerName: string;
  cycleId: string;
  cycleName: string;
  weekStart: string;
  designedFunctional: number;
  designedRegression: number;
  designedSmoke: number;
  designedExploratory: number;
  executedFunctional: number;
  executedRegression: number;
  executedSmoke: number;
  executedExploratory: number;
  defectsCritical: number;
  defectsHigh: number;
  defectsMedium: number;
  defectsLow: number;
}

interface ValidRow {
  row: number;
  data: ValidRowData;
}

interface IssueItem {
  row: number;
  column: string;
  message: string;
}

interface PreviewResult {
  valid: ValidRow[];
  errors: IssueItem[];
  warnings: IssueItem[];
  summary: {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
  };
}

export default function ImportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiClient<Client[]>("/api/clients")
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      return;
    }
    apiClient<Project[]>(`/api/projects?clientId=${clientId}`)
      .then((all) => setProjects(all.filter((p) => p.modality === "MANUAL")))
      .catch(() => setProjects([]));
    setProjectId("");
    setPreview(null);
    setFile(null);
  }, [clientId]);

  useEffect(() => {
    setPreview(null);
    setFile(null);
    setMessage("");
    setErrorMsg("");
  }, [projectId]);

  async function handleDownloadTemplate() {
    try {
      const blob = await apiClient<Blob>("/api/records/templates/download");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_carga_qa.xlsx";
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
    if (!file || !projectId) return;
    setUploading(true);
    setErrorMsg("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

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
    if (!preview || !projectId) return;
    setConfirming(true);
    setErrorMsg("");

    try {
      const records = preview.valid.map((v) => v.data);
      const data = await apiClient<{ message: string }>("/api/records/import/confirm", {
        method: "POST",
        body: JSON.stringify({ projectId, records }),
      });

      setMessage(data.message);
      setPreview(null);
      setFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al confirmar la importacion");
    } finally {
      setConfirming(false);
    }
  }

  function getRowStatus(rowNum: number): "valid" | "error" | "warning" {
    if (!preview) return "valid";
    if (preview.errors.some((e) => e.row === rowNum)) return "error";
    if (preview.warnings.some((w) => w.row === rowNum)) return "warning";
    return "valid";
  }

  // Build a unified list of all rows for the preview table
  const allPreviewRows = preview
    ? (() => {
        const rowMap = new Map<
          number,
          { row: number; data: ValidRowData | null; status: string }
        >();

        preview.valid.forEach((v) => {
          rowMap.set(v.row, {
            row: v.row,
            data: v.data,
            status: getRowStatus(v.row),
          });
        });

        // Error rows don't have data in valid, show them as error-only rows
        preview.errors.forEach((e) => {
          if (!rowMap.has(e.row)) {
            rowMap.set(e.row, { row: e.row, data: null, status: "error" });
          }
        });

        return [...rowMap.values()].sort((a, b) => a.row - b.row);
      })()
    : [];

  const hasErrors = preview ? preview.errors.length > 0 : false;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Importar Datos desde Archivo
      </h1>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Cliente
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">Seleccionar...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Proyecto (modalidad Manual)
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!clientId}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
          >
            <option value="">Seleccionar...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template download + File upload */}
      {projectId && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Download template */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Plantilla
            </h3>
            <p className="text-xs text-muted mb-3">
              Descargue la plantilla Excel, complete los datos y suba el archivo.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition"
              style={{ backgroundColor: "#1F3864" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#2E5FA3")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#1F3864")
              }
            >
              Descargar Plantilla
            </button>
          </div>

          {/* Dropzone */}
          <div
            className={`bg-card p-4 rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center ${
              dragging
                ? "border-[#2E5FA3] bg-blue-50"
                : "border-border hover:border-[#2E5FA3]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const droppedFile = e.dataTransfer.files[0];
              handleFileSelect(droppedFile);
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
            <svg
              className="w-8 h-8 text-muted mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {file ? (
              <p className="text-sm font-medium text-foreground">{file.name}</p>
            ) : (
              <p className="text-xs text-muted text-center">
                Arrastre un archivo .xlsx o .csv aqui
                <br />o haga clic para seleccionar
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && projectId && !preview && (
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

      {/* Error / success messages */}
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

      {/* Preview */}
      {preview && (
        <div className="mb-6">
          {/* Summary */}
          <div className="flex gap-4 mb-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-foreground font-medium">
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
            {preview.summary.warnings > 0 && (
              <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                Advertencias: {preview.summary.warnings}
              </span>
            )}
          </div>

          {/* Error details */}
          {preview.errors.length > 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-red-800 mb-2">
                Errores encontrados:
              </h4>
              <ul className="text-xs text-red-700 space-y-1">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    Fila {e.row}, columna <strong>{e.column}</strong>:{" "}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warning details */}
          {preview.warnings.length > 0 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                Advertencias:
              </h4>
              <ul className="text-xs text-yellow-700 space-y-1">
                {preview.warnings.map((w, i) => (
                  <li key={i}>
                    Fila {w.row}, columna <strong>{w.column}</strong>:{" "}
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-white text-xs"
                  style={{ backgroundColor: "#1F3864" }}
                >
                  <th className="px-3 py-2 text-left font-medium">Fila</th>
                  <th className="px-3 py-2 text-left font-medium">Tester</th>
                  <th className="px-3 py-2 text-left font-medium">Ciclo</th>
                  <th className="px-3 py-2 text-left font-medium">Semana</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Disenados
                  </th>
                  <th className="px-3 py-2 text-center font-medium">
                    Ejecutados
                  </th>
                  <th className="px-3 py-2 text-center font-medium">
                    Defectos
                  </th>
                  <th className="px-3 py-2 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {allPreviewRows.map((item) => {
                  const bgClass =
                    item.status === "error"
                      ? "bg-red-50"
                      : item.status === "warning"
                        ? "bg-yellow-50"
                        : "bg-green-50";
                  const textClass =
                    item.status === "error"
                      ? "text-red-700"
                      : item.status === "warning"
                        ? "text-yellow-700"
                        : "text-green-700";

                  if (!item.data) {
                    // Error-only row
                    const rowErrors = preview.errors.filter(
                      (e) => e.row === item.row
                    );
                    return (
                      <tr
                        key={item.row}
                        className={`border-t border-border ${bgClass}`}
                      >
                        <td className="px-3 py-2 font-medium">{item.row}</td>
                        <td
                          colSpan={6}
                          className="px-3 py-2 text-xs text-red-600"
                        >
                          {rowErrors.map((e) => e.message).join("; ")}
                        </td>
                        <td
                          className={`px-3 py-2 text-center text-xs font-semibold ${textClass}`}
                        >
                          Error
                        </td>
                      </tr>
                    );
                  }

                  const d = item.data;
                  const designedSum =
                    d.designedFunctional +
                    d.designedRegression +
                    d.designedSmoke +
                    d.designedExploratory;
                  const executedSum =
                    d.executedFunctional +
                    d.executedRegression +
                    d.executedSmoke +
                    d.executedExploratory;
                  const defectsSum =
                    d.defectsCritical +
                    d.defectsHigh +
                    d.defectsMedium +
                    d.defectsLow;

                  return (
                    <tr
                      key={item.row}
                      className={`border-t border-border ${bgClass}`}
                    >
                      <td className="px-3 py-2 font-medium">{item.row}</td>
                      <td className="px-3 py-2">{d.testerName}</td>
                      <td className="px-3 py-2">{d.cycleName}</td>
                      <td className="px-3 py-2">{d.weekStart}</td>
                      <td className="px-3 py-2 text-center">{designedSum}</td>
                      <td className="px-3 py-2 text-center">{executedSum}</td>
                      <td className="px-3 py-2 text-center">{defectsSum}</td>
                      <td
                        className={`px-3 py-2 text-center text-xs font-semibold ${textClass}`}
                      >
                        {item.status === "warning" ? "Advertencia" : "Valida"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirm button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleConfirm}
              disabled={hasErrors || confirming}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: hasErrors ? "#9CA3AF" : "#1F3864" }}
              onMouseEnter={(e) => {
                if (!hasErrors)
                  e.currentTarget.style.backgroundColor = "#2E5FA3";
              }}
              onMouseLeave={(e) => {
                if (!hasErrors)
                  e.currentTarget.style.backgroundColor = "#1F3864";
              }}
            >
              {confirming ? "Importando..." : "Confirmar Importacion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
