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

function getPageSizeMM(template) {
  if (template === "58mm") return { width: 58, height: 297 };
  if (template === "80mm") return { width: 80, height: 297 };
  if (template === "A5") return { width: 148, height: 210 };
  return { width: 210, height: 297 };
}

const HEADER_MM = 22;
const FOOTER_MM = 14;
const DEFAULT_MARGIN = 8;

function parseMargin(val, fallback) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function parseFontSize(val, fallback) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function getRowsPerPage(visibleCols, pageSizeMM, marginMM) {
  const usableHeight = pageSizeMM.height - marginMM * 2 - HEADER_MM - FOOTER_MM - 15;
  const rowH = visibleCols.length > 8 ? 5.5 : visibleCols.length > 6 ? 6 : 7;
  const headerRowH = 8;
  const totalRowH = 7;
  return Math.max(1, Math.floor((usableHeight - headerRowH - totalRowH) / rowH));
}

function renderCustomBlocks(blocks, position) {
  if (!blocks) return null;
  const parsed = typeof blocks === "string" ? (() => { try { return JSON.parse(blocks); } catch { return []; } })() : blocks;
  if (!Array.isArray(parsed)) return null;
  const matches = parsed.filter((b) => b.position === position && b.enabled !== false && b.text?.trim());
  if (!matches.length) return null;
  return matches.map((b, i) => (
    <div
      key={i}
      style={{
        textAlign: b.alignment === "left" ? "left" : b.alignment === "center" ? "center" : "right",
        fontSize: parseFontSize(b.font_size, 9) + "px",
        fontWeight: b.bold ? 900 : 700,
        fontStyle: b.italic ? "italic" : "normal",
        margin: "2mm 0",
        color: "#334155",
      }}
    >
      {b.text}
    </div>
  ));
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
  const template = settings.template || "A4";

  const pageSizeMM = getPageSizeMM(template);
  const pageWidthMM = pageSizeMM.width;
  const marginMM = parseMargin(settings.margin_side, DEFAULT_MARGIN);
  const marginTopMM = parseMargin(settings.margin_top, DEFAULT_MARGIN);

  const printFont = settings.print_font || "sans-serif";
  const headerFontSize = parseFontSize(settings.header_font_size, 18) + "px";
  const bodyFontSize = parseFontSize(settings.body_font_size, 11) + "px";
  const itemFontSize = parseFontSize(settings.item_font_size, 9) + "px";
  const footerFontSize = parseFontSize(settings.footer_font_size, 8) + "px";
  const logoMaxHeight = parseFontSize(settings.logo_max_height, 40) + "px";
  const logoAlignment = settings.logo_alignment || "center";
  const showLogo = settings.show_logo !== false;
  const showBranch = settings.show_branch !== false;
  const showAddress = settings.show_address !== false;
  const showPhone = settings.show_phone !== false;
  const showTaxId = settings.show_tax_id !== false;
  const headerText = settings.receipt_header || "";
  const footerText = settings.receipt_footer || "";
  const customBlocks = settings.custom_text_blocks;

  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    const selectedKeys = Array.isArray(settings.report_print_column_keys) ? settings.report_print_column_keys : null;
    if (!selectedKeys?.length) return columns;
    const selected = new Set(selectedKeys);
    return columns.filter((column) => selected.has(column.key || column.id));
  }, [columns, settings.report_print_column_keys]);

  const rowsPerPage = getRowsPerPage(visibleColumns, pageSizeMM, marginMM);
  const totalPrintPages = Math.max(1, Math.ceil((rows.length || 1) / rowsPerPage));
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageRows = rows.slice(pageStart, pageStart + rowsPerPage);
  const isLastPage = currentPage >= totalPrintPages;

  const tableFontSize = visibleColumns.length > 8 ? "9px" : visibleColumns.length > 6 ? "10px" : itemFontSize;

  useEffect(() => {
    if (onPageCount) onPageCount(totalPrintPages);
  }, [totalPrintPages, onPageCount]);

  const isThermal = template === "58mm" || template === "80mm";

  const logoEl = showLogo && settings.logo_url ? (
    <div style={{ textAlign: logoAlignment, marginBottom: "3mm" }}>
      <img
        src={settings.logo_url}
        alt=""
        style={{
          maxHeight: logoMaxHeight,
          maxWidth: "80%",
          objectFit: "contain",
        }}
      />
    </div>
  ) : null;

  const companyInfoEl = (
    <div style={{ textAlign: "center", marginBottom: "3mm" }}>
      <div style={{ fontWeight: 900, fontSize: headerFontSize, color: accent }}>
        {safeText(settings.company_name || "")}
      </div>
      {showBranch && settings.branch_name ? (
        <div style={{ fontSize: bodyFontSize, color: "#475569", marginTop: "1mm" }}>
          {safeText(settings.branch_name)}
        </div>
      ) : null}
      {showAddress && settings.address ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          {safeText(settings.address)}
        </div>
      ) : null}
      {showPhone && settings.phone ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          {safeText(settings.phone)}
        </div>
      ) : null}
      {showTaxId && settings.vat_number ? (
        <div style={{ fontSize: bodyFontSize, color: "#64748b", marginTop: "0.5mm" }}>
          الرقم الضريبي: {safeText(settings.vat_number)}
        </div>
      ) : null}
    </div>
  );

  const pageSizeCSS = template === "58mm" ? "58mm auto"
    : template === "80mm" ? "80mm auto"
    : template === "A5" ? "148mm 210mm"
    : "210mm 297mm";

  return (
    <div
      dir="rtl"
      style={{
        background: "#fff",
        color: "#0f172a",
        padding: `${marginMM}mm ${marginMM}mm ${marginMM}mm ${marginMM}mm`,
        paddingTop: `${marginTopMM}mm`,
        fontFamily: printFont,
        width: `${pageWidthMM - marginMM * 2}mm`,
        boxSizing: "border-box",
        margin: "0 auto",
        fontSize: bodyFontSize,
      }}
    >
      {/* Logo */}
      {logoEl}

      {/* Company Info */}
      {companyInfoEl}

      {/* Custom blocks: after_header */}
      {renderCustomBlocks(customBlocks, "after_header")}

      {/* Report Title & Meta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8mm",
          borderBottom: `2px solid ${accent}`,
          paddingBottom: "4mm",
          marginBottom: "4mm",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: headerFontSize, color: accent }}>{safeText(title)}</div>
          {subtitle ? (
            <div style={{ marginTop: "3px", color: "#475569", fontSize: bodyFontSize }}>{safeText(subtitle)}</div>
          ) : null}
        </div>
        <div style={{ textAlign: "left", color: "#64748b", fontSize: footerFontSize, minWidth: "160px" }}>
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

      {/* Header text */}
      {headerText && currentPage === 1 ? (
        <div
          style={{
            marginBottom: "3mm",
            fontSize: bodyFontSize,
            color: "#475569",
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          {safeText(headerText)}
        </div>
      ) : null}

      {/* Custom blocks: before_items */}
      {renderCustomBlocks(customBlocks, "before_items")}

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
            fontSize: footerFontSize,
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
            fontSize: bodyFontSize,
          }}
        >
          لا توجد بيانات للطباعة.
        </div>
      ) : (
        <div
          style={{
            border: isThermal ? "none" : "1px solid #e2e8f0",
            borderRadius: isThermal ? "0" : "4px",
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
                      padding: isThermal ? "2px 4px" : "4px 6px",
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
                    borderBottom: isThermal ? "1px dashed #e2e8f0" : "1px solid #e2e8f0",
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
                          ? `${column.type === "money" && currency ? `${currency} ` : ""}${Number(value).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${column.type === "percent" ? "%" : ""}`
                          : safeText(value);

                    return (
                      <td
                        key={key}
                        style={{
                          padding: isThermal ? "2px 3px" : "3px 5px",
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
                      ? Number(val).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : ""}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom blocks: after_items */}
      {renderCustomBlocks(customBlocks, "after_items")}

      {/* Footer */}
      <div
        style={{
          marginTop: "5mm",
          paddingTop: "3mm",
          borderTop: isThermal ? "1px dashed #e2e8f0" : "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: footerFontSize,
          fontWeight: 700,
        }}
      >
        <span>تم التصدير: {new Date().toLocaleDateString("ar-EG")}</span>
        {footerText ? <span>{safeText(footerText)}</span> : null}
        <span>صفحة {currentPage.toLocaleString("ar-EG")} من {totalPrintPages.toLocaleString("ar-EG")}</span>
      </div>

      <style>{`
        @media print {
          @page { size: ${pageSizeCSS}; margin: ${marginMM}mm; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
