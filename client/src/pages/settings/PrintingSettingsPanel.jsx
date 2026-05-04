import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Ruler, Hash, AlignLeft, Baseline, ListChecks, Eye, Receipt,
  FileBarChart2, ToggleLeft, ToggleRight, Info, Zap, MousePointerClick,
  RefreshCw, FileText
} from "lucide-react";
import { BlockRenderer, CustomTextBlocksSection, getCustomBlocks, saveCustomBlocks } from "./CustomTextBlocks";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAPER_OPTIONS = [
  { value: "58mm", label: "58mm", sub: "رول حراري صغير",   dims: "58 × ∞ mm",  icon: Receipt       },
  { value: "80mm", label: "80mm", sub: "رول حراري قياسي",  dims: "80 × ∞ mm",  icon: Receipt       },
  { value: "A5",   label: "A5",   sub: "نصف صفحة A4",      dims: "148 × 210mm", icon: FileText      },
  { value: "A4",   label: "A4",   sub: "ورقة كاملة",       dims: "210 × 297mm", icon: FileBarChart2 },
];

const FONT_FAMILIES = [
  { value: "monospace",  label: "Courier — حرارية" },
  { value: "sans-serif", label: "Arial — حديث"    },
  { value: "serif",      label: "Times — رسمي"    },
];

const DEFAULTS = {
  receipt_width: "80mm", invoice_prefix: "INV", purchase_prefix: "PO",
  return_prefix: "RET", work_order_prefix: "WO", receipt_prefix: "REC",
  receipt_header: "أهلاً وسهلاً بكم",
  receipt_footer: "شكراً لزيارتكم — يسعدنا خدمتكم دائماً",
  header_font_size: 16, body_font_size: 11, footer_font_size: 10,
  item_font_size: 11, print_font: "monospace", logo_max_height: 48,
  logo_alignment: "center", accent_color: "#0f172a",
  margin_top: 4, margin_side: 4, qr_size: 44,
  show_cashier_name: true, show_customer_name: true, show_tax: true,
  show_footer: true, show_qr: true, show_logo: true,
  show_discount_line: true, show_payment_details: true, show_subtotal: true,
  show_phone: true, show_address: true, show_tax_id: true,
  show_branch: true, show_invoice_date: true, show_barcode_line: false,
  tax_rate: 15, currency_symbol: "ر.س", show_item_code: true,
};

const DOC_TYPES = [
  { key: "global", label: "الإعدادات العامة", icon: "⚙" },
  { key: "pos_receipt", label: "إيصال نقطة البيع", icon: "REC" },
  { key: "sales_invoice", label: "فاتورة مبيعات", icon: "INV" },
  { key: "purchase_order", label: "أمر شراء", icon: "PO" },
  { key: "sales_return", label: "مرتجع مبيعات", icon: "RET" },
  { key: "quotation", label: "عرض سعر", icon: "Q" },
  { key: "branch_transfer", label: "تحويل فرع", icon: "TR" },
  { key: "bank_statement", label: "كشف بنكي", icon: "BNK" },
  { key: "ajal_statement", label: "كشف آجل", icon: "AJL" },
  { key: "ajal_schedule", label: "جدول أقساط", icon: "SCH" },
  { key: "cheque_register", label: "سجل شيكات", icon: "CHK" },
  { key: "payment_receipt", label: "إيصال دفع", icon: "PAY" },
  { key: "daily_treasury", label: "تقرير الخزينة", icon: "DT" },
  { key: "payment_methods_report", label: "تقرير وسائل الدفع", icon: "PM" },
];

// Fields that have a direct, VISIBLE representation in the preview
const VISUAL_FIELDS = new Set([
  "receipt_header", "receipt_footer", "invoice_prefix", "accent_color",
  "show_logo", "show_branch", "show_address", "show_phone", "show_tax_id",
  "show_invoice_date", "show_customer_name", "show_cashier_name",
  "show_subtotal", "show_discount_line", "show_tax", "show_payment_details",
  "show_footer", "show_qr", "show_barcode_line", "header_section", "show_item_code",
]);

const get = (s, k) => s[k] ?? DEFAULTS[k];

