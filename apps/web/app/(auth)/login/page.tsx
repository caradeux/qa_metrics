"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = "/dashboard";
    }
  }, [authLoading, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      window.location.href = "/dashboard";
      return;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Credenciales incorrectas");
      }
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Dark branding ──────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: "linear-gradient(160deg, #0D1B2A 0%, #1F3864 60%, #2E5FA3 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[60%] overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[2px] px-16 opacity-[0.06]">
            {[28, 35, 22, 45, 38, 55, 42, 60, 50, 72, 58, 78, 65, 85, 70, 90, 75, 92, 80, 95].map(
              (h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-white rounded-t-[1px]"
                  style={{ height: `${h}%`, animation: `fadeInUp 0.4s ease-out ${i * 0.06}s both` }}
                />
              )
            )}
          </div>
          <svg className="absolute bottom-0 left-0 w-full h-full opacity-[0.08]" viewBox="0 0 800 400" preserveAspectRatio="none">
            <polyline fill="none" stroke="white" strokeWidth="2" points="0,380 80,340 160,350 240,280 320,300 400,220 480,240 560,160 640,140 720,80 800,40" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-[#4A90D9]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#4A90D9] font-medium">Command Center</span>
          </div>
        </div>
        <div className="relative z-10 -mt-16">
          <h1 className="text-white text-5xl font-bold tracking-[0.3em] uppercase leading-tight" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
            QA<br />METRICS
          </h1>
          <div className="mt-4 h-[2px] w-20 origin-left" style={{ background: "linear-gradient(90deg, #4A90D9 0%, transparent 100%)", animation: "slideIn 0.8s ease-out 0.3s both" }} />
          <p className="mt-6 text-[#8BA4C4] text-sm font-light tracking-wide max-w-xs leading-relaxed">
            Sistema de Metricas y Seguimiento QA
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="grid grid-cols-4 gap-[3px]">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="w-[6px] h-[6px] rounded-[1px]" style={{ backgroundColor: i % 3 === 0 ? "rgba(74, 144, 217, 0.5)" : "rgba(255, 255, 255, 0.12)", animation: `pulse-glow 3s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-[rgba(255,255,255,0.15)] to-transparent" />
          <span className="text-[10px] text-[rgba(255,255,255,0.25)] tracking-widest uppercase">v2.0</span>
        </div>
      </div>

      {/* ── Right Panel: Login form ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-white relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#1F3864] to-transparent opacity-10 lg:hidden" />
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-center">
            <h1 className="text-2xl font-bold tracking-[0.2em] uppercase text-[#1F3864]">QA Metrics</h1>
            <p className="text-xs text-[#6b7280] mt-1 tracking-wide">Sistema de Metricas y Seguimiento QA</p>
          </div>
          <div className="mb-10" style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <h2 className="text-2xl font-semibold text-[#1a1a2e] tracking-tight">Iniciar Sesion</h2>
            <p className="mt-2 text-sm text-[#6b7280]">Ingresa tus credenciales para acceder al panel</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="group" style={{ animation: "fadeInUp 0.4s ease-out 0.1s both" }}>
              <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6b7280] mb-3">Correo Electronico</label>
              <div className="relative">
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-0 py-3 bg-transparent text-[#1a1a2e] placeholder-[#c5c8ce] border-0 border-b-2 border-[#e2e4e8] focus:border-[#1F3864] focus:outline-none transition-colors duration-300 text-[15px]" placeholder="admin@qametrics.com" />
                <div className="absolute bottom-0 left-1/2 w-0 h-[2px] bg-[#1F3864] transition-all duration-300 group-focus-within:left-0 group-focus-within:w-full" />
              </div>
            </div>
            <div className="group" style={{ animation: "fadeInUp 0.4s ease-out 0.2s both" }}>
              <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6b7280] mb-3">Contrasena</label>
              <div className="relative">
                <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-0 py-3 bg-transparent text-[#1a1a2e] placeholder-[#c5c8ce] border-0 border-b-2 border-[#e2e4e8] focus:border-[#1F3864] focus:outline-none transition-colors duration-300 text-[15px]" placeholder="••••••••" />
                <div className="absolute bottom-0 left-1/2 w-0 h-[2px] bg-[#1F3864] transition-all duration-300 group-focus-within:left-0 group-focus-within:w-full" />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-3 py-3 px-4 bg-[#FEF2F2] border-l-[3px] border-[#ef4444] text-[#ef4444] text-sm" style={{ animation: "slideIn 0.3s ease-out both" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}
            <div style={{ animation: "fadeInUp 0.4s ease-out 0.3s both" }}>
              <button type="submit" disabled={loading} className="w-full py-3.5 px-6 bg-[#1F3864] text-white text-[13px] font-semibold uppercase tracking-[0.15em] hover:-translate-y-[1px] hover:shadow-lg hover:shadow-[rgba(31,56,100,0.25)] active:translate-y-0 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Verificando...
                  </span>
                ) : "Iniciar Sesion"}
              </button>
            </div>
          </form>
          <div className="mt-12 pt-6 border-t border-[#e2e4e8]" style={{ animation: "fadeInUp 0.4s ease-out 0.45s both" }}>
            <p className="text-[11px] text-[#9ca3af] text-center tracking-wide">QA METRICS COMMAND CENTER</p>
          </div>
        </div>
      </div>
    </div>
  );
}
