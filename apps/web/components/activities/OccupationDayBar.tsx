"use client";

const WORK_DAY_HOURS = 8;

export function OccupationDayBar({ totalHours }: { totalHours: number }) {
  const pct = Math.min(100, (totalHours / WORK_DAY_HOURS) * 100);
  const overflow = Math.max(0, totalHours - WORK_DAY_HOURS);
  const isOver = totalHours > WORK_DAY_HOURS;

  let barColor = "bg-[#1F3864]";
  let labelColor = "text-[#1F3864]";
  if (isOver) {
    barColor = "bg-amber-500";
    labelColor = "text-amber-600";
  } else if (totalHours === 0) {
    barColor = "bg-gray-200";
    labelColor = "text-gray-400";
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Ocupación del día
        </span>
        <span className={`font-mono text-sm font-bold tabular-nums ${labelColor}`}>
          {totalHours.toFixed(1)}h
          <span className="font-normal text-gray-400"> de {WORK_DAY_HOURS}h</span>
          <span className="ml-2 font-normal text-gray-400">· {Math.round(pct)}%</span>
          {isOver && (
            <span className="ml-2 text-[11px] font-semibold text-amber-600">
              +{overflow.toFixed(1)}h extra
            </span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
