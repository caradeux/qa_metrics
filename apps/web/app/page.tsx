import Link from "next/link";
import Image from "next/image";
import { InovabizLogo } from "@/components/InovabizLogo";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "QA Metrics · Plataforma de métricas QA de Inovabiz",
  description:
    "Centraliza la operación QA de todos tus proyectos. Dashboards, reportes y visibilidad del trabajo real de cada analista. Azure DevOps o carga manual, un solo panel.",
};

export default function LandingPage() {
  return (
    <div
      className="min-h-screen relative overflow-x-clip text-white"
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        background: "#0A0F1A",
      }}
    >
      {/* ── Aurora blobs (decorative) ──────────────────────────── */}
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

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="relative z-40 border-b border-white/5 backdrop-blur-md bg-[rgba(10,15,26,0.6)]">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" aria-label="QA Metrics">
            <InovabizLogo className="h-7 w-auto" variant="white" />
            <span className="hidden sm:inline-block h-5 w-px bg-white/15" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt=""
              aria-hidden
              className="hidden sm:inline-block w-7 h-7 rounded-md shadow-[0_4px_12px_rgba(4,229,243,0.35)]"
            />
            <span className="hidden sm:inline-block text-[13px] font-semibold tracking-tight text-white/90">
              QA Metrics
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <a
              href="#producto"
              className="hidden md:inline-block px-3 py-2 text-[13px] text-white/60 hover:text-white transition-colors"
            >
              Producto
            </a>
            <a
              href="#como-funciona"
              className="hidden md:inline-block px-3 py-2 text-[13px] text-white/60 hover:text-white transition-colors"
            >
              Cómo funciona
            </a>
            <a
              href="#beneficios"
              className="hidden md:inline-block px-3 py-2 text-[13px] text-white/60 hover:text-white transition-colors"
            >
              Beneficios
            </a>
            <Link
              href="/login"
              className="ml-2 inline-flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-semibold text-[#0A0F1A] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(4,229,243,0.35)]"
              style={{ background: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)" }}
            >
              Acceder
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-10 pt-16 lg:pt-24 pb-20 lg:pb-28">
        <div className="grid lg:grid-cols-[0.85fr_1.3fr] gap-10 lg:gap-14 items-center">
          <Reveal>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#04E5F3] animate-pulse" />
              <span className="text-[12px] font-medium text-white/80">
                Plataforma de métricas QA de Inovabiz
              </span>
            </div>
            {/* Headline */}
            <h1 className="mt-7 text-[44px] sm:text-[56px] lg:text-[68px] font-bold leading-[1.02] tracking-[-0.025em]">
              Métricas de QA que{" "}
              <span
                className="italic text-transparent bg-clip-text"
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  backgroundImage: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)",
                }}
              >
                hablan
              </span>{" "}
              por tu equipo.
            </h1>
            {/* Subtitle */}
            <p className="mt-6 text-[17px] lg:text-[18px] text-white/60 leading-relaxed max-w-xl">
              Centraliza la operación QA de todos tus proyectos. Dashboards en tiempo real, reportes automáticos por cliente y visibilidad del trabajo real de cada analista — sin planillas dispersas.
            </p>
            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="btn-shimmer inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold text-[#0A0F1A] transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(4,229,243,0.55)]"
                style={{ background: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)" }}
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  Acceder a la plataforma
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <a
                href="mailto:contacto@inovabiz.com?subject=QA%20Metrics%20%E2%80%94%20Solicitar%20demo&body=Hola%2C%20me%20gustar%C3%ADa%20agendar%20una%20demo%20de%20QA%20Metrics."
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-medium text-white border border-white/15 hover:bg-white/5 hover:border-white/30 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Solicitar demo
              </a>
            </div>
          </Reveal>

          {/* Browser mockup */}
          <Reveal delay={200}>
            <div className="relative">
              <div
                className="absolute -top-6 right-4 z-20 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold text-[#0A0F1A] animate-float-y"
                style={{ background: "linear-gradient(135deg, #25CF6C 0%, #94CE94 100%)" }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L13.09 8.26L22 9L17 14.14L18.18 23L12 19.27L5.82 23L7 14.14L2 9L10.91 8.26L12 2Z" />
                </svg>
                Live dashboard
              </div>
              <div className="mockup-halo mockup-float-1">
                <div
                  className="mockup-tilt mockup-shine gradient-border relative rounded-xl overflow-hidden border border-white/10 shadow-[0_40px_80px_-20px_rgba(4,229,243,0.35)]"
                  style={{ background: "linear-gradient(180deg, #0F1729 0%, #0A0F1A 100%)" }}
                >
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/30">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="ml-3 flex-1 text-center text-[10px] text-white/40 font-mono truncate">
                      qametrics.cl/dashboard
                    </div>
                  </div>
                  {/* Real dashboard screenshot */}
                  <Image
                    src="/landing/dashboard-cliente.png"
                    alt="Dashboard QA Metrics mostrando KPIs, lead time por estado y defectos por severidad"
                    width={1536}
                    height={820}
                    priority
                    className="block w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Beneficios claros (antes era stats strip) */}
        <Reveal delay={100}>
          <div className="mt-20 lg:mt-28 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
            {[
              {
                title: "Ve al equipo completo",
                desc: "Un solo panel con todos tus analistas, proyectos y clientes",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                ),
              },
              {
                title: "Azure DevOps o Manual",
                desc: "Conecta ADO si lo usas, o registra en formulario diario",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                ),
              },
              {
                title: "El cliente ve solo lo suyo",
                desc: "Dashboard privado por cliente, con aislamiento real de datos",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                ),
              },
              {
                title: "Cada cambio queda grabado",
                desc: "Auditoría completa de fechas, asignaciones y estados",
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                ),
              },
            ].map((b) => (
              <div key={b.title} className="p-6 lg:p-7 bg-[#0A0F1A] flex gap-4">
                <div
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(4,229,243,0.12) 0%, rgba(37,207,108,0.12) 100%)",
                    border: "1px solid rgba(4,229,243,0.2)",
                  }}
                >
                  <svg className="w-5 h-5 text-[#04E5F3]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    {b.icon}
                  </svg>
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-white tracking-tight leading-snug">
                    {b.title}
                  </div>
                  <div className="mt-1.5 text-[12px] text-white/50 leading-relaxed">
                    {b.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Sección Problema ────────────────────────────────────── */}
      <section id="producto" className="relative z-10 border-t border-white/5 py-20 lg:py-28">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#04E5F3]">
                <span className="w-6 h-[1px] bg-[#04E5F3]/60" />
                El problema
                <span className="w-6 h-[1px] bg-[#04E5F3]/60" />
              </div>
              <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                El Excel te cuesta más{" "}
                <span
                  className="italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "#04E5F3" }}
                >
                  de lo que crees.
                </span>
              </h2>
              <p className="mt-5 text-[15px] lg:text-[17px] text-white/55 leading-relaxed">
                Cada cliente con su planilla. Cada analista con su propio formato. Cada mes, horas reconstruyendo información que ya existe dispersa.
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
              {[
                {
                  tag: "Operación",
                  title: "Planillas dispersas",
                  desc: "Un Excel por cliente, formatos distintos, horas de consolidación manual cada cierre de mes.",
                  color: "#F97316",
                  glow: "rgba(249,115,22,0.12)",
                },
                {
                  tag: "Trazabilidad",
                  title: "Cambios sin rastro",
                  desc: "Las fechas se mueven, los tests se reasignan, el alcance cambia — y nadie sabe quién lo hizo ni cuándo.",
                  color: "#04E5F3",
                  glow: "rgba(4,229,243,0.12)",
                },
                {
                  tag: "Reporte",
                  title: "Horas sin respaldo",
                  desc: "Estimar el esfuerzo del equipo QA a ojo. Reportar al cliente sin evidencia real del trabajo diario.",
                  color: "#A78BFA",
                  glow: "rgba(167,139,250,0.12)",
                },
              ].map((p) => (
                <div
                  key={p.title}
                  className="card-glow relative rounded-xl border border-white/5 p-7 overflow-hidden group transition-all hover:border-white/15 hover:-translate-y-1 duration-300"
                  style={{
                    background: `linear-gradient(180deg, ${p.glow} 0%, rgba(10,15,26,0.4) 50%)`,
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-lg flex items-center justify-center mb-5"
                    style={{ background: `${p.color}15`, border: `1px solid ${p.color}30` }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke={p.color} strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
                    </svg>
                  </div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2"
                    style={{ color: p.color }}
                  >
                    {p.tag}
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight leading-snug text-white">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[14px] text-white/55 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Sección Cuatro pasos ──────────────────────────────── */}
      <section
        id="como-funciona"
        className="relative z-10 border-t border-white/5 py-20 lg:py-28"
      >
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#25CF6C]">
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
                Cómo funciona
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
              </div>
              <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                Cuatro pasos.{" "}
                <span
                  className="italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "#25CF6C" }}
                >
                  De caos a control.
                </span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
              {[
                {
                  n: "01",
                  title: "Conecta tus proyectos",
                  desc: "Integración solo-lectura con Azure DevOps (API v7) o registro manual. Un modo por proyecto.",
                  color: "#04E5F3",
                },
                {
                  n: "02",
                  title: "El equipo registra su día",
                  desc: "Cada analista carga su trabajo diario en 30 segundos. Fases, horas, defectos y bloqueos.",
                  color: "#08ACF4",
                },
                {
                  n: "03",
                  title: "Métricas en vivo",
                  desc: "Dashboards por cliente, Gantt de asignaciones, ocupación real y matriz de complejidad.",
                  color: "#25CF6C",
                },
                {
                  n: "04",
                  title: "Reportes automáticos",
                  desc: "Informes mensuales listos para compartir. PPTX, Excel y dashboards compartibles por cliente.",
                  color: "#94CE94",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="card-glow relative rounded-xl border border-white/5 p-7 overflow-hidden transition-all hover:border-white/15 hover:-translate-y-1 duration-300 bg-gradient-to-b from-white/[0.03] to-transparent"
                >
                  <div
                    className="text-[44px] font-bold tracking-tight leading-none opacity-90"
                    style={{
                      fontFamily: "var(--font-instrument-serif), serif",
                      color: step.color,
                    }}
                  >
                    {step.n}
                  </div>
                  <div
                    className="mt-1 h-[2px] w-8 rounded-full"
                    style={{ background: step.color }}
                  />
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-white leading-snug">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] text-white/55 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Sección Beneficios (antes Capacidades) ─────────────────── */}
      <section id="beneficios" className="relative z-10 border-t border-white/5 py-20 lg:py-28">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#04E5F3]">
                <span className="w-6 h-[1px] bg-[#04E5F3]/60" />
                Lo que cambia en tu día a día
                <span className="w-6 h-[1px] bg-[#04E5F3]/60" />
              </div>
              <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                Decisiones basadas en{" "}
                <span
                  className="italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "#04E5F3" }}
                >
                  datos reales.
                </span>
              </h2>
              <p className="mt-5 text-[15px] lg:text-[17px] text-white/55 leading-relaxed">
                No más intuición, no más planillas perdidas. Cada número que ves en QA Metrics viene de algo que alguien de tu equipo registró.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {[
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  ),
                  title: "Ves dónde está cada HU",
                  desc: "El Gantt muestra en qué fase está cada historia — análisis, ejecución, devuelto a dev — sin preguntar por chat.",
                  badge: "9 estados · Gantt por persona",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ),
                  title: "Detectas cuellos de botella",
                  desc: "Lead time por estado te dice qué fase tarda más. Las devoluciones a desarrollo saltan en rojo automáticamente.",
                  badge: "Lead time · Tasa de rechazo",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.24 17 7.343c1.667 1.333 2.667 3.333 3 6 .327 2.438-.53 4.817-2.343 5.314z" />
                  ),
                  title: "Sabes cuándo el equipo está al límite",
                  desc: "Ocupación en tiempo real: verde <80%, rojo >100%. Si alguien está en dos proyectos saturado, lo ves antes que explote.",
                  badge: "Capacidad vs actividad real",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h4m0 0l-4-4m4 4l-4 4M3 12a9 9 0 1018 0 9 9 0 00-18 0z" />
                  ),
                  title: "Reportas al cliente en 5 minutos",
                  desc: "PPTX ejecutivo generado automático: resumen, matriz de riesgo, tendencias, anexo con detalle por analista. Listo para enviar.",
                  badge: "PPTX · Excel · 12 slides",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 10l3-6h12l3 6M3 10v10a1 1 0 001 1h16a1 1 0 001-1V10M9 21V14a1 1 0 011-1h4a1 1 0 011 1v7" />
                  ),
                  title: "El cliente mira su dashboard, no el tuyo",
                  desc: "Cada cliente con su propio panel privado. Ve sus KPIs — diseño, ejecución, defectos, retrasos — sin ver datos internos.",
                  badge: "Multi-tenant · PM Cliente",
                },
                {
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ),
                  title: "Todo cambio queda registrado",
                  desc: "Si alguien movió una fecha, reasignó una HU o cambió un estado — sabes quién, cuándo y por qué. Responsabilidad integrada.",
                  badge: "Audit trail completo",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="card-glow group rounded-xl border border-white/5 bg-white/[0.015] p-6 lg:p-7 transition-all hover:border-white/15 hover:bg-white/[0.03] hover:-translate-y-1 duration-300"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{
                        background: "linear-gradient(135deg, rgba(4,229,243,0.12) 0%, rgba(37,207,108,0.12) 100%)",
                        border: "1px solid rgba(4,229,243,0.2)",
                      }}
                    >
                      <svg className="w-5 h-5 text-[#04E5F3]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        {f.icon}
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-white leading-snug">
                    {f.title}
                  </h3>
                  <p className="mt-2.5 text-[14px] text-white/55 leading-relaxed">{f.desc}</p>
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#25CF6C]/80 font-mono">
                      <span className="w-1 h-1 rounded-full bg-[#25CF6C]" />
                      {f.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Sección "Así se ve el día a día" (screenshots reales) ─── */}
      <section className="relative z-10 border-t border-white/5 py-20 lg:py-28">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#25CF6C]">
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
                El producto en acción
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
              </div>
              <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                Así se ve tu{" "}
                <span
                  className="italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "#25CF6C" }}
                >
                  operación QA.
                </span>
              </h2>
              <p className="mt-5 text-[15px] lg:text-[17px] text-white/55 leading-relaxed">
                Dashboards, Gantt y reportes — todo pensado para ver el estado real de tu equipo en un clic.
              </p>
            </div>
          </Reveal>

          <div className="space-y-16 lg:space-y-24">
            {[
              {
                kicker: "Gantt en tiempo real",
                title: "Ves dónde está cada HU y quién la trabaja.",
                desc: "Un Gantt con las fases de cada asignación — análisis, diseño, ejecución — agrupado por persona. Identificas bloqueos, sobreasignaciones y retrasos sin abrir Excel.",
                bullets: ["Filtros por proyecto, tester y estado", "Línea de hoy marcada", "Vista mensual, semanal o diaria"],
                img: "/landing/gantt.png",
                alt: "Gantt de planificación con barras por tester y fases por asignación",
                reverse: false,
                float: "mockup-float-1",
              },
              {
                kicker: "Reporte semanal · cliente",
                title: "Entregables listos para compartir.",
                desc: "KPIs consolidados del período, gráficos de diseño por semana y por iniciativa. Lo comparte con tu cliente sin armar nada a mano.",
                bullets: ["Vista semanal o mensual", "Copia gráficos como imagen", "Totales por proyecto e iniciativa"],
                img: "/landing/reporte-semanal.png",
                alt: "Reporte semanal con KPIs totales y gráficos de diseño por semana e iniciativa",
                reverse: true,
                float: "mockup-float-2",
              },
              {
                kicker: "Panel de asignaciones",
                title: "Toda la carga del equipo en un solo lugar.",
                desc: "Cada tester con sus HUs activas, estado y progreso. Quién está disponible, quién termina pronto, quién está ocupado. Asigna nuevo trabajo desde aquí.",
                bullets: ["Badges por allocation (50%, 75%, 100%)", "Estado visual por HU", "Filtros por proyecto y tester"],
                img: "/landing/panel-asignaciones.png",
                alt: "Panel de asignaciones con cards de testers y estado de sus HUs",
                reverse: false,
                float: "mockup-float-3",
              },
            ].map((row) => (
              <Reveal key={row.title}>
                <div
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center ${
                    row.reverse ? "lg:[direction:rtl]" : ""
                  }`}
                >
                  {/* Text */}
                  <div className={row.reverse ? "lg:[direction:ltr]" : ""}>
                    <div className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#04E5F3]">
                      <span className="w-5 h-[1px] bg-[#04E5F3]/60" />
                      {row.kicker}
                    </div>
                    <h3 className="mt-4 text-2xl lg:text-[34px] font-bold tracking-tight leading-[1.15] text-white">
                      {row.title}
                    </h3>
                    <p className="mt-4 text-[15px] lg:text-[16px] text-white/60 leading-relaxed">
                      {row.desc}
                    </p>
                    <ul className="mt-6 space-y-2.5">
                      {row.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-[13.5px] text-white/70">
                          <svg
                            className="w-4 h-4 mt-[2px] shrink-0 text-[#25CF6C]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Image */}
                  <div className={row.reverse ? "lg:[direction:ltr]" : ""}>
                    <div className={`mockup-halo ${row.float}`}>
                      <div
                        className={`${row.reverse ? "mockup-tilt-reverse" : "mockup-tilt"} mockup-shine relative rounded-xl overflow-hidden border border-white/10 shadow-[0_30px_60px_-15px_rgba(4,229,243,0.25)]`}
                        style={{ background: "linear-gradient(180deg, #0F1729 0%, #0A0F1A 100%)" }}
                      >
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 bg-black/30">
                          <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                          <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                          <div className="w-2 h-2 rounded-full bg-[#28C840]" />
                        </div>
                        <Image
                          src={row.img}
                          alt={row.alt}
                          width={1536}
                          height={820}
                          className="block w-full h-auto"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sección "Cada perfil ve lo que necesita" ────────────────── */}
      <section className="relative z-10 border-t border-white/5 py-20 lg:py-28">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-14 lg:mb-20">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#25CF6C]">
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
                Para todos en tu operación
                <span className="w-6 h-[1px] bg-[#25CF6C]/60" />
              </div>
              <h2 className="mt-5 text-3xl lg:text-5xl font-bold tracking-tight leading-[1.1]">
                Cada persona ve{" "}
                <span
                  className="italic"
                  style={{ fontFamily: "var(--font-instrument-serif), serif", color: "#25CF6C" }}
                >
                  exactamente lo que necesita.
                </span>
              </h2>
              <p className="mt-5 text-[15px] lg:text-[17px] text-white/55 leading-relaxed">
                El Líder ve todo el equipo. El analista controla su semana. El cliente mira solo sus proyectos. Sin reuniones para preguntar en qué andan.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
              {[
                {
                  persona: "Para el Líder QA",
                  title: "Todo tu equipo, una sola vista",
                  desc: "Ocupación de cada analista, defectos por severidad, lead time por estado, matriz de complejidad. Sin emailes ni stand-ups para saber el estado real.",
                  bullets: [
                    "Gantt con 9 estados por persona",
                    "Ocupación en tiempo real",
                    "Reportes PPTX automáticos",
                  ],
                  color: "#04E5F3",
                },
                {
                  persona: "Para el Analista QA",
                  title: "Controla tu propia semana",
                  desc: "Registra qué hiciste cada día en 30 segundos. Ves tu ocupación visual, las HUs que tienes activas y las fases en las que estás trabajando.",
                  bullets: [
                    "Carga diaria en un formulario",
                    "Vista semanal con ocupación",
                    "Historial de actividades propias",
                  ],
                  color: "#08ACF4",
                },
                {
                  persona: "Para el PM Cliente",
                  title: "Mira solo lo tuyo, en tiempo real",
                  desc: "Tu dashboard privado con KPIs del trabajo QA en tus proyectos. Sin acceso a datos internos del equipo, sin sobrecarga de información.",
                  bullets: [
                    "KPIs del cliente al día",
                    "Defectos por severidad",
                    "Acceso estrictamente solo-lectura",
                  ],
                  color: "#25CF6C",
                },
              ].map((r) => (
                <div
                  key={r.title}
                  className="card-glow rounded-xl border border-white/5 bg-white/[0.015] p-7 lg:p-8 transition-all hover:border-white/15 hover:bg-white/[0.03] hover:-translate-y-1 duration-300"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: r.color }}>
                    {r.persona}
                  </div>
                  <h3 className="mt-3 text-xl lg:text-2xl font-bold tracking-tight text-white leading-[1.2]">
                    {r.title}
                  </h3>
                  <p className="mt-3 text-[14px] text-white/55 leading-relaxed">{r.desc}</p>
                  <ul className="mt-6 pt-5 border-t border-white/5 space-y-2.5">
                    {r.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[13px] text-white/70">
                        <svg
                          className="w-4 h-4 mt-[2px] shrink-0"
                          fill="none"
                          stroke={r.color}
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-white/5 py-20 lg:py-28">
        <div className="mx-auto max-w-[900px] px-6 lg:px-10">
          <Reveal>
            <div
              className="relative rounded-2xl overflow-hidden p-10 lg:p-16 text-center border border-white/10"
              style={{
                background:
                  "radial-gradient(ellipse at top, rgba(4,229,243,0.15) 0%, transparent 60%), linear-gradient(180deg, #0F1729 0%, #0A0F1A 100%)",
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <h2 className="relative text-3xl lg:text-[44px] font-bold tracking-tight leading-[1.1]">
                Empieza a medir lo que{" "}
                <span
                  className="italic text-transparent bg-clip-text"
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    backgroundImage: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)",
                  }}
                >
                  realmente importa.
                </span>
              </h2>
              <p className="relative mt-5 text-[16px] text-white/60 max-w-lg mx-auto leading-relaxed">
                Tu equipo QA merece una plataforma que hable por él. Accede ahora con tu cuenta.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-semibold text-[#0A0F1A] transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(4,229,243,0.45)]"
                  style={{ background: "linear-gradient(135deg, #04E5F3 0%, #25CF6C 100%)" }}
                >
                  Acceder a la plataforma
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a
                  href="mailto:contacto@inovabiz.com?subject=QA%20Metrics%20%E2%80%94%20Consulta"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[14px] font-medium text-white border border-white/15 hover:bg-white/5 transition-colors"
                >
                  Hablar con Inovabiz
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 items-start">
            <div>
              <InovabizLogo className="h-9 w-auto" variant="white" />
              <p className="mt-5 text-[14px] text-white/50 leading-relaxed max-w-md">
                Liberamos el potencial de tu empresa con IA y transformación digital. QA Metrics es parte del ecosistema Inovabiz.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-[13px] lg:items-end">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#04E5F3] mb-1">
                Plataforma
              </div>
              <Link href="/login" className="text-white/60 hover:text-white transition-colors">
                Acceder a QA Metrics
              </Link>
              <a href="#producto" className="text-white/60 hover:text-white transition-colors">
                Cómo funciona
              </a>
              <a href="#beneficios" className="text-white/60 hover:text-white transition-colors">
                Beneficios
              </a>
              <a
                href="mailto:contacto@inovabiz.com"
                className="text-white/60 hover:text-white transition-colors"
              >
                contacto@inovabiz.com
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="text-[12px] text-white/40">
              © 2026 Inovabiz · Todos los derechos reservados
            </div>
            <div className="text-[11px] text-white/30 uppercase tracking-[0.2em]">
              qametrics.cl
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
