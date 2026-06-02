"use client";

import { useEffect, useRef } from "react";
import {
  RESOURCES, ACTIONS, RESOURCE_LABELS, ACTION_LABELS, RESOURCE_GROUPS, permKey,
} from "@/lib/permissions";

// Checkbox con soporte de estado "indeterminado" (selección parcial de fila/columna/grupo).
function Box({ checked, indeterminate, onChange, disabled }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="w-4 h-4 rounded border-gray-300 accent-[#2E5FA3] cursor-pointer disabled:cursor-default disabled:opacity-50"
    />
  );
}

export function PermissionMatrix({ value, onChange, disabled }: {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const has = (r: string, a: string) => value.has(permKey(r, a));
  const apply = (mut: (s: Set<string>) => void) => { const n = new Set(value); mut(n); onChange(n); };

  // Recursos no asignados a un grupo → "Otros" (defensivo ante nuevos recursos).
  const grouped = new Set(RESOURCE_GROUPS.flatMap((g) => g.resources as string[]));
  const others = RESOURCES.filter((r) => !grouped.has(r));
  const groups = others.length ? [...RESOURCE_GROUPS, { title: "Otros", resources: others }] : RESOURCE_GROUPS;

  const togglePerm = (r: string, a: string) => apply((s) => { const k = permKey(r, a); s.has(k) ? s.delete(k) : s.add(k); });
  const toggleRow = (r: string) => { const all = ACTIONS.every((a) => has(r, a)); apply((s) => ACTIONS.forEach((a) => { const k = permKey(r, a); all ? s.delete(k) : s.add(k); })); };
  const toggleCol = (a: string) => { const all = RESOURCES.every((r) => has(r, a)); apply((s) => RESOURCES.forEach((r) => { const k = permKey(r, a); all ? s.delete(k) : s.add(k); })); };
  const toggleGroup = (rs: readonly string[]) => { const all = rs.every((r) => ACTIONS.every((a) => has(r, a))); apply((s) => rs.forEach((r) => ACTIONS.forEach((a) => { const k = permKey(r, a); all ? s.delete(k) : s.add(k); }))); };

  const rowAll = (r: string) => ACTIONS.every((a) => has(r, a));
  const rowSome = (r: string) => ACTIONS.some((a) => has(r, a));
  const colAll = (a: string) => RESOURCES.every((r) => has(r, a));
  const colSome = (a: string) => RESOURCES.some((r) => has(r, a));
  const grpAll = (rs: readonly string[]) => rs.every((r) => ACTIONS.every((a) => has(r, a)));
  const grpSome = (rs: readonly string[]) => rs.some((r) => ACTIONS.some((a) => has(r, a)));

  const total = RESOURCES.length * ACTIONS.length;
  const selectAll = () => onChange(new Set(RESOURCES.flatMap((r) => ACTIONS.map((a) => permKey(r, a)))));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="max-h-[58vh] overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 text-left px-4 py-2.5 min-w-[230px] shadow-[inset_0_-1px_0_#e2e4e8]">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recurso</span>
              </th>
              {ACTIONS.map((a) => (
                <th key={a} className="sticky top-0 z-10 bg-gray-50 px-2 py-2 w-[88px] shadow-[inset_0_-1px_0_#e2e4e8]">
                  <label className="flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{ACTION_LABELS[a]}</span>
                    <Box checked={colAll(a)} indeterminate={colSome(a)} onChange={() => toggleCol(a)} disabled={disabled} />
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) => [
              <tr key={`grp-${g.title}`} className="bg-gray-50/70">
                <td colSpan={1 + ACTIONS.length} className="px-4 py-1.5 border-y border-gray-100">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <Box checked={grpAll(g.resources)} indeterminate={grpSome(g.resources)} onChange={() => toggleGroup(g.resources)} disabled={disabled} />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.12em]">{g.title}</span>
                  </label>
                </td>
              </tr>,
              ...g.resources.map((r) => (
                <tr key={r} className="border-b border-gray-50 hover:bg-[#2E5FA3]/[0.03]">
                  <td className="p-0">
                    <label className="flex items-center gap-2.5 pl-7 pr-4 h-9 cursor-pointer">
                      <Box checked={rowAll(r)} indeterminate={rowSome(r)} onChange={() => toggleRow(r)} disabled={disabled} />
                      <span className="font-medium text-gray-700">{RESOURCE_LABELS[r]}</span>
                    </label>
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="p-0 text-center">
                      <label className="flex items-center justify-center h-9 cursor-pointer">
                        <Box checked={has(r, a)} onChange={() => togglePerm(r, a)} disabled={disabled} />
                      </label>
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-50/50">
        <span className="text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700 tabular-nums">{value.size}</span> de {total} permisos
        </span>
        {!disabled && (
          <div className="flex items-center gap-3 text-[11px]">
            <button type="button" onClick={selectAll} className="font-medium text-[#2E5FA3] hover:underline">Seleccionar todo</button>
            <button type="button" onClick={() => onChange(new Set())} className="font-medium text-gray-500 hover:underline">Limpiar</button>
          </div>
        )}
      </div>
    </div>
  );
}
