import React, { useMemo, useRef, useEffect } from "react";

function safeText(value) {
  if (value == null) return "";
  return String(value);
}

function formatDateEG(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return safeText(iso);
  return d.toLocaleDateString("ar-EG");
}

function isNumericLike(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  return !Number.isNaN(Number(s));
}

const A4_MM = { width: 210, height: 297 };
const A5_MM = { width: 148, height: 210 };
const LANDSCAPE_A4_MM = { width: 297, height: 210 };

const HEADER_MM = 22;
const FOOTER_MM = 14;
const MARGIN_MM = 8;

function getPageSizeMM(template, landscape) {
  if (template === "A5") return A5_MM;
  if (landscape) return LANDSCAPE_A4_MM;
  return A4_MM;
}

function getRowsPerPage(visibleCols, isLandscape) {
  const usableHeight = getPageSizeMM("A4", isLandscape).height - MARGIN_MM * 2 - HEADER_MM - FOOTER_MM - 15;
  const rowH = visibleCols.length > 8 ? 5.5 : visibleCols.length > 6 ? 6 : 7;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

export default function ReportPrintTemplate({
  title,
  subtitle,
  rows = [],
  columns = [],
  filters,
  settings = {},
  totalRows = 0,
  currentPage = 1,
  totals = {},
  onPageCount,
}) {
  const accent = settings.accent_color || "#0f172a";
  const currency = settings.currency_symbol || "";
  const hiddenColumns = Array.isArray(settings.report_print_hidden_columns) ? settings.report_print_hidden_columns : [];
  const landscape = settings.report_print_landscape === true || settings.orientation === "landscape";
  const template = settings.template || "A4";

  const pageSizeMM = getPageSizeMM(template, landscape);
  const pageWidthMM = pageSizeMM.width;

  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    const selectedKeys = Array.isArray(settings.report_print_column_keys) ? settings.report_print_column_keys : null;
    if (!selectedKeys?.length) return columns;
    const selected = new Set(selectedKeys);
    return columns.filter((column) => selected.has(column.key || column.id));
  }, [columns, settings.report_print_column_keys]);

  const rowsPerPage = getRowsPerPage(visibleColumns, landscape);
  const totalPrintPages = Math.max(1, Math.ceil((rows.length || 1) / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageRows = rows.slice(pageStart, pageStart + rowsPerPage);
  const isLastPage = currentPage >= totalPrintPages;

  const tableFontSize = visibleColumns.length > 8 ? "9px" : visibleColumns.length > 6 ? "10px" : "11px";

  useEffect(() => {
    if (onPageCount) onPageCount(totalPrintPages);
  }, [totalPrintPages, onPageCount]);

  return (
    <div
      dir="rtl"
      style={{
        background: "#fff",
        color: "#0f172a",
        padding: `${MARGIN_MM}mm`,
        fontFamily: settings.print_font || "sans-serif",
        width: `${pageWidthMM}mm`,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8mm",
          borderBottom: `2px solid ${accent}`,
          paddingBottom: "4mm",
          marginBottom: "5mm",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: "16px", color: accent }}>{safeText(title)}</div>
          {subtitle ? (
            <div style={{ marginTop: "3px", color: "#475569", fontSize: "10px" }}>{safeText(subtitle)}</div>
          ) : null}
        </div>
        <div style={{ textAlign: "left", color: "#64748b", fontSize: "9px", minWidth: "160px" }}>
          <div style={{ fontWeight: 800 }}>{settings.company_name || ""}</div>
          {filters?.from && filters?.to ? (
            <div style={{ marginTop: "2px" }}>
              الفترة: {safeText(filters.from)} إلى {safeText(filters.to)}
            </div>
          ) : null}
          <div style={{ marginTop: "2px" }}>
            طباعة: {new Date().toLocaleDateString("ar-EG")}
          </div>
          <div style={{ marginTop: "2px" }}>
            صفحة {currentPage.toLocaleString("ar-EG")} من {totalPrintPages.toLocaleString("ar-EG")}
          </div>
        </div>
      </div>

      {/* Hidden columns warning */}
      {hiddenColumns.length > 0 && currentPage === 1 ? (
        <div
          style={{
            marginBottom: "4mm",
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            borderRadius: "4px",
            padding: "2mm",
            fontSize: "8px",
            fontWeight: 800,
          }}
        >
          الأعمدة غير المطبوعة: {hiddenColumns.map((c) => c.label || c.header || c.key).join("، ")}.
        </div>
      ) : null}

      {/* Table */}
      {pageRows.length === 0 || visibleColumns.length === 0 ? (
        <div
          style={{
            padding: "10mm 0",
            textAlign: "center",
            color: "#64748b",
            fontWeight: 800,
            fontSize: "12px",
          }}
        >
          لا توجد بيانات للطباعة.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: tableFontSize,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr style={{ background: accent, color: "#fff" }}>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key || column.id}
                    style={{
                      padding: "4px 6px",
                      textAlign: "center",
                      fontWeight: 900,
                      fontSize: tableFontSize,
                    }}
                  >
                    {column.label || column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, idx) => (
                <tr
                  key={row?.id ?? idx}
                  style={{
                    background: idx % 2 === 0 ? "#f8fafc" : "#fff",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {visibleColumns.map((column) => {
                    const key = column.key || column.id;
                    const value = row?.[key];
                    const numeric = isNumericLike(value);
                    const isCode =
                      column.type === "code" ||
                      ["item_code", "code", "sku", "barcode", "invoice_no", "reference_id"].includes(key);
                    const content =
                      column.type === "date" || key === "date" || key.endsWith("_date")
                        ? formatDateEG(value)
                        : numeric
                          ? `${column.type === "money" && currency ? `${currency} ` : ""}${Number(value).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}${column.type === "percent" ? "%" : ""}`
                          : safeText(value);

                    return (
                      <td
                        key={key}
                        style={{
                          padding: "3px 5px",
                          textAlign: "center",
                          color: "#0f172a",
                          fontFamily: isCode ? "monospace" : undefined,
                          direction: isCode ? "ltr" : undefined,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          wordBreak: "break-word",
                          fontSize: tableFontSize,
                        }}
                        title={String(value ?? "")}
                      >
                        {content || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals row - only on last page */}
          {isLastPage && totals && Object.keys(totals).length > 0 && (
            <div
              style={{
                background: "#f1f5f9",
                borderTop: `2px solid ${accent}`,
                padding: "3px 0",
                display: "flex",
                width: "100%",
                fontWeight: 900,
                fontSize: tableFontSize,
              }}
            >
              {visibleColumns.map((col) => {
                const key = col.key || col.id;
                const val = totals[key];
                const hasVal = val != null && !isNaN(Number(val));
                return (
                  <div
                    key={key}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "2px 4px",
                      color: hasVal ? accent : "#64748b",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hasVal
                      ? Number(val).toLocaleString("ar-EG", { maximumFractionDigits: 2 })
                      : ""}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "5mm",
          paddingTop: "3mm",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: "8px",
          fontWeight: 700,
        }}
      >
        <span>تم التصدير: {new Date().toLocaleDateString("ar-EG")}</span>
        <span>صفحة {currentPage.toLocaleString("ar-EG")} من {totalPrintPages.toLocaleString("ar-EG")}</span>
      </div>

      <style>{`
        @media print {
          @page { size: ${landscape ? "A4 landscape" : "A4"}; margin: ${MARGIN_MM}mm; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
