"use client";

interface DashboardFiltersProps {
  cycles: Array<{ id: string; name: string }>;
  testers: Array<{ id: string; name: string }>;
  filters: {
    cycleId: string;
    weekFrom: string;
    weekTo: string;
    testerId: string;
  };
  onFilterChange: (filters: any) => void;
}

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const inputClasses =
  "w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 transition focus:border-[#4A90D9] focus:ring-1 focus:ring-[#4A90D9]/20 focus:outline-none";

const labelClasses =
  "block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1";

export default function DashboardFilters({
  cycles,
  testers,
  filters,
  onFilterChange,
}: DashboardFiltersProps) {
  function update(key: string, value: string) {
    onFilterChange({ ...filters, [key]: value });
  }

  function resetFilters() {
    onFilterChange({ cycleId: "", weekFrom: "", weekTo: "", testerId: "" });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Cycle */}
      <div className="min-w-[160px] flex-1">
        <label className={labelClasses}>Ciclo</label>
        <div className="relative">
          <select
            value={filters.cycleId}
            onChange={(e) => update("cycleId", e.target.value)}
            className={`${inputClasses} appearance-none pr-8`}
          >
            <option value="">Todos los ciclos</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown />
        </div>
      </div>

      {/* Week From */}
      <div className="min-w-[140px]">
        <label className={labelClasses}>Desde</label>
        <input
          type="date"
          value={filters.weekFrom}
          onChange={(e) => update("weekFrom", e.target.value)}
          className={inputClasses}
        />
      </div>

      {/* Week To */}
      <div className="min-w-[140px]">
        <label className={labelClasses}>Hasta</label>
        <input
          type="date"
          value={filters.weekTo}
          onChange={(e) => update("weekTo", e.target.value)}
          className={inputClasses}
        />
      </div>

      {/* Tester */}
      <div className="min-w-[160px] flex-1">
        <label className={labelClasses}>Tester</label>
        <div className="relative">
          <select
            value={filters.testerId}
            onChange={(e) => update("testerId", e.target.value)}
            className={`${inputClasses} appearance-none pr-8`}
          >
            <option value="">Todos los testers</option>
            {testers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ChevronDown />
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={resetFilters}
        className="mb-0.5 whitespace-nowrap text-xs text-gray-400 transition hover:text-gray-600"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
