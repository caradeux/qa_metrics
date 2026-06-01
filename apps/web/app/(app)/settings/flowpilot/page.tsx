"use client";

import { useEffect, useState } from "react";
import { flowpilotApi } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

export default function FlowpilotSettingsPage() {
  const { user } = useAuth();
  const [baseUrl, setBaseUrl] = useState("");
  const [envDefault, setEnvDefault] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    flowpilotApi.getConfig()
      .then((c) => { setBaseUrl(c.baseUrl); setEnvDefault(c.envDefault); setIsCustom(c.isCustom); })
      .catch((e) => setError(e?.message ?? "Error"))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = user && (user.role?.name === "ADMIN" || user.role?.name === "QA_LEAD");
  if (user && !isAdmin) {
    return <div className="max-w-md mx-auto mt-24 text-center text-sm text-gray-500">Acceso restringido a ADMIN/QA_LEAD.</div>;
  }

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const c = await flowpilotApi.setConfig(baseUrl.trim());
      setBaseUrl(c.baseUrl); setIsCustom(c.isCustom);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Error al guardar");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="text-[10px] text-gray-400 uppercase tracking-[0.18em] mb-1">Configuración / FlowPilot</div>
        <h1 className="text-xl font-bold text-gray-900">Integración FlowPilot</h1>
        <p className="text-xs text-gray-400 mt-0.5">URL base del sistema FlowPilot al que se envían las horas.</p>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-800">{error}</div>}

      {loading ? (
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">URL base de FlowPilot</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://flowpilot.biz"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:border-[#4A90D9] outline-none"
            />
            <p className="mt-1.5 text-[11px] text-gray-400">
              Ej. producción: <span className="font-mono">https://flowpilot.biz</span> · QA:{" "}
              <span className="font-mono">https://wap-asignacion-semanal-horas-qa.azurewebsites.net</span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded-full border ${isCustom ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
              {isCustom ? "Personalizada (BD)" : "Usando valor por defecto del entorno"}
            </span>
            <span className="text-gray-400">Default entorno: <span className="font-mono">{envDefault}</span></span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={saving || !baseUrl.trim()} className="bg-[#2E5FA3] text-white text-sm rounded-md px-4 py-2 disabled:opacity-40 hover:bg-[#264f88]">
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {isCustom && (
              <button
                onClick={() => { setBaseUrl(envDefault); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Restaurar default del entorno
              </button>
            )}
            {saved && <span className="text-[12px] text-emerald-600 font-medium">✓ Guardado</span>}
          </div>

          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Al cambiar la URL, los analistas deberán reconectar su cuenta de FlowPilot (sus credenciales se validan contra el nuevo sistema). La homologación usa los catálogos en vivo del sistema configurado.
          </p>
        </div>
      )}
    </div>
  );
}
