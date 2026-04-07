"use client";

interface KPICardsProps {
  kpis: {
    totalDesigned: number;
    totalExecuted: number;
    totalDefects: number;
    executionRatio: number;
  };
}

export default function KPICards({ kpis }: KPICardsProps) {
  const cards = [
    {
      label: "Diseñados",
      value: kpis.totalDesigned,
      color: "#2E5FA3",
      context: "Casos de prueba totales",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: "Ejecutados",
      value: kpis.totalExecuted,
      color: "#10b981",
      context: "Casos completados",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Defectos",
      value: kpis.totalDefects,
      color: "#ef4444",
      context: "Incidencias registradas",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Ratio de Ejecución",
      value: kpis.executionRatio,
      color: "#8b5cf6",
      context: "Cobertura de ejecución",
      isRatio: true,
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:translate-y-[-1px] overflow-hidden animate-fadeInUp"
          style={{
            borderLeft: `4px solid ${card.color}`,
            animationDelay: `${index * 50}ms`,
          }}
        >
          <div className="p-4 flex flex-col gap-1.5">
            {/* Label */}
            <span className="uppercase tracking-wider text-[11px] text-gray-400 font-medium">
              {card.label}
            </span>

            {/* Value */}
            <span className="font-mono text-3xl font-bold text-gray-900">
              {card.isRatio
                ? `${card.value.toFixed(1)}%`
                : card.value.toLocaleString()}
            </span>

            {/* Mini progress bar for ratio */}
            {card.isRatio && (
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(card.value, 100)}%`,
                    backgroundColor: card.color,
                  }}
                />
              </div>
            )}

            {/* Context */}
            <div className="flex items-center gap-1.5 mt-0.5" style={{ color: card.color }}>
              {card.icon}
              <span className="text-[11px] text-gray-400">{card.context}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
