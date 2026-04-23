"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";
import { InovabizLogo } from "@/components/InovabizLogo";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill remembered email on mount
  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("rememberedEmail") : null;
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

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
      if (remember) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");
      window.location.href = "/dashboard";
      return;
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0A0F1A", fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <p className="text-white/50 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden text-white flex flex-col"
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        background: "#0A0F1A",
      }}
    >
      {/* ── Aurora blobs ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 animate-aurora-1"
          style={{ background: "radial-gradient(circle, #04E5F3 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[40%] -left-40 w-[500px] h-[500px] rounded-full blur-[120px] opacity-25 animate-aurora-2"
          style={{ background: "radial-gradient(circle, #25CF6C 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[450px] h-[450px] rounded-full blur-[120px] opacity-20 animate-aurora-3"
          style={{ background: "radial-gradient(circle, #08ACF4 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Top bar: Inovabiz ──────────────────────────────────── */}
      <header className="relative z-10 px-6 lg:px-10 py-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3" aria-label="Volver al inicio">
          <InovabizLogo className="h-6 w-auto" variant="white" />
        </a>
        <a
          href="/"
          className="text-[13px] text-white/50 hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al inicio
        </a>
      </header>

      {/* ── Main: centered card ────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10 lg:py-16">
        <div className="w-full max-w-[440px]">
          {/* Brand lockup */}
          <div className="flex flex-col items-center mb-10" style={{ animation: "fadeInUp 0.5s ease-out both" }}>
            <div className="relative">
              <div
                className="absolute inset-0 blur-2xl opacity-70"
                style={{ background: "radial-gradient(circle, #04E5F3 0%, #25CF6C 60%, transparent 80%)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="QA Metrics"
                className="relative w-16 h-16 rounded-2xl shadow-[0_16px_40px_-10px_rgba(4,229,243,0.45)]"
              />
            </div>
            <h1 className="mt-6 text-[32px] font-bold tracking-tight leading-[1.05] text-center">
              Bienvenido a{" "}
              <span
                className="italic text-transparent bg-clip-text"
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  backgroundImage: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)",
                }}
              >
                QA Metrics
              </span>
            </h1>
            <p className="mt-3 text-[14px] text-white/55 text-center leading-relaxed max-w-sm">
              Ingresa tus credenciales para acceder al panel de control.
            </p>
          </div>

          {/* Form card */}
          <div
            className="relative rounded-2xl border border-white/10 p-7 lg:p-8 backdrop-blur-xl shadow-[0_40px_80px_-20px_rgba(4,229,243,0.15)]"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
              animation: "fadeInUp 0.5s ease-out 0.1s both",
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="group">
                <label
                  htmlFor="email"
                  className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50 mb-2.5"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#04E5F3] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:border-[#04E5F3]/50 focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-[#04E5F3]/10 transition-all text-[14.5px]"
                    placeholder="admin@qametrics.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50 mb-2.5"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#04E5F3] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-white/30 focus:border-[#04E5F3]/50 focus:bg-white/[0.06] focus:outline-none focus:ring-4 focus:ring-[#04E5F3]/10 transition-all text-[14.5px]"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Remember */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div className="relative">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-4 h-4 rounded border border-white/20 bg-white/[0.03] peer-checked:bg-[#04E5F3] peer-checked:border-[#04E5F3] transition-colors" />
                  <svg
                    className="absolute top-0 left-0 w-4 h-4 text-[#0A0F1A] opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[13px] text-white/60">Recordar mi correo</span>
              </label>

              {/* Error */}
              {error && (
                <div
                  className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/25 text-[#F87171] text-[13px]"
                  style={{ animation: "slideIn 0.3s ease-out both" }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-shimmer w-full relative py-3.5 rounded-lg text-[14px] font-semibold text-[#0A0F1A] transition-all hover:shadow-[0_0_40px_rgba(4,229,243,0.45)] hover:scale-[1.01] active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
                style={{ background: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)" }}
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2 w-full">
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verificando...
                    </>
                  ) : (
                    <>
                      Iniciar sesión
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* Footer: powered by Inovabiz */}
          <div
            className="mt-10 flex flex-col items-center gap-2"
            style={{ animation: "fadeInUp 0.5s ease-out 0.3s both" }}
          >
            <span className="text-[10px] text-white/30 tracking-[0.22em] uppercase">Powered by</span>
            <InovabizLogo className="h-5 w-auto opacity-70" variant="white" />
          </div>
        </div>
      </main>
    </div>
  );
}
