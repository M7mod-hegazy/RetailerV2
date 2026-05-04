import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, title, onClose, children, maxWidth = "max-w-xl" }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px] transition-opacity" onClick={onClose}>
      <div className={`w-full ${maxWidth} flex flex-col overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-slate-900/5`} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
            {onClose && (
              <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto max-h-[85vh] p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
