interface BadgeProps {
  variant: "manual" | "azure" | "default";
  children: React.ReactNode;
}

const variants = {
  manual: "bg-emerald-50 text-emerald-700 border-emerald-200",
  azure: "bg-sky-50 text-sky-700 border-sky-200",
  default: "bg-gray-50 text-gray-600 border-gray-200",
};

const dots = {
  manual: "bg-emerald-500",
  azure: "bg-sky-500",
  default: "bg-gray-400",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide uppercase ${variants[variant]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />
      {children}
    </span>
  );
}
