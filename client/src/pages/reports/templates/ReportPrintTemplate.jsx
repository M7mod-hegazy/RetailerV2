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

export default function ReportPrintTemplate({ title, subtitle, rows = [], columns = [], filters, settings = {} }) {
  const accent = settings.accent_color || "#0f172a";
  const currency = settings.currency_symbol || "";

  const visibleColumns = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    // Do not print overly wide tables by default; keep first 10 columns.
    return columns.slice(0, 10);
  }, [columns]);

  return (
    <div dir="rtl" style={{ background: "#fff", color: "#0f172a", padding: "12mm 10mm", fontFamily: settings.print_font || "sans-serif" }}>
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
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "12mm 0", textAlign: "center", color: "#64748b", fontWeight: 800 }}>لا توجد بيانات للطباعة.</div>
      ) : (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ background: accent, color: "#fff" }}>
                {visibleColumns.map((c) => (
                  <th key={c.key} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 900 }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 250).map((row, idx) => (
                <tr key={row?.id ?? idx} style={{ background: idx % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                  {visibleColumns.map((c) => {
                    const value = row?.[c.key];
                    const numeric = isNumericLike(value);
                    const isCode = ["item_code", "code", "sku", "barcode", "invoice_no", "reference_id"].includes(c.key);
                    const content =
                      c.key === "date" || c.key.endsWith("_date")
                        ? formatDateEG(value)
                        : numeric
                        ? `${currency ? `${currency} ` : ""}${Number(value).toLocaleString("ar-EG")}`
                        : safeText(value);

                    return (
                      <td
                        key={c.key}
                        style={{
                          padding: "6px 8px",
                          textAlign: numeric ? "left" : "right",
                          color: "#0f172a",
                          fontFamily: isCode ? "monospace" : undefined,
                          direction: isCode ? "ltr" : undefined,
                          whiteSpace: "nowrap",
                          maxWidth: "240px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {content || "—"}
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
    </div>
  );
}