// ─── Primitives ─────────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, title, hint }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-2.5 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-slate-900 text-white">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-800">{title}</div>
        {hint && <div className="text-[10px] font-bold text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

function ControlField({ label, hint, fieldKey, hovered, onHover, onLeave, children, onChange }) {
  const visual = VISUAL_FIELDS.has(fieldKey);
  const isActive = visual && hovered === fieldKey;

  return (
    <div
      data-field-key={fieldKey}
      className={`relative rounded-sm transition-all duration-150 ${isActive ? "ring-2 ring-amber-400 ring-offset-1 bg-amber-50/60" : ""}`}
      onMouseEnter={() => visual && onHover(fieldKey)}
      onMouseLeave={() => visual && onLeave()}
    >
      {isActive && (
        <div className="absolute -top-2 left-0 z-10 flex items-center gap-1 rounded-sm bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
          <MousePointerClick className="h-2.5 w-2.5" /> يُظهَر في المعاينة
        </div>
      )}
      <label className="block space-y-1.5 text-slate-500 focus-within:text-slate-900 transition-colors px-0.5 pb-0.5 pt-1">
        <span className="flex items-center justify-between gap-1 text-[10px] font-black uppercase tracking-widest">
          <span>{label}</span>
          {hint && (
            <span className="group relative cursor-help">
              <Info className="h-3 w-3 text-slate-300 group-hover:text-slate-600" />
              <div className="absolute left-0 top-5 z-20 hidden w-44 rounded-sm bg-slate-800 p-2 text-[10px] font-bold text-white shadow-xl group-hover:block">{hint}</div>
            </span>
          )}
        </span>
        {children}
        {(function() {
          const def = DEFAULTS[fieldKey];
          const cur = onChange ? undefined : null; // badge only useful with onChange
          return null;
        })()}
      </label>
    </div>
  );
}

function StyledInput({ ...props }) {
  return <input {...props} className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all placeholder:text-slate-300 placeholder:font-normal" />;
}

function StyledSelect({ value, onChange, options }) {
  return (
    <select value={value ?? ""} onChange={onChange} className="w-full rounded-sm border border-slate-200 bg-white py-2 px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 shadow-sm transition-all appearance-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Stepper({ value, onChange, min = 0, max = 100, step = 1, unit }) {
  const v = Number(value ?? 0);
  return (
    <div className="flex items-center rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button type="button" onClick={() => onChange(Math.max(min, v - step))} className="px-3 py-2 text-[14px] font-black text-slate-500 hover:bg-slate-100 border-l border-slate-200">−</button>
      <div className="flex-1 text-center text-[13px] font-black text-slate-800 py-2">{v}{unit && <span className="text-[10px] font-bold text-slate-400 ml-1">{unit}</span>}</div>
      <button type="button" onClick={() => onChange(Math.min(max, v + step))} className="px-3 py-2 text-[14px] font-black text-slate-500 hover:bg-slate-100 border-r border-slate-200">+</button>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label, hint, fieldKey, hovered, onHover, onLeave }) {
  const visual = VISUAL_FIELDS.has(fieldKey);
  const isActive = visual && hovered === fieldKey;
  return (
    <div
      data-field-key={fieldKey}
      onMouseEnter={() => visual && onHover(fieldKey)}
      onMouseLeave={() => visual && onLeave()}
      onClick={() => onChange(!checked)}
      className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-sm border p-3 transition-all ${isActive ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${checked ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white hover:bg-slate-50"}`}
    >
      <div className="min-w-0">
        <div className={`text-[11px] font-black uppercase tracking-widest truncate ${checked ? "text-white" : "text-slate-800"}`}>{label}</div>
        {hint && <div className={`mt-0.5 text-[10px] font-bold truncate ${checked ? "text-slate-300" : "text-slate-400"}`}>{hint}</div>}
      </div>
      {checked ? <ToggleRight className="h-5 w-5 shrink-0 text-emerald-400" /> : <ToggleLeft className="h-5 w-5 shrink-0 text-slate-300" />}
    </div>
  );
}

function PaperPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {PAPER_OPTIONS.map(({ value: v, label, sub, dims, icon: Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1.5 rounded-sm border py-4 transition-all ${value === v ? "border-slate-900 bg-slate-900 shadow-lg scale-[1.02]" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}>
          <Icon className={`h-5 w-5 ${value === v ? "text-white" : "text-slate-400"}`} />
          <div className="text-center">
            <div className={`text-[13px] font-black tracking-widest leading-none ${value === v ? "text-white" : "text-slate-800"}`}>{label}</div>
            <div className={`text-[9px] font-bold mt-1 ${value === v ? "text-slate-300" : "text-slate-400"}`}>{sub}</div>
            <div className={`text-[9px] font-bold ${value === v ? "text-slate-400" : "text-slate-300"}`}>{dims}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Thermal Preview ────────────────────────────────────────────────────────────

function ThermalPreview({ settings: s, hovered, onElementClick, customBlocks = [] }) {
  const currency = get(s, "currency_symbol");
  const taxRate = parseFloat(get(s, "tax_rate") || 0);
  const mockSub = 230, mockDisc = 10;
  const mockTax = get(s, "show_tax") !== false ? (mockSub - mockDisc) * (taxRate / 100) : 0;
  const mockTotal = mockSub - mockDisc + mockTax;
  const accent = get(s, "accent_color");
  const dashed = `1px dashed ${accent}66`;
  const solid = `1px solid ${accent}`;
  const fontFamily = get(s, "print_font");

  const hl = (key) => ({
    outline: VISUAL_FIELDS.has(key) && hovered === key ? "2px solid #f59e0b" : "none",
    outlineOffset: "2px", borderRadius: "1px", cursor: "pointer", transition: "outline 0.1s",
  });

  const w = get(s, "receipt_width") === "58mm" ? "58mm" : "80mm";

  return (
    <div dir="rtl" style={{ fontFamily, fontSize: `${get(s,"body_font_size")}px`, width: w, margin: "0 auto", padding: `${get(s,"margin_top")}mm ${get(s,"margin_side")}mm`, color: accent, background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* Header */}
      <div onClick={() => onElementClick("header_section")} style={{ textAlign: get(s,"logo_alignment"), marginBottom: "8px", ...hl("header_section") }}>
        {get(s,"show_logo") !== false && s.logo_url && <img src={s.logo_url} alt="" style={{ maxHeight: `${get(s,"logo_max_height")}px`, objectFit: "contain", margin: "0 auto 4px" }} />}
        <div style={{ fontSize: `${get(s,"header_font_size")}px`, fontWeight: "900" }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
        {get(s,"show_branch")   !== false && <div style={hl("show_branch")}   onClick={e => { e.stopPropagation(); onElementClick("show_branch"); }}>{s.branch_name || "الفرع الرئيسي"}</div>}
        {get(s,"show_address")  !== false && <div style={{ fontSize: "9px", opacity: 0.6, ...hl("show_address")  }} onClick={e => { e.stopPropagation(); onElementClick("show_address"); }}>{s.address || "الرياض، المملكة العربية السعودية"}</div>}
        {get(s,"show_phone")    !== false && <div style={{ fontSize: "9px", ...hl("show_phone")    }} onClick={e => { e.stopPropagation(); onElementClick("show_phone"); }}>هاتف: {s.phone || "0501234567"}</div>}
        {get(s,"show_tax_id")   !== false && <div style={{ fontSize: "9px", ...hl("show_tax_id")   }} onClick={e => { e.stopPropagation(); onElementClick("show_tax_id"); }}>الرقم الضريبي: {s.tax_id || "310122393500003"}</div>}
      </div>

      {get(s,"receipt_header") && <div onClick={() => onElementClick("receipt_header")} style={{ textAlign: "center", fontSize: "10px", marginBottom: "4px", fontStyle: "italic", ...hl("receipt_header") }}>{get(s,"receipt_header")}</div>}
      <BlockRenderer blocks={customBlocks} position="after_header" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <div style={{ borderTop: dashed, margin: "5px 0" }} />

      <div style={{ fontSize: `${get(s,"item_font_size")}px`, marginBottom: "5px" }}>
        <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>رقم الفاتورة:</span><span style={{ fontWeight: "bold" }} onClick={() => onElementClick("invoice_prefix")}>{get(s,"invoice_prefix")}-2025-0042</span></div>
        {get(s,"show_invoice_date")   !== false && <div style={{ display: "flex", justifyContent: "space-between" }}><span>التاريخ:</span><span>{new Date().toLocaleDateString("ar-SA")}</span></div>}
        {get(s,"show_customer_name")  !== false && <div onClick={() => onElementClick("show_customer_name")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_customer_name") }}><span>العميل:</span><span>محمد الهيجازي</span></div>}
        {get(s,"show_cashier_name")   !== false && <div onClick={() => onElementClick("show_cashier_name")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_cashier_name") }}><span>الكاشير:</span><span>أحمد صالح</span></div>}
      </div>
      <BlockRenderer blocks={customBlocks} position="after_meta" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <div style={{ borderTop: dashed, margin: "5px 0" }} />
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={w} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      <table style={{ width: "100%", fontSize: `${get(s,"item_font_size")}px`, borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: solid }}>
          {get(s,"show_item_code") !== false && <th style={{ textAlign: "right", paddingBottom: "3px", color: "inherit", opacity: 0.6, fontSize: "9px" }}>كود</th>}
          <th style={{ textAlign: "right", paddingBottom: "3px" }}>الصنف</th>
          <th style={{ textAlign: "center" }}>كمية</th>
          <th style={{ textAlign: "left" }}>إجمالي</th>
        </tr></thead>
        <tbody>
          <tr>
            {get(s,"show_item_code") !== false && <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px", opacity: 0.6, fontFamily: "monospace" }}>SKU-001</td>}
            <td style={{ textAlign: "right", padding: "2px 0" }}>قميص قطني L</td>
            <td style={{ textAlign: "center" }}>2</td>
            <td style={{ textAlign: "left" }}>120.00</td>
          </tr>
          <tr>
            {get(s,"show_item_code") !== false && <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px", opacity: 0.6, fontFamily: "monospace" }}>SKU-002</td>}
            <td style={{ textAlign: "right", padding: "2px 0" }}>بنطلون جينز</td>
            <td style={{ textAlign: "center" }}>1</td>
            <td style={{ textAlign: "left" }}>110.00</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: dashed, margin: "5px 0" }} />

      <div style={{ fontSize: `${get(s,"item_font_size")}px` }}>
        {get(s,"show_subtotal")      !== false && <div onClick={() => onElementClick("show_subtotal")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_subtotal") }}><span>الإجمالي:</span><span>{currency} {mockSub.toFixed(2)}</span></div>}
        {get(s,"show_discount_line") !== false && <div onClick={() => onElementClick("show_discount_line")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_discount_line") }}><span>الخصم:</span><span>- {currency} {mockDisc.toFixed(2)}</span></div>}
        {get(s,"show_tax")           !== false && <div onClick={() => onElementClick("show_tax")} style={{ display: "flex", justifyContent: "space-between", ...hl("show_tax") }}><span>ضريبة ({taxRate}%):</span><span>{currency} {mockTax.toFixed(2)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: `${get(s,"header_font_size") - 2}px`, marginTop: "4px", paddingTop: "3px", borderTop: solid }}><span>المستحق:</span><span>{currency} {mockTotal.toFixed(2)}</span></div>
        <BlockRenderer blocks={customBlocks} position="after_totals" accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      </div>

      {get(s,"show_payment_details") !== false && (
        <><div style={{ borderTop: dashed, margin: "5px 0" }} /><div onClick={() => onElementClick("show_payment_details")} style={{ fontSize: `${get(s,"item_font_size")}px`, ...hl("show_payment_details") }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>نقداً:</span><span>{currency} 250.00</span></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>الباقي:</span><span>{currency} {(250 - mockTotal).toFixed(2)}</span></div></div></>
      )}

      {get(s,"show_footer") !== false && (
        <><div style={{ borderTop: dashed, margin: "6px 0" }} />
        <BlockRenderer blocks={customBlocks} position="before_footer" accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div onClick={() => onElementClick("receipt_footer")} style={{ textAlign: "center", fontSize: `${get(s,"footer_font_size")}px`, fontStyle: "italic", ...hl("receipt_footer") }}>{get(s,"receipt_footer")}</div></>
      )}

      {get(s,"show_qr") !== false && (
        <div onClick={() => onElementClick("show_qr")} style={{ margin: "8px auto 0", width: `${get(s,"qr_size")}px`, height: `${get(s,"qr_size")}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888", cursor: "pointer", ...hl("show_qr") }}>QR</div>
      )}
    </div>
  );
}

// ─── A4/A5 Page Preview ─────────────────────────────────────────────────────────

function PagePreview({ settings: s, hovered, onElementClick, size, customBlocks = [] }) {
  const currency = get(s, "currency_symbol");
  const taxRate = parseFloat(get(s, "tax_rate") || 0);
  const accent = get(s, "accent_color");
  const mockSub = 1250;
  const mockTax = get(s, "show_tax") !== false ? mockSub * (taxRate / 100) : 0;
  const mockTotal = mockSub + mockTax;
  const w = size === "A5" ? "148mm" : "210mm";

  const hl = (key) => ({
    outline: VISUAL_FIELDS.has(key) && hovered === key ? "2px solid #f59e0b" : "none",
    outlineOffset: "2px", borderRadius: "1px", cursor: "pointer", transition: "outline 0.1s",
  });

  const items = [
    { name: "قميص قطني L", code: "SKU-001", qty: 5, price: 120 },
    { name: "بنطلون جينز", code: "SKU-002", qty: 3, price: 150 },
    { name: "حزام جلد", code: "SKU-003", qty: 4, price: 80 },
    { name: "حذاء رياضي", code: "SKU-004", qty: 2, price: 200 },
  ];
  const showCode = get(s, "show_item_code") === true;

  return (
    <div dir="rtl" style={{ width: w, padding: `${get(s,"margin_top")}mm ${get(s,"margin_side")}mm`, fontFamily: get(s,"print_font"), fontSize: `${get(s,"body_font_size")}px`, color: "#1e293b", background: "#fff", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}>
      {/* Header */}
      <div onClick={() => onElementClick("header_section")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `3px solid ${accent}`, paddingBottom: "8px", marginBottom: "10px", ...hl("header_section") }}>
        <div>
          {get(s,"show_logo") !== false && s.logo_url && <img src={s.logo_url} alt="" style={{ maxHeight: `${get(s,"logo_max_height")}px`, objectFit: "contain" }} />}
        </div>
        <div>
          <div style={{ fontSize: `${get(s,"header_font_size")}px`, fontWeight: "900", color: accent }}>{s.company_name || "إلهيجازي للتجزئة"}</div>
          {get(s,"show_branch")  !== false && <div style={{ fontSize: "11px", color: "#64748b" }}>{s.branch_name || "الفرع الرئيسي"}</div>}
          {get(s,"show_address") !== false && <div style={{ fontSize: "9px", color: "#94a3b8" }}>{s.address || "الرياض، المملكة"}</div>}
          {get(s,"show_phone")   !== false && <div style={{ fontSize: "9px", color: "#94a3b8" }}>هاتف: {s.phone || "0501234567"}</div>}
          {get(s,"show_tax_id")  !== false && <div style={{ fontSize: "9px", color: "#94a3b8" }}>الرقم الضريبي: {s.tax_id || "310122393500003"}</div>}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: accent }}>فاتورة مبيعات</div>
          <div onClick={() => onElementClick("invoice_prefix")} style={{ fontSize: "10px", color: "#64748b", ...hl("invoice_prefix") }}>{get(s,"invoice_prefix")}-2025-0042</div>
        </div>
        <div style={{ textAlign: "left", fontSize: "10px", color: "#64748b" }}>
          {get(s,"show_invoice_date")  !== false && <div>التاريخ: {new Date().toLocaleDateString("ar-SA")}</div>}
          {get(s,"show_customer_name") !== false && <div onClick={() => onElementClick("show_customer_name")} style={hl("show_customer_name")}>العميل: محمد الهيجازي</div>}
          {get(s,"show_cashier_name")  !== false && <div onClick={() => onElementClick("show_cashier_name")} style={hl("show_cashier_name")}>الكاشير: أحمد صالح</div>}
        </div>
      </div>
      <BlockRenderer blocks={customBlocks} position="before_meta" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {/* Table */}
      <BlockRenderer blocks={customBlocks} position="before_items" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${get(s,"item_font_size")}px`, marginBottom: "8px" }}>
        <thead><tr style={{ background: accent, color: "#fff" }}>
          <th style={{ textAlign: "right", padding: "4px 6px" }}>#</th>
          {showCode && <th style={{ textAlign: "center", padding: "4px 6px", fontSize: "9px", opacity: 0.85 }}>كود</th>}
          <th style={{ textAlign: "right", padding: "4px 6px" }}>المنتج</th>
          <th style={{ textAlign: "center", padding: "4px 6px" }}>كمية</th>
          <th style={{ textAlign: "center", padding: "4px 6px" }}>سعر</th>
          <th style={{ textAlign: "left", padding: "4px 6px" }}>إجمالي</th>
        </tr></thead>
        <tbody>{items.map((item, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
            <td style={{ padding: "3px 6px", color: "#94a3b8" }}>{i + 1}</td>
            {showCode && <td style={{ textAlign: "center", padding: "3px 6px", fontSize: "9px", color: "#94a3b8", fontFamily: "monospace" }}>{item.code}</td>}
            <td style={{ padding: "3px 6px", fontWeight: "600" }}>{item.name}</td>
            <td style={{ textAlign: "center", padding: "3px 6px" }}>{item.qty}</td>
            <td style={{ textAlign: "center", padding: "3px 6px" }}>{item.price.toFixed(2)}</td>
            <td style={{ textAlign: "left", padding: "3px 6px", fontWeight: "700" }}>{(item.qty * item.price).toFixed(2)}</td>
          </tr>
        ))}</tbody>
      </table>
      <BlockRenderer blocks={customBlocks} position="after_items" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {/* Totals */}
      <BlockRenderer blocks={customBlocks} position="before_totals" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: "45%", fontSize: `${get(s,"item_font_size")}px` }}>
          {get(s,"show_subtotal")      !== false && <div onClick={() => onElementClick("show_subtotal")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_subtotal") }}><span style={{ color: "#64748b" }}>الإجمالي الفرعي</span><span style={{ fontWeight: "700" }}>{currency} {mockSub.toFixed(2)}</span></div>}
          {get(s,"show_discount_line") !== false && <div onClick={() => onElementClick("show_discount_line")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_discount_line") }}><span style={{ color: "#64748b" }}>الخصم</span><span style={{ fontWeight: "700", color: "#dc2626" }}>- 0.00</span></div>}
          {get(s,"show_tax")           !== false && <div onClick={() => onElementClick("show_tax")} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", ...hl("show_tax") }}><span style={{ color: "#64748b" }}>الضريبة ({taxRate}%)</span><span style={{ fontWeight: "700" }}>{currency} {mockTax.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 6px", background: accent, color: "#fff", borderRadius: "2px", marginTop: "3px" }}><span style={{ fontWeight: "900" }}>الإجمالي</span><span style={{ fontWeight: "900" }}>{currency} {mockTotal.toFixed(2)}</span></div>
        </div>
      </div>
      <BlockRenderer blocks={customBlocks} position="after_totals" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />

      {get(s,"show_payment_details") !== false && <div onClick={() => onElementClick("show_payment_details")} style={{ marginTop: "8px", fontSize: `${get(s,"item_font_size")}px`, ...hl("show_payment_details") }}><div style={{ fontWeight: "700", marginBottom: "3px", color: accent }}>طريقة الدفع</div><div style={{ display: "flex", gap: "16px" }}><span>نقداً: {currency} 1500.00</span><span>الباقي: {currency} {(1500 - mockTotal).toFixed(2)}</span></div></div>}

      {get(s,"show_footer") !== false && (
        <><div style={{ marginTop: "12px", paddingTop: "6px", borderTop: `1px solid ${accent}44` }} />
        <BlockRenderer blocks={customBlocks} position="before_footer" paperSize={size} accentColor={accent} hovered={hovered} onElementClick={onElementClick} />
        <div onClick={() => onElementClick("receipt_footer")} style={{ textAlign: "center", fontSize: `${get(s,"footer_font_size")}px`, color: "#94a3b8", fontStyle: "italic", ...hl("receipt_footer") }}>{get(s,"receipt_footer")}</div></>
      )}

      {get(s,"show_qr") !== false && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}><div onClick={() => onElementClick("show_qr")} style={{ width: `${get(s,"qr_size")}px`, height: `${get(s,"qr_size")}px`, background: "#f0f0f0", border: "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#888", cursor: "pointer", ...hl("show_qr") }}>QR</div></div>}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────────

function DocTypeNav({ activeDocType, onSelect }) {
  return (
    <div className="w-[220px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white pl-3">
      <div className="space-y-1">
        {DOC_TYPES.map((doc) => (
          <button key={doc.key} type="button" onClick={() => onSelect(doc.key)}
            className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right text-[11px] font-black transition-colors ${activeDocType === doc.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <span className={`min-w-8 rounded-sm px-1.5 py-0.5 text-center text-[9px] ${activeDocType === doc.key ? "bg-white/15" : "bg-slate-100 text-slate-400"}`}>{doc.icon}</span>
            <span className="truncate">{doc.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PerDocSettingsPanel({ docType, globalSettings, docSettings, onChange, onSave }) {
  const settings = docSettings[docType] || {};
  const set = (key, val) => onChange({ ...docSettings, [docType]: { ...(docSettings[docType] || {}), [key]: val } });
  const merged = { ...(globalSettings || {}), ...settings };
  const label = DOC_TYPES.find((d) => d.key === docType)?.label || docType;

  return (
    <div className="flex flex-1 min-w-0 gap-4 overflow-hidden pr-4">
      <div className="w-[420px] shrink-0 overflow-y-auto space-y-4 rounded-sm border border-slate-200 bg-white p-4">
        <div>
          <div className="text-[13px] font-black text-slate-900">تجاوزات خاصة بـ "{label}"</div>
          <div className="text-[10px] font-bold text-slate-400">اترك الحقل فارغاً لاستخدام الإعداد العام.</div>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-black text-slate-600">حجم الورق</label>
          <div className="flex flex-wrap gap-2">
            {["inherit", "58mm", "80mm", "A5", "A4"].map((size) => (
              <button key={size} type="button" onClick={() => set("paper_size", size)}
                className={`rounded-xl border px-3 py-1.5 text-[11px] font-black ${(settings.paper_size || "inherit") === size ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600"}`}>
                {size === "inherit" ? "افتراضي" : size}
              </button>
            ))}
          </div>
        </div>
        {[["receipt_header", "رأس المستند"], ["receipt_footer", "تذييل المستند"], ["watermark_text", "نص الطابع المائي"]].map(([key, labelText]) => (
          <label key={key} className="block space-y-1">
            <span className="text-[11px] font-black text-slate-600">{labelText}</span>
            <input value={settings[key] || ""} onChange={(e) => set(key, e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 px-3 text-[12px] outline-none focus:border-violet-500" />
          </label>
        ))}
        {[["show_logo", "إظهار الشعار"], ["show_address", "إظهار العنوان"], ["show_phone", "إظهار الهاتف"], ["show_payment_details", "إظهار تفاصيل الدفع"], ["show_signature_lines", "إظهار خطوط التوقيع"], ["show_watermark", "طابع مائي"]].map(([key, labelText]) => (
          <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50">
            <span className="text-[12px] font-bold text-slate-700">{labelText}</span>
            <input type="checkbox" checked={settings[key] !== undefined ? Boolean(settings[key]) : true} onChange={(e) => set(key, e.target.checked)} />
          </label>
        ))}
        <button type="button" onClick={() => onSave(docType, settings)}
          className="w-full rounded-xl bg-violet-600 py-3 text-[13px] font-black text-white hover:bg-violet-700">
          حفظ إعدادات هذا المستند
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-sm border border-slate-200 bg-[#e8ecf0] p-8">
        <div className="mx-auto max-w-[210mm] bg-white shadow-xl">
          <PagePreview settings={{ ...merged, receipt_width: merged.paper_size === "inherit" ? get(globalSettings, "receipt_width") : merged.paper_size || get(globalSettings, "receipt_width") }} size={merged.paper_size === "A5" ? "A5" : "A4"} hovered={null} onElementClick={() => {}} customBlocks={[]} />
        </div>
      </div>
    </div>
  );
}

export default function PrintingSettingsPanel({ settings, onChange }) {
  const [hovered, setHovered] = useState(null);
  const [previewTab, setPreviewTab] = useState(get(settings, "receipt_width"));
  const [activeDocType, setActiveDocType] = useState("global");
  const [docSettings, setDocSettings] = useState({});
  // Pan & Zoom
  const [viewZoom, setViewZoom] = useState(0.6);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  useEffect(() => {
    api.get("/api/print-settings-per-doc")
      .then((r) => setDocSettings(r.data.data || {}))
      .catch(() => {});
  }, []);

  async function saveDocSettings(docType, nextSettings) {
    try {
      await api.put(`/api/print-settings-per-doc/${docType}`, nextSettings || {});
      toast.success("تم حفظ الإعدادات");
    } catch {
      toast.error("خطأ في الحفظ");
    }
  }

  const hover  = useCallback((k) => setHovered(k), []);
  const leave  = useCallback(() => setHovered(null), []);
  const width  = get(settings, "receipt_width");
  const s      = settings;

  const handleElementClick = (key) => {
    setHovered(key);
    const el = document.querySelector(`[data-field-key="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.querySelector("input,select")?.focus();
    }
  };

  const cf = (key, label, hint, children) => (
    <div key={key}>
      <ControlField label={label} hint={hint} fieldKey={key} hovered={hovered} onHover={hover} onLeave={leave}>
        {children}
      </ControlField>
    </div>
  );

  const tog = (key, label, hint) => (
    <div key={key}>
      <ToggleSwitch checked={get(s, key) !== false} onChange={(v) => onChange(key, v)} label={label} hint={hint} fieldKey={key} hovered={hovered} onHover={hover} onLeave={leave} />
    </div>
  );

  // Reset view when changing tabs
  const switchPreviewTab = (v) => {
    setPreviewTab(v);
    setViewZoom(v === "A4" ? 0.55 : v === "A5" ? 0.72 : 0.88);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.07 : 0.07;
    setViewZoom(prev => Math.min(2, Math.max(0.2, prev + delta)));
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
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  };

  const resetView = () => {
    setViewZoom(previewTab === "A4" ? 0.55 : previewTab === "A5" ? 0.72 : 0.88);
    setPan({ x: 0, y: 0 });
  };

  const isRoll = previewTab === "58mm" || previewTab === "80mm";
  const customBlocks = getCustomBlocks(settings);

  // Scale A4/A5 to fit within the preview pane without scroll
  const previewZoom = previewTab === "A4" ? 0.48 : previewTab === "A5" ? 0.58 : 1;

  return (
    <div
      className="flex gap-4"
      style={{ height: "calc(100vh - 220px)", minHeight: "640px" }}
    >
      <DocTypeNav activeDocType={activeDocType} onSelect={setActiveDocType} />
      {activeDocType !== "global" ? (
        <PerDocSettingsPanel
          docType={activeDocType}
          globalSettings={settings}
          docSettings={docSettings}
          onChange={setDocSettings}
          onSave={saveDocSettings}
        />
      ) : (
      <>

      {/* ── Controls (right in RTL) — scrolls internally ── */}
      <div className="flex-1 min-w-0 overflow-y-auto pr-4 space-y-10" style={{ paddingBottom: "2rem" }}>

        {/* Paper */}
        <section>
          <SectionLabel icon={Ruler} title="مقاس ورق الطباعة" hint="يؤثر على تخطيط القالب فوراً" />
          <PaperPicker value={width} onChange={(v) => { onChange("receipt_width", v); setPreviewTab(v); }} />
          <div className="mt-4 grid grid-cols-3 gap-4">
            {cf("margin_top",   "هامش علوي", "يرفع نقطة البداية من الأعلى", <Stepper value={get(s,"margin_top")}  onChange={v => onChange("margin_top", v)}  min={0} max={30} unit="mm" />)}
            {cf("margin_side",  "هامش جانبي", "المسافة من اليمين واليسار",    <Stepper value={get(s,"margin_side")} onChange={v => onChange("margin_side", v)} min={0} max={20} unit="mm" />)}
            {cf("accent_color", "لون النظام (A4/A5)", "رأس الجدول، الفواجز، العناوين",
              <div className="flex items-center gap-2">
                <input type="color" value={get(s,"accent_color")} onChange={e => onChange("accent_color", e.target.value)} className="h-9 w-14 rounded-sm border border-slate-200 cursor-pointer" />
                <StyledInput value={get(s,"accent_color")} onChange={e => onChange("accent_color", e.target.value)} />
              </div>
            )}
          </div>
        </section>

        {/* Prefixes */}
        <section>
          <SectionLabel icon={Hash} title="بادئات أرقام المستندات" hint="مستقلة لكل نوع مستند" />
          <div className="grid grid-cols-2 gap-4">
            {cf("invoice_prefix",    "فاتورة المبيعات",    null, <StyledInput value={s.invoice_prefix ?? ""}    onChange={e => onChange("invoice_prefix", e.target.value)}    placeholder={DEFAULTS.invoice_prefix} />)}
            {cf("purchase_prefix",   "أمر الشراء",         null, <StyledInput value={s.purchase_prefix ?? ""}   onChange={e => onChange("purchase_prefix", e.target.value)}   placeholder={DEFAULTS.purchase_prefix} />)}
            {cf("return_prefix",     "مذكرة الإرجاع",     null, <StyledInput value={s.return_prefix ?? ""}     onChange={e => onChange("return_prefix", e.target.value)}     placeholder={DEFAULTS.return_prefix} />)}
            {cf("work_order_prefix", "أمر العمل",          null, <StyledInput value={s.work_order_prefix ?? ""} onChange={e => onChange("work_order_prefix", e.target.value)} placeholder={DEFAULTS.work_order_prefix} />)}
            {cf("receipt_prefix",    "إيصال الاستلام",     null, <StyledInput value={s.receipt_prefix ?? ""}    onChange={e => onChange("receipt_prefix", e.target.value)}    placeholder={DEFAULTS.receipt_prefix} />)}
          </div>
        </section>

        {/* Texts */}
        <section>
          <SectionLabel icon={AlignLeft} title="نصوص الرأس والتذييل" hint="تُظهَر أعلى وأسفل كل مستند مطبوع" />
          <div className="space-y-4">
            {cf("receipt_header", "نص ترحيبي في الرأس", "أسفل اسم الشركة مباشرة", <StyledInput value={s.receipt_header ?? ""} onChange={e => onChange("receipt_header", e.target.value)} placeholder={DEFAULTS.receipt_header} />)}
            {cf("receipt_footer", "نص التذييل", "نهاية الإيصال أو الفاتورة",        <StyledInput value={s.receipt_footer ?? ""} onChange={e => onChange("receipt_footer", e.target.value)} placeholder={DEFAULTS.receipt_footer} />)}
          </div>
        </section>

        {/* Typography */}
        <section>
          <SectionLabel icon={Baseline} title="الخط والأحجام" hint="تحكم كامل في مظهر النصوص" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            {cf("print_font",      "عائلة الخط",     null, <StyledSelect value={get(s,"print_font")}      onChange={e => onChange("print_font", e.target.value)}       options={FONT_FAMILIES} />)}
            {cf("logo_alignment",  "محاذاة الشعار",  null, <StyledSelect value={get(s,"logo_alignment")}  onChange={e => onChange("logo_alignment", e.target.value)}   options={[{value:"center",label:"وسط"},{value:"right",label:"يمين"},{value:"left",label:"يسار"}]} />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {cf("header_font_size", "خط اسم الشركة", null, <Stepper value={get(s,"header_font_size")} onChange={v => onChange("header_font_size", v)} min={10} max={32} unit="px" />)}
            {cf("body_font_size",   "خط الجسم",      null, <Stepper value={get(s,"body_font_size")}   onChange={v => onChange("body_font_size", v)}   min={8}  max={18} unit="px" />)}
            {cf("item_font_size",   "خط الأصناف",    null, <Stepper value={get(s,"item_font_size")}   onChange={v => onChange("item_font_size", v)}   min={8}  max={16} unit="px" />)}
            {cf("footer_font_size", "خط التذييل",    null, <Stepper value={get(s,"footer_font_size")} onChange={v => onChange("footer_font_size", v)} min={8}  max={16} unit="px" />)}
            {cf("logo_max_height",  "ارتفاع الشعار", null, <Stepper value={get(s,"logo_max_height")}  onChange={v => onChange("logo_max_height", v)}  min={20} max={100} unit="px" />)}
            {cf("qr_size",          "حجم رمز QR",    null, <Stepper value={get(s,"qr_size")}          onChange={v => onChange("qr_size", v)}          min={28} max={100} unit="px" />)}
          </div>
        </section>

        {/* Visibility */}
        <section>
          <SectionLabel icon={ListChecks} title="عناصر الظهور" hint="مرر فأرتك على مفتاح لتمييز مكانه في المعاينة — أو اضغط على عنصر المعاينة مباشرة" />
          <div className="mb-3 flex items-center gap-2 rounded-sm border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-700">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            اضغط على أي عنصر في المعاينة للانتقال إلى إعداده المقابل هنا والعكس صحيح
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tog("show_logo",            "الشعار",           "في رأس المستند")}
            {tog("show_branch",          "اسم الفرع",        "أسفل اسم الشركة")}
            {tog("show_address",         "العنوان",          "عنوان المتجر")}
            {tog("show_phone",           "رقم الهاتف",       "هاتف التواصل")}
            {tog("show_tax_id",          "الرقم الضريبي",    "رقم التسجيل")}
            {tog("show_invoice_date",    "تاريخ الفاتورة",   "التاريخ والوقت")}
            {tog("show_customer_name",   "اسم العميل",       "في رأس الفاتورة")}
            {tog("show_cashier_name",    "اسم الكاشير",      "موظف المبيعات")}
            {tog("show_subtotal",        "الإجمالي الفرعي",  "قبل الضريبة والخصم")}
            {tog("show_discount_line",   "سطر الخصم",        "إجمالي الخصومات")}
            {tog("show_tax",             "سطر الضريبة",      "مبلغ الضريبة")}
            {tog("show_payment_details", "طريقة الدفع",      "نقد / بنك / شبكة")}
            {tog("show_footer",          "التذييل النصي",    "رسالة الشكر")}
            {tog("show_qr",              "رمز QR",           "رمز التحقق")}
            {tog("show_barcode_line",    "باركود المنتج",    "لكل صنف")}
            {tog("show_item_code",       "كود المنتج (SKU)",  "رمز الصنف في جدول الأصناف")}
          </div>
        </section>

        {/* Custom Text Blocks */}
        <section>
          <SectionLabel icon={AlignLeft} title="نصوص مخصصة" hint="أضف نصوصاً حرة في أي موضع من المستند — تحتفظ بالمسافات والأسطر كما كتبتها" />
          <CustomTextBlocksSection
            blocks={customBlocks}
            onUpdate={(newBlocks) => saveCustomBlocks(newBlocks, onChange)}
          />
        </section>

      </div>

      {/* ── Separator ── */}
      <div className="w-px self-stretch bg-slate-100 mx-2 shrink-0" />

      {/* ── Preview (left in RTL) — fixed height, no sticky needed ── */}
      <div className="w-[520px] shrink-0 flex flex-col" style={{ height: "100%" }}>

        {/* Preview Header */}
        <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-3 rounded-t-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span className="text-[12px] font-black uppercase tracking-widest">معاينة حية</span>
          </div>
          <div className="text-[10px] font-bold">
            {hovered && VISUAL_FIELDS.has(hovered)
              ? <span className="flex items-center gap-1.5 text-amber-400"><MousePointerClick className="h-3 w-3" />يتم التمييز</span>
              : <span className="text-slate-500">مرر على الإعدادات</span>
            }
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex overflow-hidden border-x border-slate-200">
          {PAPER_OPTIONS.map(({ value: v, label }) => (
            <button key={v} type="button" onClick={() => switchPreviewTab(v)}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-l last:border-l-0 border-slate-200 ${previewTab === v ? "bg-amber-400 text-white" : "bg-white text-slate-400 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Status Bar */}
        <div className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 border-x border-slate-200 ${width === previewTab ? "bg-emerald-50 text-emerald-700 border-b border-emerald-100" : "bg-amber-50 text-amber-700 border-b border-amber-100"}`}>
          <div className="h-1.5 w-1.5 rounded-full bg-current" />
          {width === previewTab ? `المقاس الافتراضي للنظام (${width})` : `تعاين: ${previewTab} | الافتراضي: ${width}`}
        </div>

        {/* Hint */}
        <div className="border-x border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-bold text-slate-500 flex items-center gap-1.5">
          <MousePointerClick className="h-3 w-3 text-slate-400 shrink-0" />
          اضغط على أي عنصر لتحديد إعداده في القائمة
        </div>

        {/* Preview Viewport — interactive pan & zoom canvas */}
        <div
          ref={viewportRef}
          className="relative flex-1 overflow-hidden border border-t-0 border-slate-200 bg-[#e8ecf0]"
          style={{ cursor: "grab" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Content layer — absolutely positioned so transform doesn't affect layout */}
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
            }}
          >
            {isRoll
              ? <ThermalPreview settings={{ ...s, receipt_width: previewTab }} hovered={hovered} onElementClick={handleElementClick} customBlocks={customBlocks} />
              : <PagePreview    settings={s} hovered={hovered} onElementClick={handleElementClick} size={previewTab} customBlocks={customBlocks} />
            }
          </div>

          {/* Zoom Overlay Controls */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-sm bg-white/90 border border-slate-200 shadow-md backdrop-blur-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setViewZoom(v => Math.min(2, v + 0.1))}
              className="px-2.5 py-1.5 text-[14px] font-black text-slate-700 hover:bg-slate-100 transition-colors border-l border-slate-200"
              title="تكبير"
            >+</button>
            <button
              type="button"
              onClick={resetView}
              className="px-2 py-1.5 text-[9px] font-black text-slate-600 hover:bg-slate-100 transition-colors min-w-[42px] text-center"
              title="إعادة ضبط"
            >{Math.round(viewZoom * 100)}%</button>
            <button
              type="button"
              onClick={() => setViewZoom(v => Math.max(0.2, v - 0.1))}
              className="px-2.5 py-1.5 text-[14px] font-black text-slate-700 hover:bg-slate-100 transition-colors border-r border-slate-200"
              title="تصغير"
            >−</button>
          </div>

          {/* Hint overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-sm bg-black/30 px-2 py-1 text-[9px] font-bold text-white backdrop-blur-sm pointer-events-none">
            عجلة الفأرة للتكبير • اسحب للتنقل
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="border border-t-0 border-slate-200 bg-white px-3 py-2.5">
          <div className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">تبديل سريع من المعاينة</div>
          <div className="flex flex-wrap gap-1.5">
            {[["show_logo","شعار"],["show_tax","ضريبة"],["show_qr","QR"],["show_footer","تذييل"],["show_payment_details","دفع"],["show_cashier_name","كاشير"],["show_customer_name","عميل"],["show_discount_line","خصم"]].map(([key, label]) => {
              const on = get(s, key) !== false;
              return (
                <button key={key} type="button"
                  onClick={() => onChange(key, !on)}
                  onMouseEnter={() => hover(key)} onMouseLeave={leave}
                  className={`rounded-sm border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

      </div>
      </>
      )}
    </div>
  );
}
