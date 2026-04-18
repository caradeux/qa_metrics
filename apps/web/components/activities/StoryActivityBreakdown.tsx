"use client";
import type { Activity } from "@/lib/api-client";
import { CategoryBadge } from "./CategoryBadge";

const TRANSVERSAL_LABEL = "— Sin HU asignada —";

function hours(a: Activity): number {
  return (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 3600000;
}

interface Row {
  storyId: string;
  storyLabel: string;
  storyTitle: string;
  totalHours: number;
  categories: Array<{
    categoryId: string;
    name: string;
    color: string | null;
    hours: number;
  }>;
}

export function StoryActivityBreakdown({ activities }: { activities: Activity[] }) {
  const byStory = new Map<string, Row>();

  for (const a of activities) {
    const h = hours(a);
    if (h <= 0) continue;
    const storyId = a.assignment?.story.id ?? "__transversal__";
    const storyLabel = a.assignment?.story.title ?? TRANSVERSAL_LABEL;
    const row = byStory.get(storyId) ?? {
      storyId,
      storyLabel,
      storyTitle: storyLabel,
      totalHours: 0,
      categories: [],
    };
    row.totalHours += h;
    const cat = row.categories.find((c) => c.categoryId === a.categoryId);
    if (cat) cat.hours += h;
    else
      row.categories.push({
        categoryId: a.categoryId,
        name: a.category.name,
        color: a.category.color,
        hours: h,
      });
    byStory.set(storyId, row);
  }

  const rows = [...byStory.values()].sort((a, b) => {
    // Transversales al final, el resto por horas descendente
    if (a.storyId === "__transversal__") return 1;
    if (b.storyId === "__transversal__") return -1;
    return b.totalHours - a.totalHours;
  });

  const total = rows.reduce((s, r) => s + r.totalHours, 0);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#1F3864]/10 text-[#1F3864]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1F3864]">Horas por Historia (HU)</h3>
            <p className="text-[11px] text-gray-500">
              Dónde se consumieron las horas de capacitación, reuniones y traspaso
            </p>
          </div>
        </div>
        <span className="text-[11px] text-gray-500 font-mono tabular-nums">
          Total: <span className="font-semibold text-gray-900">{total.toFixed(1)}h</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-6 text-center text-sm text-gray-400">
          Sin actividades en el período
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Historia</th>
                <th className="px-4 py-2">Desglose por categoría</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.storyId} className="align-top hover:bg-[#1F3864]/5">
                  <td className="px-4 py-3">
                    <span
                      className={`font-medium ${
                        r.storyId === "__transversal__"
                          ? "italic text-gray-500"
                          : "text-gray-900"
                      }`}
                    >
                      {r.storyLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.categories
                        .sort((a, b) => b.hours - a.hours)
                        .map((c) => (
                          <span
                            key={c.categoryId}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] ring-1 ring-inset ring-gray-200"
                          >
                            <CategoryBadge category={{ name: c.name, color: c.color }} />
                            <span className="font-mono tabular-nums text-gray-700">
                              {c.hours.toFixed(1)}h
                            </span>
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-gray-900">
                    {r.totalHours.toFixed(1)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
