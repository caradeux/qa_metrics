"use client";

interface TesterRow {
  testerId: string;
  testerName: string;
  designed: number;
  executed: number;
  defects: number;
  ratio: number;
}

interface TesterSummaryTableProps {
  data: TesterRow[];
}

function getRatioColor(ratio: number) {
  if (ratio >= 90) return { bg: "bg-green-500", text: "text-green-700" };
  if (ratio >= 70) return { bg: "bg-amber-500", text: "text-amber-700" };
  return { bg: "bg-red-500", text: "text-red-700" };
}

function Avatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1F3864]/10 text-[10px] font-semibold text-[#1F3864]">
      {letter}
    </span>
  );
}

export default function TesterSummaryTable({ data }: TesterSummaryTableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[540px]">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="pb-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Tester
            </th>
            <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Diseñados
            </th>
            <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Ejecutados
            </th>
            <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Defectos
            </th>
            <th className="pb-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Ratio
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const ratioPercent = Math.round(row.ratio);
            const colors = getRatioColor(ratioPercent);
            return (
              <tr
                key={row.testerId}
                className="border-b border-gray-100 transition hover:bg-gray-50/50"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={row.testerName} />
                    <span className="text-sm font-medium text-gray-900">
                      {row.testerName}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-sm text-gray-700">
                  {row.designed}
                </td>
                <td className="py-3 text-right font-mono text-sm text-gray-700">
                  {row.executed}
                </td>
                <td className="py-3 text-right font-mono text-sm text-gray-700">
                  {row.defects}
                </td>
                <td className="py-3 pl-4 text-right">
                  <div className="relative inline-flex h-6 w-20 items-center justify-end overflow-hidden rounded">
                    <div
                      className={`absolute inset-y-0 left-0 ${colors.bg} opacity-[0.12] rounded`}
                      style={{ width: `${Math.min(ratioPercent, 100)}%` }}
                    />
                    <span
                      className={`relative z-10 font-mono text-sm font-semibold ${colors.text}`}
                    >
                      {ratioPercent}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
