# Landing pública en /login — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `qametrics.cl/login` en una landing pública con hero dividido (pitch + form), secciones de valor y marca Inovabiz, preservando 100% del flujo de autenticación actual.

**Architecture:** Reescribir `apps/web/app/(auth)/login/page.tsx` como una página larga scrolleable. Hero mantiene la lógica actual de `useAuth`. Logo Inovabiz como componente React reutilizable (`apps/web/components/InovabizLogo.tsx`) con SVG inline. Sin nuevas dependencias ni rutas nuevas. Sin cambios en backend ni en el resto del app.

**Tech Stack:** Next.js 16.2.3 (App Router, Turbopack), React 19.2.4, Tailwind CSS 4, TypeScript, keyframes CSS ya existentes en `globals.css` (`fadeInUp`, `slideIn`, `pulse-glow`).

**Spec:** `qa-metrics/docs/superpowers/specs/2026-04-23-login-landing-design.md`

**Paleta confirmada (variables existentes en `globals.css`):**
- `--primary: #1F3864`
- `--secondary: #2E5FA3`
- `--accent: #4A90D9`
- `--foreground: #1a1a2e`
- `--muted: #6b7280`
- `--border: #e2e4e8`
- Hero gradient: `linear-gradient(160deg, #0D1B2A 0%, #1F3864 60%, #2E5FA3 100%)`

**Convenciones:**
- Todo el texto en español
- SVG inline (no se añaden librerías de iconos)
- Reutilizar las clases de animación existentes en `globals.css`

---

## Task 1: Componente InovabizLogo

**Files:**
- Create: `qa-metrics/apps/web/components/InovabizLogo.tsx`

**Propósito:** componente React que inlinea el SVG del logo Inovabiz. Se usa en header y footer de la landing. Evita depender del endpoint de la API y permite controlar tamaño vía `className`.

- [ ] **Step 1: Crear el componente**

Crear `qa-metrics/apps/web/components/InovabizLogo.tsx` con el contenido completo:

