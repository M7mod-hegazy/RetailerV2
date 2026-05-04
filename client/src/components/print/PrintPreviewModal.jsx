import React, { useRef, useState } from "react";
import Modal from "../ui/Modal";
import InvoiceA4 from "./InvoiceA4";
import Receipt80mm from "./Receipt80mm";
import Receipt58mm from "./Receipt58mm";
import { Printer } from "lucide-react";

const TEMPLATES = [
  { id: "A4",   label: "A4 ورقة كبيرة",   sub: "للمكاتب والفواتير الرسمية" },
  { id: "A5",   label: "A5 ورقة متوسطة",  sub: "نصف الورقة الرسمية" },
  { id: "80mm", label: "80mm حراري",       sub: "طابعات الكاشير القياسية" },
  { id: "58mm", label: "58mm حراري",       sub: "طابعات البون الصغيرة" },
];

/**
 * Full-featured print preview modal: template selector + pan/zoom live preview.
 *
 * Props:
 *   open           boolean
 *   onClose        () => void
 *   invoice        object   – invoice/doc data passed to print templates
 *   settings       object   – store settings (company name, logo, etc.)
 *   operationLabel string   – document type label; appears as receipt_footer
 *   onConfirmPrint function – if provided replaces "طباعة" with a confirm-save-and-print button
 *   confirmLabel   string   – label for that button (default "تأكيد وطباعة")
 */
export default function PrintPreviewModal({
  open,
  onClose,
  invoice = {},
  settings = {},
  operationLabel = "",
  onConfirmPrint,
  confirmLabel = "تأكيد وطباعة",
}) {
  const [template, setTemplate] = useState("A4");
  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  const combinedSettings = { ...settings, receipt_footer: operationLabel };

  const switchTemplate = (t) => {
    setTemplate(t);
    setViewZoom(t === "A4" ? 0.55 : t === "A5" ? 0.72 : 1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setViewZoom((prev) => Math.min(2, Math.max(0.2, prev + (e.deltaY > 0 ? -0.07 : 0.07))));
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    if (viewportRef.current) viewportRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  };

  const resetView = () => {
    setViewZoom(template === "A4" ? 0.55 : template === "A5" ? 0.72 : 1);
    setPan({ x: 0, y: 0 });
  };

  const renderDoc = () => {
    if (template === "58mm") return <Receipt58mm invoice={invoice} settings={combinedSettings} />;
    if (template === "80mm") return <Receipt80mm invoice={invoice} settings={combinedSettings} />;
    return <InvoiceA4 invoice={invoice} settings={combinedSettings} />;
  };

  return (
    <>
      {/* Hidden layer rendered only when window.print() is called */}
      <div className="hidden print:flex w-full justify-center">
        {template === "A5" ? (
          <div className="scale-[0.7] origin-top max-w-[148mm]">
            <InvoiceA4 invoice={invoice} settings={combinedSettings} />
          </div>
        ) : (
          renderDoc()
        )}
      </div>

      <Modal open={open} onClose={onClose} title="إعدادات ومعاينة الطباعة" maxWidth="max-w-6xl">
        <div
          className="flex flex-col md:flex-row gap-6 mt-4"
          style={{ height: "calc(100vh - 160px)", minHeight: "400px" }}
        >
          {/* Left sidebar – templates + actions */}
          <div className="w-full md:w-[220px] flex flex-col gap-4 border-l border-slate-100 pl-4 py-2 shrink-0">
            <div>
              <h4 className="text-[14px] font-black text-slate-800 mb-3 uppercase tracking-wider">
                قوالب الطباعة المُتاحة
              </h4>
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchTemplate(t.id)}
                    className={`flex items-start flex-col px-4 py-3 text-right rounded-[10px] border transition-all ${
                      template === t.id
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm scale-[1.02]"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-bold text-[13px]">{t.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
              {onConfirmPrint ? (
                <button
                  onClick={() => { onConfirmPrint(template); onClose(); }}
                  className="w-full flex justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-[12px] text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)] active:scale-95"
                >
                  <Printer className="h-4 w-4" /> {confirmLabel}
                </button>
              ) : (
                <button
                  onClick={() => window.print()}
                  className="w-full flex justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-[12px] text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)] active:scale-95"
                >
                  <Printer className="h-4 w-4" /> طباعة
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full flex justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-[12px] text-[13px] font-bold transition-all active:scale-95"
              >
                إغلاق
              </button>
            </div>
          </div>

          {/* Preview viewport with pan & zoom */}
          <div
            ref={viewportRef}
            className="flex-1 bg-[#e8ecf0] rounded-[12px] border border-slate-200/60 shadow-inner relative overflow-hidden"
            style={{ cursor: "grab" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${viewZoom})`,
                transformOrigin: "center center",
                transition: isDragging.current ? "none" : "transform 0.05s",
                userSelect: "none",
                pointerEvents: isDragging.current ? "none" : "auto",
                background: "white",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={
                  template === "A5"
                    ? { width: "148mm" }
                    : template === "A4"
                    ? { width: "210mm" }
                    : { width: template }
                }
              >
                {renderDoc()}
              </div>
            </div>

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-[10px] bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm overflow-hidden z-50">
              <button
                type="button"
                onClick={() => setViewZoom((v) => Math.min(2, v + 0.1))}
                className="px-3 py-2 text-[14px] font-black text-slate-700 hover:bg-slate-100 transition-colors border-l border-slate-200"
              >
                +
              </button>
              <button
                type="button"
                onClick={resetView}
                className="px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-colors min-w-[48px] text-center"
              >
                {Math.round(viewZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setViewZoom((v) => Math.max(0.2, v - 0.1))}
                className="px-3 py-2 text-[14px] font-black text-slate-700 hover:bg-slate-100 transition-colors border-r border-slate-200"
              >
                −
              </button>
            </div>

            <div className="absolute top-4 right-4 flex items-center gap-1 rounded-sm bg-black/40 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm pointer-events-none z-50">
              عجلة الفأرة للتكبير • اسحب للتنقل
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
