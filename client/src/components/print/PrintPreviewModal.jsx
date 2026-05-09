import React, { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal";
import { PrintThermalDoc, PrintA4Doc } from "./PrintDoc";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Printer, Wand2 } from "lucide-react";
import api from "../../services/api";
import { DOC_PAPER_CONFIG, resolveDocPaperSize } from "../../pages/settings/PrintingSettingsPanel";

const ALL_TEMPLATES = [
  { id: "58mm", label: "58mm حراري",       sub: "طابعات البون الصغيرة"   },
  { id: "80mm", label: "80mm حراري",       sub: "طابعات الكاشير القياسية" },
  { id: "A5",   label: "A5 ورقة متوسطة",  sub: "نصف الورقة الرسمية"     },
  { id: "A4",   label: "A4 ورقة كبيرة",   sub: "للمكاتب والفواتير الرسمية" },
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
 *   onSaveOnly     function – if provided shows "حفظ فقط" button alongside save-and-print
 *   saveOnlyLabel  string   – label for save-only button (default "حفظ فقط")
 *   isSaving       boolean  – shows loading state on save buttons
 */
export default function PrintPreviewModal({
  open,
  onClose,
  invoice = {},
  settings: globalSettings = {},
  operationLabel = "",
  renderContent,
  docType,
  onConfirmPrint,
  confirmLabel = "تأكيد وطباعة",
  onSaveOnly,
  saveOnlyLabel = "حفظ فقط",
  isSaving = false,
  reportColumns = [],
  totalRows = 0,
  onExportAllColumns,
}) {
  const [template, setTemplate] = useState(null); // null = not yet resolved
  const [viewZoom, setViewZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [docSettings, setDocSettings] = useState({});
  const [reportPrintKeys, setReportPrintKeys] = useState([]);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  // Valid templates for this doc type
  const cfg = docType ? (DOC_PAPER_CONFIG[docType] || null) : null;
  const validTemplates = cfg ? ALL_TEMPLATES.filter(t => cfg.sizes.includes(t.id)) : ALL_TEMPLATES;
  const isReportDoc = docType === "reports_generic";

  useEffect(() => {
    if (!docType || !open) {
      setDocSettings({});
      return;
    }
    let cancelled = false;
    api.get(`/api/print-settings-per-doc/${docType}`)
      .then((r) => {
        if (!cancelled) {
          const saved = r.data.data || {};
          setDocSettings(saved);
          // Pre-select: saved default → system default → first valid
          const resolved = resolveDocPaperSize(docType, saved);
          setTemplate(resolved);
          const zoom = resolved === "A4" ? 0.55 : resolved === "A5" ? 0.72 : 1;
          setViewZoom(zoom);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocSettings({});
          const fallback = cfg ? cfg.defaultSize : "A4";
          setTemplate(fallback);
        }
      });
    return () => { cancelled = true; };
  }, [docType, open]);

  // Non-docType usage: default to A4
  useEffect(() => {
    if (!docType && open && template === null) {
      setTemplate("A4");
    }
  }, [docType, open]);

  const activeTemplate = template || (cfg ? cfg.defaultSize : "A4");
  const scoreColumn = (col) => {
    if (col?.type === "money" || col?.type === "text") return 1.2;
    if (col?.type === "code") return 1.05;
    return 0.9;
  };
  const getCapacity = (paper = activeTemplate) => paper === "A5" ? 5.2 : 7.2;
  const smartKeys = (mode = "essential") => {
    const allowed = mode === "useful" ? new Set(["essential", "useful"]) : new Set(["essential"]);
    let used = 0;
    const keys = [];
    const capacity = getCapacity();
    reportColumns.forEach((col) => {
      if (!allowed.has(col.printPriority || "optional")) return;
      const weight = scoreColumn(col);
      if (keys.length === 0 || used + weight <= capacity) {
        keys.push(col.key || col.id);
        used += weight;
      }
    });
    return keys.length ? keys : reportColumns.slice(0, Math.max(1, Math.floor(capacity))).map((c) => c.key || c.id);
  };

  useEffect(() => {
    if (!open || !isReportDoc || !reportColumns.length) return;
    setReportPrintKeys((current) => {
      const valid = new Set(reportColumns.map((c) => c.key || c.id));
      const next = current.filter((key) => valid.has(key));
      return next.length ? next : smartKeys("useful");
    });
  }, [open, isReportDoc, reportColumns, activeTemplate]);

  const hiddenReportColumns = isReportDoc
    ? reportColumns.filter((c) => !reportPrintKeys.includes(c.key || c.id))
    : [];
  const reportFitScore = isReportDoc
    ? reportColumns.filter((c) => reportPrintKeys.includes(c.key || c.id)).reduce((sum, col) => sum + scoreColumn(col), 0)
    : 0;
  const reportCapacity = getCapacity();
  const reportFitTone = reportFitScore <= reportCapacity ? "green" : reportFitScore <= reportCapacity + 1.5 ? "amber" : "red";
  const reportLandscape = isReportDoc && activeTemplate === "A4" && reportFitScore > 6.2;

  const combinedSettings = {
    ...(globalSettings || {}),
    ...docSettings,
    ...(operationLabel ? { receipt_footer: operationLabel } : {}),
    ...(isReportDoc ? {
      report_print_column_keys: reportPrintKeys,
      report_print_hidden_columns: hiddenReportColumns,
      report_print_landscape: reportLandscape,
      report_total_rows: totalRows,
    } : {}),
  };

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
    if (renderContent) return renderContent(combinedSettings);
    if (activeTemplate === "58mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "58mm" }} />;
    if (activeTemplate === "80mm") return <PrintThermalDoc invoice={invoice} settings={{ ...combinedSettings, receipt_width: "80mm" }} />;
    if (activeTemplate === "A5")   return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A5" />;
    return <PrintA4Doc invoice={invoice} settings={combinedSettings} size="A4" />;
  };

  const printContentRef = useRef(null);

  const handlePrint = () => {
    if (onConfirmPrint) {
      onConfirmPrint(template);
      onClose();
      return;
    }

    // Capture the rendered preview DOM
    const sourceNode = printContentRef.current;
    if (!sourceNode) {
      window.print();
      return;
    }

    const contentHtml = sourceNode.innerHTML;

    // Build print-specific styles based on template
    const pageSize =
      activeTemplate === "58mm" ? "58mm auto"
        : activeTemplate === "80mm" ? "80mm auto"
        : activeTemplate === "A5" ? "148mm 210mm"
        : reportLandscape ? "A4 landscape"
        : "210mm 297mm";

    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "print-frame");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const idoc = iframe.contentWindow.document;
    idoc.open();
    idoc.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${operationLabel || "طباعة"}</title>
  <style>
    @page { size: ${pageSize}; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: "Tajawal", "Noto Sans Arabic", system-ui, sans-serif;
      direction: rtl; text-align: right;
      color: #0f172a; background: #fff;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>${contentHtml}</body>
</html>`);
    idoc.close();

    iframe.contentWindow.focus();
    requestAnimationFrame(() => {
      iframe.contentWindow.print();
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 2000);
    });
  };

  return (
    <>
      {/* Hidden layer rendered only when window.print() is called */}
      <div className="hidden print:flex w-full justify-center">
        <div className="w-full">{renderDoc()}</div>
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
                {validTemplates.map((t) => {
                  const isDefault = cfg ? (resolveDocPaperSize(docType, docSettings) === t.id) : false;
                  return (
                  <button
                    key={t.id}
                    onClick={() => switchTemplate(t.id)}
                    className={`relative flex items-start flex-col px-4 py-3 text-right rounded-[10px] border transition-all ${
                      template === t.id
                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm scale-[1.02]"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {isDefault && (
                      <span className="absolute top-2 left-2 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[8px] font-black text-white">افتراضي</span>
                    )}
                    <span className="font-bold text-[13px]">{t.label}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{t.sub}</span>
                  </button>
                  );
                })}
              </div>
            </div>

            {isReportDoc && reportColumns.length > 0 && (
              <div className="rounded-[12px] border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[12px] font-black text-slate-800">أعمدة A4</div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                    reportFitTone === "green" ? "bg-emerald-50 text-emerald-700" :
                    reportFitTone === "amber" ? "bg-amber-50 text-amber-700" :
                    "bg-red-50 text-red-700"
                  }`}>
                    {reportFitTone === "green" ? "مناسب" : reportFitTone === "amber" ? "مزدحم" : "خارج A4"}
                  </span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      reportFitTone === "green" ? "bg-emerald-500" :
                      reportFitTone === "amber" ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.round((reportFitScore / reportCapacity) * 100))}%` }}
                  />
                </div>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReportPrintKeys(smartKeys("essential"))}
                    className="flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-black text-white"
                  >
                    <Wand2 size={12} /> اختيار ذكي
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPrintKeys(smartKeys("useful"))}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-black text-slate-700"
                  >
                    الأعمدة المهمة
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-black text-emerald-700">
                      <CheckCircle2 size={12} /> سيظهر في A4
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {reportColumns.filter((c) => reportPrintKeys.includes(c.key || c.id)).map((col) => (
                        <button
                          key={col.key || col.id}
                          type="button"
                          onClick={() => setReportPrintKeys((keys) => keys.filter((key) => key !== (col.key || col.id)))}
                          className="flex w-full items-center justify-between rounded-md bg-emerald-50 px-2 py-1 text-right text-[10px] font-bold text-emerald-800"
                        >
                          <span className="truncate">{col.label || col.header}</span>
                          <span>×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-black text-slate-500">
                      <AlertTriangle size={12} /> خارج الصفحة
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {hiddenReportColumns.map((col) => (
                        <button
                          key={col.key || col.id}
                          type="button"
                          onClick={() => setReportPrintKeys((keys) => [...keys, col.key || col.id])}
                          className="block w-full truncate rounded-md bg-slate-50 px-2 py-1 text-right text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                        >
                          {col.label || col.header}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {onExportAllColumns && (
                  <button
                    type="button"
                    onClick={onExportAllColumns}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-[10px] font-black text-emerald-700"
                  >
                    <FileSpreadsheet size={12} /> تصدير Excel لكل الأعمدة
                  </button>
                )}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
              {onConfirmPrint && onSaveOnly ? (
                // Both save buttons available
                <>
                  <button
                    onClick={handlePrint}
                    disabled={isSaving}
                    className="w-full flex justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white p-3.5 rounded-[12px] text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] active:scale-95"
                  >
                    <Printer className="h-4 w-4" /> {isSaving ? "جارٍ الحفظ..." : confirmLabel}
                  </button>
                  <button
                    onClick={() => { onSaveOnly(); onClose(); }}
                    disabled={isSaving}
                    className="w-full flex justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white p-3 rounded-[12px] text-[13px] font-bold transition-all active:scale-95"
                  >
                    {isSaving ? "جارٍ الحفظ..." : saveOnlyLabel}
                  </button>
                </>
              ) : onConfirmPrint ? (
                // Only save-and-print button
                <button
                  onClick={handlePrint}
                  disabled={isSaving}
                  className="w-full flex justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white p-3.5 rounded-[12px] text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)] active:scale-95"
                >
                  <Printer className="h-4 w-4" /> {isSaving ? "جارٍ الحفظ..." : confirmLabel}
                </button>
              ) : (
                // Simple print button (no save)
                <button
                  onClick={handlePrint}
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
                ref={printContentRef}
                style={{
                  width: activeTemplate === "58mm" ? "58mm"
                       : activeTemplate === "80mm" ? "80mm"
                       : activeTemplate === "A5"   ? "148mm"
                       : reportLandscape ? "297mm"
                       : "210mm"
                }}
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