```tsx
interface InovabizLogoProps {
  className?: string;
  /**
   * "white" → logotipo en blanco (para fondos oscuros)
   * "dark" → logotipo en azul oscuro (para fondos claros)
   * El símbolo (la marca) siempre conserva sus gradientes verde-azul.
   */
  variant?: "white" | "dark";
}

export function InovabizLogo({ className, variant = "white" }: InovabizLogoProps) {
  const wordmarkFill = variant === "white" ? "#FFFFFF" : "#1F3864";

  return (
    <svg
      viewBox="0 0 1088 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Inovabiz"
    >
      <defs>
        <linearGradient id="ib-grad-blue" x1="133.334" y1="2.75078" x2="93.1967" y2="49.5568" gradientUnits="userSpaceOnUse">
          <stop stopColor="#04E5F3" />
          <stop offset="1" stopColor="#08ACF4" />
        </linearGradient>
        <linearGradient id="ib-grad-green" x1="20.1174" y1="21.455" x2="123.233" y2="131.388" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25CF6C" />
          <stop offset="1" stopColor="#94CE94" />
        </linearGradient>
      </defs>
      {/* Símbolo (marca) */}
      <path d="M117.292 3.38672C115.361 2.97603 111.804 2.668 109.263 2.77068C106.722 2.77068 103.368 3.28405 101.64 3.79742C99.9128 4.31079 96.8639 6.46695 94.7296 8.6231C92.5954 10.6766 89.953 14.2702 88.835 16.529C87.6155 19.0959 86.9041 22.7921 86.9041 26.2831C86.9041 30.5954 87.6155 33.1622 89.8513 37.0638C91.3758 39.836 94.5264 43.4296 96.6606 44.9697C98.8965 46.4072 102.657 48.2553 105.198 48.8714C108.45 49.6928 111.194 49.6928 114.852 48.974C117.597 48.358 121.357 46.8179 123.085 45.5858C124.914 44.251 127.251 42.0949 128.268 40.6574C129.386 39.22 131.113 36.5505 132.028 34.7023C132.943 32.9569 133.654 28.9526 133.654 26.0777C133.654 22.8948 132.943 18.9932 131.723 16.529C130.707 14.2702 127.861 10.5739 125.32 8.31508C122.881 6.05625 119.223 3.90009 117.292 3.38672Z" fill="url(#ib-grad-blue)" />
      <path d="M50.5664 11.3176C46.6982 9.57525 42.6263 8.65283 37.3329 8.34536C30.4108 8.03788 28.9856 8.34536 22.0635 11.3176C17.4826 13.3674 12.9018 16.3396 10.3569 18.9019C8.11737 21.2592 4.96168 25.8713 3.23115 29.151C0.584442 34.4805 0.279053 36.2229 0.279053 44.4221C0.279053 51.904 0.686238 54.5687 2.62037 58.7709C3.84192 61.5381 6.38683 65.7402 8.11737 67.8925C9.9497 70.1473 13.2072 73.1196 15.4467 74.657C17.6862 76.1943 23.3868 78.9616 28.0694 80.9089C32.8539 82.8562 38.5545 86.0334 40.794 88.0832C43.1353 90.0306 46.1892 93.7202 47.6143 96.2825C49.1413 98.7423 50.8718 102.637 51.5844 104.892C52.3988 107.147 54.1293 111.041 55.5545 113.603C56.9796 116.063 60.0335 119.958 62.273 122.315C64.5125 124.57 68.5844 127.542 71.4347 128.977C75.0994 130.719 78.764 131.539 84.6682 131.847C91.5904 132.257 93.8299 131.949 99.9377 129.695C105.027 127.747 108.285 125.697 111.237 122.623C113.477 120.163 116.53 116.166 117.956 113.603C119.381 111.041 121.111 106.429 121.824 103.354C122.536 100.075 122.842 95.3601 122.536 92.0804C122.129 89.0057 120.501 83.5737 118.77 79.9865C117.141 76.5018 113.986 71.8897 111.848 69.7374C109.71 67.4826 105.638 64.9203 102.279 63.5879C99.0215 62.358 93.6263 59.8983 90.267 58.2584C86.9077 56.6186 82.6323 53.6463 80.7999 51.8015C79.0694 49.9566 76.3209 46.472 74.8958 43.9097C73.4706 41.3474 71.4347 36.7353 70.4167 33.6606C69.3988 30.5859 67.3628 26.1788 65.8359 23.924C64.3089 21.6692 61.5604 18.492 59.6263 16.8521C57.6922 15.2122 53.6203 12.7525 50.5664 11.3176Z" fill="url(#ib-grad-green)" />
      {/* Wordmark "inovabiz" */}
      <path d="M994.146 124.544C992.781 124.544 991.679 124.124 990.84 123.284C990 122.444 989.527 121.447 989.423 120.293C989.318 119.033 989.685 117.878 990.525 116.829L1074.76 10.0774H994.146C992.781 10.0774 991.627 9.76248 990.682 9.13268C989.842 8.39792 989.423 7.29577 989.423 5.82623C989.423 4.67159 989.842 3.6744 990.682 2.83467C991.627 1.99494 992.781 1.57507 994.146 1.57507H1082.48C1083.95 1.57507 1085.05 2.04742 1085.78 2.99213C1086.62 3.83186 1087.09 4.82904 1087.2 5.98368C1087.3 7.13831 1087.04 8.1355 1086.41 8.97523L1001.55 116.041H1082.48C1083.74 116.041 1084.84 116.409 1085.78 117.144C1086.73 117.773 1087.2 118.823 1087.2 120.293C1087.2 121.342 1086.73 122.339 1085.78 123.284C1084.84 124.124 1083.74 124.544 1082.48 124.544H994.146Z" fill={wordmarkFill} />
      <path d="M943.008 124.544C941.644 124.544 940.489 124.124 939.544 123.284C938.705 122.339 938.285 121.185 938.285 119.82V6.29858C938.285 4.93401 938.705 3.83186 939.544 2.99213C940.489 2.04742 941.644 1.57507 943.008 1.57507C944.373 1.57507 945.475 2.04742 946.315 2.99213C947.259 3.83186 947.732 4.93401 947.732 6.29858V119.82C947.732 121.185 947.259 122.339 946.315 123.284C945.475 124.124 944.373 124.544 943.008 124.544Z" fill={wordmarkFill} />
      <path d="M819.289 124.544C817.505 124.544 816.036 124.176 814.881 123.442C813.726 122.602 813.149 121.395 813.149 119.82V6.29858C813.149 4.82904 813.569 3.6744 814.409 2.83467C815.353 1.99494 816.508 1.57507 817.872 1.57507H856.448C862.326 1.57507 867.679 2.88716 872.508 5.51132C877.336 8.03053 881.22 11.5469 884.159 16.0605C887.098 20.4691 888.568 25.56 888.568 31.3332C888.568 37.4212 886.941 42.7745 883.687 47.3931C880.538 51.9067 876.391 55.3181 871.248 57.6274C878.386 59.6217 884.107 63.2956 888.41 68.6489C892.819 74.0022 895.023 80.72 895.023 88.8025C895.023 95.7303 893.449 101.923 890.3 107.382C887.256 112.735 883.004 116.934 877.546 119.978C872.088 123.022 865.842 124.544 858.81 124.544H819.289ZM822.596 115.097H858.81C864.058 115.097 868.676 113.995 872.665 111.79C876.654 109.481 879.803 106.384 882.112 102.501C884.421 98.5119 885.576 93.9459 885.576 88.8025C885.576 83.7641 884.421 79.303 882.112 75.4192C879.803 71.5355 876.654 68.4914 872.665 66.2871C868.676 64.0828 864.058 62.9807 858.81 62.9807H822.596V115.097ZM822.596 53.5336H856.448C863.061 53.5336 868.466 51.5393 872.665 47.5505C876.969 43.4568 879.121 38.051 879.121 31.3332C879.121 24.8252 876.969 19.8393 872.665 16.3754C868.466 12.8065 863.061 11.0221 856.448 11.0221H822.596V53.5336Z" fill={wordmarkFill} />
      <path d="M675.514 124.544C673.519 124.544 672.102 123.756 671.263 122.182C670.528 120.607 670.528 119.138 671.263 117.773L718.97 4.88152C719.81 2.67722 721.332 1.57507 723.536 1.57507C725.635 1.57507 727.157 2.67722 728.102 4.88152L775.967 117.773C776.807 119.243 776.754 120.765 775.809 122.339C774.865 123.809 773.5 124.544 771.716 124.544C770.666 124.544 769.774 124.334 769.039 123.914C768.409 123.389 767.832 122.602 767.307 121.552L721.017 11.1795H726.055L679.922 121.552C679.502 122.602 678.925 123.389 678.19 123.914C677.456 124.334 676.563 124.544 675.514 124.544ZM687.165 93.6834L690.944 85.1811H756.443L760.064 93.6834H687.165Z" fill={wordmarkFill} />
      <path d="M604.844 124.544C602.849 124.544 601.432 123.547 600.593 121.552L553.357 9.29013C552.308 6.87589 552.255 4.98649 553.2 3.62193C554.25 2.25736 555.667 1.57507 557.451 1.57507C559.446 1.57507 560.968 2.67722 562.017 4.88152L607.363 113.365H602.797L647.513 5.51132C648.038 4.04179 648.72 3.04461 649.56 2.51977C650.399 1.88997 651.449 1.57507 652.709 1.57507C654.598 1.57507 655.858 2.36232 656.487 3.93682C657.117 5.51132 657.012 7.29576 656.173 9.29013L609.095 121.552C608.57 122.707 607.888 123.494 607.048 123.914C606.313 124.334 605.579 124.544 604.844 124.544Z" fill={wordmarkFill} />
      <path d="M459.653 126.118C450.626 126.118 442.281 124.543 434.619 121.394C426.956 118.245 420.238 113.837 414.465 108.168C408.797 102.395 404.388 95.6773 401.239 88.0147C398.09 80.3521 396.516 72.0073 396.516 62.9801C396.516 53.953 398.09 45.6606 401.239 38.103C404.388 30.4404 408.797 23.775 414.465 18.1068C420.238 12.3336 426.956 7.87251 434.619 4.7235C442.281 1.5745 450.626 0 459.653 0C468.681 0 476.973 1.5745 484.531 4.7235C492.193 7.87251 498.859 12.3336 504.527 18.1068C510.3 23.775 514.761 30.4404 517.91 38.103C521.059 45.6606 522.634 53.953 522.634 62.9801C522.634 72.0073 521.059 80.3521 517.91 88.0147C514.761 95.6773 510.3 102.395 504.527 108.168C498.859 113.837 492.193 118.245 484.531 121.394C476.973 124.543 468.681 126.118 459.653 126.118ZM459.653 116.671C467.211 116.671 474.244 115.359 480.752 112.734C487.26 110.005 492.928 106.226 497.756 101.398C502.69 96.4645 506.469 90.7438 509.093 84.2359C511.822 77.7279 513.187 70.6427 513.187 62.9801C513.187 55.4225 511.822 48.3897 509.093 41.8818C506.469 35.3738 502.69 29.7056 497.756 24.8771C492.928 19.9437 487.26 16.1649 480.752 13.5407C474.244 10.8116 467.211 9.44702 459.653 9.44702C451.991 9.44702 444.906 10.8116 438.398 13.5407C431.89 16.1649 426.169 19.9437 421.236 24.8771C416.407 29.7056 412.628 35.3738 409.899 41.8818C407.275 48.3897 405.963 55.4225 405.963 62.9801C405.963 70.6427 407.275 77.7279 409.899 84.2359C412.628 90.7438 416.407 96.4645 421.236 101.398C426.169 106.226 431.89 110.005 438.398 112.734C444.906 115.359 451.991 116.671 459.653 116.671Z" fill={wordmarkFill} />
      <path d="M259.333 124.544C257.968 124.544 256.813 124.124 255.869 123.284C255.029 122.339 254.609 121.185 254.609 119.82V6.29858C254.609 4.93401 255.029 3.83186 255.869 2.99213C256.813 2.04742 257.968 1.57507 259.333 1.57507C260.802 1.57507 262.009 2.09991 262.954 3.14957L342.939 107.224V6.29858C342.939 4.93401 343.359 3.83186 344.198 2.99213C345.143 2.04742 346.298 1.57507 347.662 1.57507C348.922 1.57507 350.024 2.04742 350.969 2.99213C351.913 3.83186 352.386 4.93401 352.386 6.29858V119.82C352.386 121.185 351.913 122.339 350.969 123.284C350.024 124.124 348.922 124.544 347.662 124.544C346.927 124.544 346.245 124.439 345.615 124.229C345.091 123.914 344.618 123.547 344.198 123.127L264.056 18.8946V119.82C264.056 121.185 263.584 122.339 262.639 123.284C261.799 124.124 260.697 124.544 259.333 124.544Z" fill={wordmarkFill} />
      <path d="M199.54 124.544C198.176 124.544 197.021 124.124 196.076 123.284C195.237 122.339 194.817 121.185 194.817 119.82V6.29858C194.817 4.93401 195.237 3.83186 196.076 2.99213C197.021 2.04742 198.176 1.57507 199.54 1.57507C200.905 1.57507 202.007 2.04742 202.847 2.99213C203.792 3.83186 204.264 4.93401 204.264 6.29858V119.82C204.264 121.185 203.792 122.339 202.847 123.284C202.007 124.124 200.905 124.544 199.54 124.544Z" fill={wordmarkFill} />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar que tipa correctamente**

Run desde `qa-metrics/apps/web`:
```bash
npx tsc --noEmit
```
Expected: sin errores relacionados con `InovabizLogo.tsx`.

- [ ] **Step 3: Commit**

```bash
cd qa-metrics
git add apps/web/components/InovabizLogo.tsx
git commit -m "feat(web): add InovabizLogo component with inline SVG"
```

---

## Task 2: Añadir scroll suave global

**Files:**
- Modify: `qa-metrics/apps/web/app/globals.css`

**Propósito:** habilitar scroll suave al navegar por los anchor links de la landing (`#funcionalidades`, `#roles`, `#contacto`).

