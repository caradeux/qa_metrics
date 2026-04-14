"use client";

import { use } from "react";
import { CycleBreakdownForm } from "@/components/cycles/CycleBreakdownForm";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-[#1F3864]">
        Desglose del ciclo
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        Captura a nivel de ciclo los casos por tipo y defectos por severidad.
        Solo visible/editable por el Líder QA.
      </p>
      <CycleBreakdownForm cycleId={id} />
    </div>
  );
}
