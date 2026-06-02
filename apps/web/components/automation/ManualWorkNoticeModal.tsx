"use client";

export function ManualWorkNoticeModal({
  open,
  projectName,
  storyCount,
  onContinue,
  onCancel,
}: {
  open: boolean;
  projectName: string;
  storyCount: number;
  onContinue: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="w-[30rem] max-w-[92vw] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
          <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-[#1F3864] mb-1">Este proyecto ya tiene QA Manual</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              El proyecto <span className="font-semibold">{projectName}</span> ya tiene trabajo de QA Manual
              ({storyCount} {storyCount === 1 ? "historia" : "historias"}). Puedes agregar automatización igualmente;
              ambos tipos de trabajo conviven en el mismo proyecto sin afectarse.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition uppercase tracking-wider">
            Cancelar
          </button>
          <button onClick={onContinue} className="px-4 py-2 text-xs font-medium text-white bg-[#1F3864] hover:bg-[#2E5FA3] rounded-md transition uppercase tracking-wider">
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
