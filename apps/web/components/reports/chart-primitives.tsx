"use client";
import { useRef, useState } from "react";

export async function copyChartAsImage(container: HTMLElement | null): Promise<boolean> {
  if (!container) return false;
  const svg = container.querySelector("svg");
  if (!svg) return false;
  const rect = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("width")) clone.setAttribute("width", String(rect.width));
  if (!clone.getAttribute("height")) clone.setAttribute("height", String(rect.height));
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const imgSrc = `data:image/svg+xml;base64,${svg64}`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("img load"));
    img.src = imgSrc;
  });
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rect.width * scale);
  canvas.height = Math.ceil(rect.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, rect.width, rect.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }
}

export function CopyChartButton({ targetRef }: { targetRef: React.RefObject<HTMLDivElement | null> }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  async function onClick() {
    const ok = await copyChartAsImage(targetRef.current);
    setState(ok ? "copied" : "error");
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <button
      onClick={onClick}
      title="Copiar gráfico como imagen al portapapeles"
      className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition print:hidden ${
        state === "copied" ? "border-green-300 bg-green-50 text-green-700" :
        state === "error" ? "border-red-300 bg-red-50 text-red-700" :
        "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800"
      }`}
    >
      {state === "copied" ? "✓ Copiado" : state === "error" ? "Error" : "Copiar gráfico"}
    </button>
  );
}

export function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="mb-1 font-semibold text-gray-900">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color ?? p.fill ?? p.payload?.fill }} />
          <span className="text-gray-700">{p.name}:</span>
          <span className="font-mono font-semibold tabular-nums text-gray-900">
            {typeof p.value === "number" ? p.value.toLocaleString("es-CL", { maximumFractionDigits: 1 }) : p.value}
            {unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-bold text-[#1F3864]">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={`relative rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md print:shadow-none ${className}`}>
      <CopyChartButton targetRef={ref} />
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

export const CHART_ICONS = {
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  pie: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};