- [ ] **Step 1: Agregar `scroll-behavior: smooth`**

Editar `qa-metrics/apps/web/app/globals.css`. Después del bloque `@import "tailwindcss";` agregar la regla `html`:

Cambiar la parte inicial del archivo de:

```css
@import "tailwindcss";

:root {
```

a:

```css
@import "tailwindcss";

html {
  scroll-behavior: smooth;
}

:root {
```

- [ ] **Step 2: Verificar que compila**

Run desde `qa-metrics`:
```bash
npm run dev
```
Abrir http://localhost:3000 y ver que no hay error de CSS en consola. Ctrl+C para cerrar.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): enable smooth scroll for anchor navigation"
```

---

## Task 3: Refactor del login — hero dividido con pitch del brochure

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** reemplazar el contenido decorativo del panel oscuro por el pitch del brochure. El panel derecho (form) se mantiene idéntico. Aún NO se añaden secciones bajo el hero — eso viene en tasks 4-8.

- [ ] **Step 1: Reemplazar el contenido del panel oscuro del hero**

En `qa-metrics/apps/web/app/(auth)/login/page.tsx`, ubicar el bloque actual entre los comentarios `{/* ── Left Panel: Dark branding ──────────────────────────── */}` y `{/* ── Right Panel: Login form ────────────────────────────── */}`.

Reemplazar ese panel completo por:

```tsx
      {/* ── Left Panel: Dark hero (landing pitch) ───────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
        style={{
          background: "linear-gradient(160deg, #0D1B2A 0%, #1F3864 60%, #2E5FA3 100%)",
        }}
      >
        {/* Decorative: dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Decorative: bar chart + line */}
        <div className="absolute bottom-0 left-0 right-0 h-[60%] overflow-hidden pointer-events-none">
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

        {/* Top: kicker */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[2px] bg-[#4A90D9]" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-[#4A90D9] font-medium">
              La plataforma QA de Inovabiz
            </span>
          </div>
        </div>

        {/* Middle: headline + lead */}
        <div className="relative z-10">
          <h1
            className="text-white text-5xl font-bold tracking-tight leading-[1.05]"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            QA Metrics
          </h1>
          <p className="mt-3 text-xl text-[#8BA4C4] font-light leading-snug max-w-md">
            Métricas de calidad que hablan por tu equipo.
          </p>
          <div
            className="mt-6 h-[2px] w-20 origin-left"
            style={{
              background: "linear-gradient(90deg, #4A90D9 0%, transparent 100%)",
              animation: "slideIn 0.8s ease-out 0.3s both",
            }}
          />
          <p className="mt-6 text-[#8BA4C4] text-sm font-light leading-relaxed max-w-md">
            Centraliza la operación QA de todos tus proyectos en una sola plataforma. Dashboards en
            tiempo real, reportes automáticos por cliente y visibilidad del trabajo real de cada
            analista.
          </p>
        </div>

        {/* Bottom: stats trio */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { n: "4", u: "roles", label: "RBAC granular" },
            { n: "2", u: "modalidades", label: "Azure DevOps o Manual" },
            { n: "∞", u: "clientes", label: "Multi-tenant real" },
          ].map((s) => (
            <div
              key={s.u}
              className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-white text-2xl font-bold leading-none">
                {s.n} <span className="text-[#4A90D9] text-sm font-semibold align-middle">{s.u}</span>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#8BA4C4]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
```

El panel derecho (form) NO se toca en este task.

- [ ] **Step 2: Verificar visual y funcionalidad**

Run desde `qa-metrics`:
```bash
npm run dev
```
Abrir http://localhost:3000/login (redirige desde `/`) en Chrome. Verificar:
- Panel izquierdo muestra: kicker "LA PLATAFORMA QA DE INOVABIZ", título "QA Metrics", subtítulo, lead, y los 3 stats
- Panel derecho muestra el form igual que antes
- Login con `admin@qametrics.com` / `QaMetrics2024!` sigue funcionando y redirige a `/dashboard`
Ctrl+C para cerrar.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): replace decorative hero with QA Metrics pitch"
```

---

## Task 4: Barra superior sticky con nav

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** añadir navbar sticky con logo Inovabiz, anchor links y CTA. Se renderiza por encima del hero, tanto en desktop como mobile.

- [ ] **Step 1: Importar InovabizLogo**

En la cabecera de `qa-metrics/apps/web/app/(auth)/login/page.tsx`, junto con los demás imports, agregar:

```tsx
import { InovabizLogo } from "@/components/InovabizLogo";
```

- [ ] **Step 2: Envolver el layout actual y añadir la navbar**

El componente actualmente retorna un `<div className="min-h-screen flex">...</div>` con dos paneles. Transformar el return en una estructura con navbar sticky + contenedor principal:

Cambiar la raíz del JSX de:

```tsx
  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: Dark hero (landing pitch) ───────────────────── */}
```

a:

```tsx
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Top navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[rgba(13,27,42,0.7)] border-b border-white/10">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between px-6 lg:px-10 h-16">
          <a href="#top" className="flex items-center" aria-label="Inicio">
            <InovabizLogo className="h-7 w-auto" variant="white" />
          </a>
          <nav className="flex items-center gap-1 lg:gap-2">
            <a
              href="#funcionalidades"
              className="hidden lg:inline-block px-3 py-2 text-[13px] font-medium uppercase tracking-[0.12em] text-[#8BA4C4] hover:text-white transition-colors"
            >
              Funcionalidades
            </a>
            <a
              href="#roles"
              className="hidden lg:inline-block px-3 py-2 text-[13px] font-medium uppercase tracking-[0.12em] text-[#8BA4C4] hover:text-white transition-colors"
            >
              Roles
            </a>
            <a
              href="#contacto"
              className="hidden lg:inline-block px-3 py-2 text-[13px] font-medium uppercase tracking-[0.12em] text-[#8BA4C4] hover:text-white transition-colors"
            >
              Contacto
            </a>
            <a
              href="#login-form"
              className="ml-2 inline-flex items-center px-4 py-2 rounded-sm border border-white/20 text-[12px] font-semibold uppercase tracking-[0.15em] text-white hover:bg-white/10 transition-colors"
            >
              Iniciar sesión
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero section ───────────────────────────────────────────── */}
      <section id="top" className="flex flex-1 min-h-[calc(100vh-64px)]">
        {/* ── Left Panel: Dark hero (landing pitch) ───────────────────── */}
```

Cerrar el `<section>` del hero. Justo antes del cierre final `</div>` que cierra el root, añadir el cierre del section:

Cambiar el final del componente de:

```tsx
          <div className="mt-12 pt-6 border-t border-[#e2e4e8]" style={{ animation: "fadeInUp 0.4s ease-out 0.45s both" }}>
            <p className="text-[11px] text-[#9ca3af] text-center tracking-wide">QA METRICS COMMAND CENTER</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

a:

```tsx
          <div className="mt-12 pt-6 border-t border-[#e2e4e8]" style={{ animation: "fadeInUp 0.4s ease-out 0.45s both" }}>
            <p className="text-[11px] text-[#9ca3af] text-center tracking-wide">QA METRICS COMMAND CENTER</p>
          </div>
        </div>
      </div>
      </section>
      {/* Sections (funcionalidades, roles, contacto) vendrán en tasks siguientes */}
    </div>
  );
}
```

- [ ] **Step 3: Añadir `id="login-form"` al contenedor del form**

En el panel derecho (donde vive el form), agregar `id="login-form"` al contenedor principal. Localizar:

```tsx
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-white relative">
```

Cambiar a:

```tsx
      <div id="login-form" className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-white relative scroll-mt-16">
```

Esto permite que en mobile el botón "Iniciar sesión" de la navbar haga scroll al form correctamente (con offset para el sticky header).

- [ ] **Step 4: Verificar visual y navegación**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login:
- La navbar aparece en la parte superior con el logo Inovabiz a la izquierda
- Los links "Funcionalidades", "Roles", "Contacto" se ven en desktop
- En mobile (DevTools responsive <1024px) solo se ve el CTA "Iniciar sesión"
- Click en "Iniciar sesión" en mobile hace scroll al form
- Login sigue funcionando

Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): add sticky navbar with Inovabiz logo and anchor nav"
```

---

## Task 5: Sección "¿Qué resuelve?" (Pain vs Gain)

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** agregar la primera sección bajo el hero, con comparación "Antes" (Excel) vs "Con QA Metrics".

- [ ] **Step 1: Añadir la sección después del cierre del hero**

Localizar el comentario `{/* Sections (funcionalidades, roles, contacto) vendrán en tasks siguientes */}` y reemplazarlo por:

```tsx
      {/* ── Sección: ¿Qué resuelve? ────────────────────────────────── */}
      <section id="funcionalidades" className="bg-white py-20 lg:py-24 scroll-mt-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1F3864]">
              <span className="w-7 h-[1px] bg-[#1F3864]" />
              Problema → Solución
              <span className="w-7 h-[1px] bg-[#1F3864]" />
            </div>
            <h2 className="mt-5 text-3xl lg:text-4xl font-bold tracking-tight text-[#1a1a2e] max-w-2xl mx-auto leading-tight">
              Del Excel disperso a una sola fuente de verdad.
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Antes (pain) */}
            <div className="rounded-lg border border-[#FCA5A5]/40 bg-[#FEF2F2] p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#FEE2E2] flex items-center justify-center text-[#DC2626] font-bold">
                  ✕
                </div>
                <h3 className="text-lg font-semibold text-[#DC2626] uppercase tracking-[0.12em]">
                  Antes
                </h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Un Excel por cliente",
                  "Horas estimadas sin respaldo",
                  "Fechas que cambian sin rastro",
                  "Reportes armados a mano",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-3 text-[15px] text-[#7F1D1D] leading-relaxed"
                  >
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* Con QA Metrics (gain) */}
            <div className="rounded-lg border border-[#1F3864]/20 bg-[#F4F8FD] p-6 lg:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#1F3864] flex items-center justify-center text-white font-bold">
                  ✓
                </div>
                <h3 className="text-lg font-semibold text-[#1F3864] uppercase tracking-[0.12em]">
                  Con QA Metrics
                </h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Una plataforma para todos",
                  "Registro diario por analista",
                  "Auditoría completa de cambios",
                  "Dashboards y reportes en vivo",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-3 text-[15px] text-[#1F3864] leading-relaxed"
                  >
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#2E5FA3] shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verificar visual**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login:
- Después del hero aparece la sección con las 2 columnas (Antes vs Con QA Metrics)
- En mobile las 2 columnas se apilan
- Click en "Funcionalidades" de la navbar hace scroll suave a la sección (con offset del sticky header)

Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): add Pain vs Gain section to login landing"
```

---

## Task 6: Sección "Cómo funciona" (4 feature cards)

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** grid 2×2 con las 4 capacidades clave.

- [ ] **Step 1: Agregar la sección después de la anterior**

Inmediatamente después del `</section>` de la Task 5 (cierre de `#funcionalidades`), agregar:

```tsx
      {/* ── Sección: Cómo funciona ────────────────────────────────── */}
      <section className="bg-[#F8FAFC] py-20 lg:py-24 border-y border-[#e2e4e8]">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1F3864]">
              <span className="w-7 h-[1px] bg-[#1F3864]" />
              Capacidades
              <span className="w-7 h-[1px] bg-[#1F3864]" />
            </div>
            <h2 className="mt-5 text-3xl lg:text-4xl font-bold tracking-tight text-[#1a1a2e] max-w-2xl mx-auto leading-tight">
              Todo lo que tu operación QA necesita.
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              {
                title: "Multi-cliente · multi-proyecto",
                desc: "Un dashboard por cliente con aislamiento real de datos. Cada PM ve solo lo suyo.",
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                ),
              },
              {
                title: "Azure DevOps + Manual",
                desc: "Integración solo-lectura con ADO (API v7) o carga diaria vía formulario. Un modo por proyecto.",
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4zM8 6h.01M8 12h.01M8 18h.01"
                  />
                ),
              },
              {
                title: "Dashboards y reportes",
                desc: "Métricas diarias, ocupación del equipo, Gantt de asignaciones y reportes automáticos por cliente.",
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 19v-6m4 6V9m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                ),
              },
              {
                title: "RBAC granular",
                desc: "Permisos por recurso y acción. Admin, Líder QA, Analista y PM Cliente con alcances distintos y auditables.",
                icon: (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 15v2m0 0v2m0-2h2m-2 0h-2M9 9a3 3 0 116 0v3H9V9zm-3 3h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z"
                  />
                ),
              },
            ].map((f) => (
              <div
                key={f.title}
                className="relative flex gap-5 p-6 lg:p-7 bg-white rounded-lg border border-[#e2e4e8] card-hover"
              >
                <div className="absolute left-0 top-6 bottom-6 w-[3px] bg-[#1F3864] rounded-r" />
                <div className="shrink-0 w-11 h-11 rounded-md bg-[#1F3864]/10 flex items-center justify-center text-[#1F3864]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.icon}
                  </svg>
                </div>
                <div>
                  <h3 className="text-base lg:text-lg font-semibold text-[#1a1a2e] tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#6b7280] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verificar visual**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login:
- La sección "Capacidades" aparece después de "Problema → Solución" con fondo gris claro
- 4 cards en grid 2×2 en desktop, 1 columna en mobile
- Al hover, las cards levantan (`card-hover` ya definido en globals.css)

Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): add Cómo funciona section with 4 feature cards"
```

---

## Task 7: Sección "Para quién" (4 roles)

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** grid con las 4 personas/roles del sistema.

- [ ] **Step 1: Agregar la sección**

Inmediatamente después del `</section>` de la Task 6, agregar:

```tsx
      {/* ── Sección: Para quién (roles) ────────────────────────────── */}
      <section id="roles" className="bg-white py-20 lg:py-24 scroll-mt-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1F3864]">
              <span className="w-7 h-[1px] bg-[#1F3864]" />
              Roles
              <span className="w-7 h-[1px] bg-[#1F3864]" />
            </div>
            <h2 className="mt-5 text-3xl lg:text-4xl font-bold tracking-tight text-[#1a1a2e] max-w-2xl mx-auto leading-tight">
              Un rol para cada perfil del equipo.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                initial: "A",
                name: "Admin",
                desc: "Configura la plataforma, roles y permisos. Ve todo.",
              },
              {
                initial: "L",
                name: "Líder QA",
                desc: "Gestiona clientes, proyectos, ciclos y analistas.",
              },
              {
                initial: "Q",
                name: "Analista QA",
                desc: "Registra su trabajo diario, gestiona sus stories y ciclos.",
              },
              {
                initial: "P",
                name: "PM Cliente",
                desc: "Acceso solo-lectura a los proyectos de su cliente.",
              },
            ].map((r) => (
              <div
                key={r.name}
                className="rounded-lg border border-[#e2e4e8] bg-white p-6 text-center card-hover"
              >
                <div
                  className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                  style={{
                    background: "linear-gradient(135deg, #1F3864 0%, #2E5FA3 100%)",
                  }}
                >
                  {r.initial}
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1F3864]">
                  {r.name}
                </div>
                <p className="mt-3 text-sm text-[#6b7280] leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verificar visual**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login:
- Aparece la sección "Roles" con 4 cards en fila en desktop (1200px+), 2 en tablet, 1 en mobile
- Cada card tiene un círculo con gradiente azul y la inicial
- Click en "Roles" en la navbar hace scroll suave a la sección

Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): add Roles section with 4 persona cards"
```

---

## Task 8: Footer

**Files:**
- Modify: `qa-metrics/apps/web/app/(auth)/login/page.tsx`

**Propósito:** footer oscuro con logo Inovabiz grande + tagline + meta info.

- [ ] **Step 1: Agregar el footer**

Inmediatamente después del `</section>` de la Task 7, antes del cierre `</div>` que cierra el root, agregar:

```tsx
      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer id="contacto" className="bg-[#0D1B2A] text-[#8BA4C4] scroll-mt-16">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <InovabizLogo className="h-11 w-auto" variant="white" />
            <p className="mt-5 text-sm leading-relaxed max-w-md">
              Liberamos el potencial de tu empresa con IA y transformación digital.
            </p>
          </div>
          <div className="flex flex-col lg:items-end gap-3 text-sm">
            <a
              href="https://qametrics.cl"
              className="hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              qametrics.cl
            </a>
            <div className="text-[#8BA4C4]/60 text-[12px]">© 2026 Inovabiz</div>
          </div>
        </div>
      </footer>
```

- [ ] **Step 2: Verificar visual**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login:
- El footer aparece al final, fondo azul muy oscuro (#0D1B2A)
- Logo Inovabiz grande a la izquierda
- Tagline debajo del logo
- A la derecha en desktop: link qametrics.cl y copyright
- Click en "Contacto" en la navbar hace scroll al footer

Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "feat(web): add footer with Inovabiz branding"
```

---

## Task 9: Metadata SEO

**Files:**
- Create: `qa-metrics/apps/web/app/(auth)/login/layout.tsx`

**Propósito:** añadir `<title>` y `<meta description>`. Como `page.tsx` es un client component (`"use client"`), Next 16 no permite exportar `metadata` desde ahí. Se debe definir en un server component — un `layout.tsx` propio de `/login` es la forma limpia.

- [ ] **Step 1: Revisar docs de Next 16 para `metadata` en rutas con client components**

Verificar `qa-metrics/node_modules/next/dist/docs/` si existe una guía de `app-router/building-your-application/optimizing/metadata.md` para confirmar que `layout.tsx` server component puede coexistir con `page.tsx` client component en la misma carpeta. Si no hay doc, la forma estándar de App Router sigue siendo:

- Un `layout.tsx` sin `"use client"` exporta `metadata`.
- El `page.tsx` con `"use client"` queda anidado.

- [ ] **Step 2: Crear el layout del login con metadata**

Crear `qa-metrics/apps/web/app/(auth)/login/layout.tsx` con el contenido:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QA Metrics · Plataforma QA de Inovabiz",
  description:
    "Centraliza la operación QA de todos tus proyectos. Dashboards, reportes y visibilidad del trabajo real de cada analista.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 3: Verificar que la metadata aparece**

Run desde `qa-metrics`:
```bash
npm run dev
```

Abrir http://localhost:3000/login. En la pestaña del navegador el título debe ser "QA Metrics · Plataforma QA de Inovabiz". Inspeccionar `<head>` en DevTools y confirmar que `<meta name="description">` está presente con el texto correcto.

Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/login/layout.tsx
git commit -m "feat(web): add SEO metadata for login landing"
```

---

## Task 10: Verificación final (desktop + mobile + login real)

**Files:** ninguno.

**Propósito:** test manual end-to-end que confirma los 8 criterios de aceptación del spec.

- [ ] **Step 1: Levantar dev server**

```bash
cd qa-metrics
npm run dev
```

- [ ] **Step 2: Checklist manual desktop (ventana ≥ 1280px)**

Abrir http://localhost:3000/login en Chrome. Verificar uno a uno:

- [ ] Se ve la landing con form visible en el hero (sin scroll)
- [ ] El panel oscuro muestra kicker + título "QA Metrics" + subtítulo + lead + 3 stats
- [ ] Barra superior sticky: logo Inovabiz a la izquierda, links + CTA a la derecha
- [ ] Click en "Funcionalidades" → scroll suave a la sección "Problema → Solución"
- [ ] Click en "Roles" → scroll suave a la sección roles
- [ ] Click en "Contacto" → scroll suave al footer
- [ ] Las 4 secciones (pain/gain, capacidades, roles, footer) se ven correctamente en orden
- [ ] Hover en feature cards levanta las cards
- [ ] Logo Inovabiz en header y footer se ve con sus gradientes verde/azul originales

- [ ] **Step 3: Checklist manual mobile (DevTools responsive, <1024px)**

Con DevTools activa el modo responsive a 375px (iPhone SE):

- [ ] Panel oscuro colapsa (desaparece en <lg), queda solo el form arriba
- [ ] Links de la navbar se ocultan; solo se ve el CTA "Iniciar sesión"
- [ ] Click en "Iniciar sesión" hace scroll al form (con offset correcto, no queda oculto bajo la navbar)
- [ ] Secciones "Problema → Solución", "Capacidades", "Roles" se apilan en 1 columna
- [ ] Footer se apila en 1 columna

- [ ] **Step 4: Test de login real**

En desktop:
- Ingresar `admin@qametrics.com` / `QaMetrics2024!` y presionar "Iniciar Sesión"
- Expected: redirige a `/dashboard` correctamente (comportamiento preservado)

- [ ] **Step 5: Test de usuario autenticado**

Con sesión abierta, abrir http://localhost:3000/login en otra pestaña:
- Expected: redirige automáticamente a `/dashboard` (lógica del `useEffect` preservada)

- [ ] **Step 6: Test de error de login**

Cerrar sesión. Intentar login con credenciales incorrectas:
- Expected: muestra el mensaje de error en rojo debajo del form, igual que antes

- [ ] **Step 7: Build production**

Verificar que el build production funciona:

```bash
npm run build -w @qa-metrics/web
```

Expected: build exitoso sin errores de TypeScript ni de Next.js.

- [ ] **Step 8: Commit del estado final**

Si hubo correcciones durante la verificación:
```bash
git add -u
git commit -m "fix(web): adjustments from manual QA on login landing"
```

Si no hubo cambios, no se commitea nada adicional.

---

## Criterios de aceptación (del spec)

Al terminar todas las tasks, estos 8 puntos del spec deben cumplirse:

1. ✅ Al abrir `https://qametrics.cl/login` en desktop se ve la landing completa con el formulario visible sin scroll (Task 3, 4)
2. ✅ El usuario puede loguearse exactamente igual que antes (Task 3 preserva lógica del form; Task 10.4 verifica)
3. ✅ Al hacer scroll aparecen las 4 secciones en orden (Task 5, 6, 7, 8)
4. ✅ En mobile <1024px el panel oscuro colapsa y el form es usable (Task 10.3)
5. ✅ Logo Inovabiz en barra superior y footer con gradientes originales (Task 1, 4, 8)
6. ✅ Links de la barra hacen scroll suave (Task 2 scroll-behavior, Task 4 anchors, Task 10.2)
7. ✅ Usuario autenticado es redirigido a `/dashboard` (lógica preservada Task 3, verificada Task 10.5)
8. ✅ No hay cambios en backend ni en otras rutas (revisión: todas las modifs son solo en `apps/web`)
