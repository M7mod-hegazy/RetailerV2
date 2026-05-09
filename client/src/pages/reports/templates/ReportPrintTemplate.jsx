import React, { useMemo } from "react";

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

export default function ReportPrintTemplate({
  title,
  subtitle,
  rows = [],
  columns = [],
  filters,
  settings = {},
  totalRows = 0,
  currentPage = 1,
}) {
  const accent = settings.accent_color || "#0f172a";
  const currency = settings.currency_symbol || "";
  const hiddenColumns = Array.isArray(settings.report_print_hidden_columns) ? settings.report_print_hidden_columns : [];
  const landscape = settings.report_print_landscape === true;

  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    const selectedKeys = Array.isArray(settings.report_print_column_keys) ? settings.report_print_column_keys : null;
    if (!selectedKeys?.length) return columns;
    const selected = new Set(selectedKeys);
    return columns.filter((column) => selected.has(column.key || column.id));
  }, [columns, settings.report_print_column_keys]);

  const tableFontSize = visibleColumns.length > 8 ? "9px" : visibleColumns.length > 6 ? "10px" : "11px";

  return (
    <div
      dir="rtl"
      style={{
        background: "#fff",
        color: "#0f172a",
        padding: "10mm",
        fontFamily: settings.print_font || "sans-serif",
        width: landscape ? "297mm" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12mm", borderBottom: `3px solid ${accent}`, paddingBottom: "6mm", marginBottom: "8mm" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: "18px", color: accent }}>{safeText(title)}</div>
          {subtitle ? <div style={{ marginTop: "4px", color: "#475569", fontSize: "12px", maxWidth: "70ch" }}>{safeText(subtitle)}</div> : null}
        </div>

        <div style={{ textAlign: "left", color: "#64748b", fontSize: "11px", minWidth: "220px" }}>
          <div style={{ fontWeight: 800 }}>{settings.company_name || ""}</div>
          {filters?.from && filters?.to ? (
            <div style={{ marginTop: "4px" }}>
              الفترة: <span className="mixed-number">{safeText(filters.from)}</span> إلى <span className="mixed-number">{safeText(filters.to)}</span>
            </div>
          ) : null}
          <div style={{ marginTop: "4px" }}>تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}</div>
          <div style={{ marginTop: "4px" }}>الصفحة الحالية: {currentPage.toLocaleString("ar-EG")} - الصفوف: {(totalRows || rows.length).toLocaleString("ar-EG")}</div>
        </div>
      </div>

      {hiddenColumns.length > 0 ? (
        <div style={{ marginBottom: "5mm", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: "6px", padding: "3mm", fontSize: "10px", fontWeight: 800 }}>
          الأعمدة غير المطبوعة على A4: {hiddenColumns.map((c) => c.label || c.header || c.key).join("، ")}. استخدم Excel لعرض كل الأعمدة.
        </div>
      ) : null}

      {rows.length === 0 || visibleColumns.length === 0 ? (
        <div style={{ padding: "12mm 0", textAlign: "center", color: "#64748b", fontWeight: 800 }}>لا توجد بيانات للطباعة.</div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tableFontSize, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: accent, color: "#fff" }}>
                {visibleColumns.map((column) => (
                  <th key={column.key || column.id} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 900 }}>
                    {column.label || column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 250).map((row, idx) => (
                <tr key={row?.id ?? idx} style={{ background: idx % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                  {visibleColumns.map((column) => {
                    const key = column.key || column.id;
                    const value = row?.[key];
                    const numeric = isNumericLike(value);
                    const isCode = column.type === "code" || ["item_code", "code", "sku", "barcode", "invoice_no", "reference_id"].includes(key);
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
                          padding: "6px 8px",
                          textAlign: numeric ? "left" : "right",
                          color: "#0f172a",
                          fontFamily: isCode ? "monospace" : undefined,
                          direction: isCode ? "ltr" : undefined,
                          whiteSpace: visibleColumns.length > 7 ? "normal" : "nowrap",
                          maxWidth: "240px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          wordBreak: "break-word",
                        }}
                      >
                        {content || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length > 250 ? (
            <div style={{ padding: "8px 10px", fontSize: "10px", color: "#64748b", fontWeight: 800 }}>
              تمت طباعة أول 250 صف فقط. للتصدير الكامل استخدم Excel.
            </div>
          ) : null}
        </div>
      )}

      <style>{`
        @media print {
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
