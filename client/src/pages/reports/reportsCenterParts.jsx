import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, CalendarDays, Search, X, Package, User } from "lucide-react";
import { PREVIEW_COLUMNS, GHOST_ROWS, COL_TYPE_STYLE } from "./reportsCenterConfig";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import api from "../../services/api";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

// ─── Normalize column from either config format or server format ─────
function normalizeCol(c) {
  if (!c) return null;
  if (c.k !== undefined && c.l !== undefined) {
    return { key: c.k, label: c.l, type: c.t || c.type || "text" };
  }
  if (c.key !== undefined) {
    return { key: c.key, label: c.label || c.key, type: c.type || "text" };
  }
  return null;
}

// ─── LookupList ───────────────────────────────────────────────────────────────
function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-border-subtle bg-bg-surface p-4 text-center text-[12px] font-bold text-text-muted shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-border-subtle bg-bg-surface shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-border-strong">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-primary-DEFAULT/10" : "hover:bg-bg-overlay"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-border-normal" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-bg-overlay flex items-center justify-center border border-border-normal">
                  {item.code ? <Package className="w-4 h-4 text-text-muted"/> : <User className="w-4 h-4 text-text-muted"/>}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-primary-DEFAULT" : "text-text-primary"}`}><Highlight text={item.name} query={query} /></span>
                {(item.item_code || item.code || item.barcode || item.phone) && (
                  <span className="font-mono text-[10px] text-text-muted font-bold"><Highlight text={item.item_code || item.code || item.barcode || item.phone || `#${item.id}`} query={query} /></span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Select ────────────────────────────────────────────────────────────
export function RSelect({ value, onChange, options, placeholder = "اختر..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-[8px] border border-border-normal bg-bg-surface px-3 py-2 text-[12px] font-bold text-text-primary outline-none transition-all hover:border-border-strong focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={13} className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            className="absolute left-0 right-0 z-50 rounded-[8px] border border-border-subtle bg-bg-surface p-1 shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
          >
            <div className="max-h-44 overflow-y-auto scrollbar-hide">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between rounded-[5px] px-2.5 py-1.5 text-[12px] font-bold transition-colors ${
                    value === opt.value ? "bg-emerald-500/10 text-emerald-600" : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                  {value === opt.value && <Check size={13} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Date Input ───────────────────────────────────────────────────────────────
export function RDate({ value, onChange }) {
  const ref = useRef(null);
  return (
    <div
      onClick={() => ref.current?.showPicker?.()}
      className="relative flex items-center justify-between rounded-[8px] border border-border-normal bg-bg-surface px-3 py-2 cursor-pointer transition-all hover:border-border-strong focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30"
    >
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[12px] font-bold text-text-primary outline-none appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0"
      />
      <CalendarDays size={13} className="text-text-muted pointer-events-none shrink-0" />
    </div>
  );
}

// ─── Date Preset Chips ────────────────────────────────────────────────────────
const fmtD = (d) => d.toISOString().slice(0, 10);
export const DATE_PRESETS = [
  { label: "اليوم",     get: () => { const t = new Date(); return { from: fmtD(t), to: fmtD(t) }; } },
  { label: "هذا الأسبوع", get: () => { const t = new Date(), s = new Date(t); s.setDate(t.getDate() - t.getDay()); return { from: fmtD(s), to: fmtD(t) }; } },
  { label: "هذا الشهر", get: () => { const t = new Date(); return { from: fmtD(new Date(t.getFullYear(), t.getMonth(), 1)), to: fmtD(t) }; } },
  { label: "آخر ٣ أشهر", get: () => { const t = new Date(), s = new Date(t); s.setMonth(s.getMonth() - 3); return { from: fmtD(s), to: fmtD(t) }; } },
  { label: "هذا العام", get: () => { const t = new Date(); return { from: fmtD(new Date(t.getFullYear(), 0, 1)), to: fmtD(t) }; } },
];

export function DatePresets({ activeFrom, activeTo, onApply }) {
  const active = DATE_PRESETS.find((p) => {
    const d = p.get();
    return d.from === activeFrom && d.to === activeTo;
  });
  return (
    <div className="flex flex-wrap gap-1.5">
      {DATE_PRESETS.map((p) => {
        const isActive = active?.label === p.label;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onApply(p.get())}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition-all ${
              isActive
                ? "bg-emerald-500 text-white border-emerald-500"
                : "border-border-normal text-text-secondary hover:border-emerald-400 hover:text-emerald-600 bg-bg-base"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Scope Selector ───────────────────────────────────────────────────────────
export function ScopeSelector({ scopeOptions, scope, onScopeChange }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (scope.type === "category" && !categories.length) {
      api.get("/api/categories").then(r => setItems(r.data.data || [])).catch(()=>setCategories(["موبايلات وتابلتات", "إكسسوارات"]));
    } else if (scope.type === "product" && !items.length) {
      api.get("/api/items").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "supplier" && !items.length) {
      api.get("/api/suppliers").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "customer" && !items.length) {
      api.get("/api/customers").then(r => setItems(r.data.data || [])).catch(()=>{});
    } else if (scope.type === "category" && items.length > 0 && typeof items[0] === 'object') {
      setCategories(items.map(i => ({ id: i.id, name: i.name })));
    }
  }, [scope.type, categories.length, items.length]);

  if (!scopeOptions || scopeOptions.length <= 1) return null;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items.slice(0, 8);
    const searchKeys = scope.type === "product" ? ["name", "code", "item_code", "barcode"] : (scope.type === "category" ? ["name"] : ["name", "phone"]);
    return fuzzyFilterRows(items, search, searchKeys).slice(0, 8);
  }, [search, items, scope.type]);

  const handlePickItem = (item) => {
    onScopeChange({ ...scope, values: [item.id], valueLabels: [item.name] });
    setSearch("");
    setLookupOpen(false);
  };

  const subControl = () => {
    if (scope.type === "all") return null;
    if (scope.type === "category") {
      const cats = items.length > 0 && typeof items[0] === 'object' ? items.map(c => ({ id: c.id, name: c.name })) : categories;
      return (
        <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border-strong">
          {cats.map((c) => {
            const id = c.id || c.name;
            const name = c.name || c;
            const sel = Array.isArray(scope.values) && scope.values.includes(id);
            return (
              <label key={id} className="flex items-center gap-2.5 cursor-pointer group">
                <div
                  onClick={() => {
                    const cur = Array.isArray(scope.values) ? scope.values : [];
                    onScopeChange({ ...scope, values: sel ? cur.filter((x) => x !== id) : [...cur, id] });
                  }}
                  className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all shrink-0 ${
                    sel ? "bg-emerald-500 border-emerald-500" : "border-border-normal group-hover:border-emerald-400"
                  }`}
                >
                  {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-[12px] font-bold text-text-secondary group-hover:text-text-primary">{name}</span>
              </label>
            );
          })}
        </div>
      );
    }
    if (scope.type === "product" || scope.type === "customer" || scope.type === "supplier") {
      const label = scope.type === "product" ? "ابحث عن منتج بالاسم أو الباركود..." : scope.type === "customer" ? "ابحث عن عميل..." : "ابحث عن مورد...";
      return (
        <div className="mt-3 relative">
          <SearchInput
            value={search}
            onChange={(val) => { setSearch(val); setLookupOpen(true); }}
            onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
            onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
            placeholder={label}
            size="md"
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredItems.length > 0) { e.preventDefault(); handlePickItem(filteredItems[activeIndex]); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(prev => Math.min(prev + 1, filteredItems.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(prev => Math.max(prev - 1, 0)); }
            }}
          />
          {scope.values?.[0] && (
            <div className="mt-2 flex items-center justify-between rounded-[6px] bg-emerald-500/10 border border-emerald-200/50 px-2.5 py-1.5">
              <span className="text-[12px] font-bold text-emerald-700">{scope.valueLabels?.[0] || scope.values[0]}</span>
              <button onClick={() => onScopeChange({ ...scope, values: [], valueLabels: [] })} className="text-emerald-500 hover:text-emerald-700 transition-colors">
                <X size={13} />
              </button>
            </div>
          )}
          {lookupOpen && <LookupList items={filteredItems} onPick={handlePickItem} activeIndex={activeIndex} query={search} />}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {scopeOptions.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => {
              if (scope.type !== opt.type) setItems([]);
              onScopeChange({ type: opt.type, values: [], valueLabels: [] });
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${
              scope.type === opt.type
                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                : "border-border-normal text-text-secondary hover:border-emerald-400 hover:text-emerald-600 bg-bg-base"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {scope.type !== "all" && (
          <motion.div
            key={scope.type}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="relative z-50"
          >
            {subControl()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Column Preview Strip (card) ──────────────────────────────────────────────
function getPreviewColumns(report, catId) {
  if (Array.isArray(report?.columns) && report.columns.length) {
    return report.columns.map(normalizeCol).filter(Boolean);
  }
  return (PREVIEW_COLUMNS[catId] || []).map(normalizeCol).filter(Boolean);
}

function sampleValueForColumn(col, rowIndex) {
  const key = col.key;
  const type = col.type;
  const samples = {
    date:        rowIndex === 0 ? "٠٤/٠٥/٢٠٢٦" : "٠٣/٠٥/٢٠٢٦",
    cur:         rowIndex === 0 ? "١٢٬٤٥٠" : "٨٬٣٠٠",
    num:         rowIndex === 0 ? "٢٤" : "٨",
    percent:     rowIndex === 0 ? "١٤٫٥٪" : "٨٫٢٪",
    code:        rowIndex === 0 ? "SKU-١٠٠١" : "SKU-١٠٠٢",
    text:        key === "weekday_name" ? (rowIndex === 0 ? "السبت" : "الأحد") :
                 key.includes("status") ? (rowIndex === 0 ? "مدفوع" : "غير مدفوع") :
                 key.includes("action") ? (rowIndex === 0 ? "إنشاء فاتورة" : "تعديل سعر") :
                 key.includes("reason") ? (rowIndex === 0 ? "مرتجع تالف" : "خطأ في الفاتورة") :
                 key.includes("name") || key.includes("party") ? (rowIndex === 0 ? "أحمد البرقوقي" : "شركة النور") :
                 key.includes("payment") || key.includes("refund") ? (rowIndex === 0 ? "نقداً" : "بطاقة") :
                 key.includes("bucket") || key.includes("aging") ? (rowIndex === 0 ? "0-30 يوم" : "31-60 يوم") :
                 key.includes("movement") ? (rowIndex === 0 ? "إضافة مخزون" : "تسوية") :
                 "بيان تجريبي",
  };
  return samples[type] || samples.text;
}

export function ColumnPreviewStrip({ catId, colVisibility, report }) {
  const cols = getPreviewColumns(report, catId);
  const visible = cols.filter((c) => colVisibility[c.key] !== false);
  if (!visible.length) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
      {visible.map((c) => (
        <span
          key={c.key}
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${COL_TYPE_STYLE[c.type] || COL_TYPE_STYLE.text}`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Ghost Preview Rows (card) ────────────────────────────────────────────────
export function GhostPreviewRows({ catId, colVisibility, report }) {
  const cols = getPreviewColumns(report, catId);
  const visible = cols.filter((c) => colVisibility[c.key] !== false);
  const ghostRows = GHOST_ROWS[catId] || [];

  // Generate rows: use GHOST_ROWS objects if available, otherwise build from columns
  const rows = ghostRows.length
    ? [0, 1, 2].slice(0, Math.min(ghostRows.length, 3)).map((ri) => visible.map((c) => ghostRows[ri]?.[c.key] ?? sampleValueForColumn(c, ri)))
    : [0, 1, 2].map((ri) => visible.map((c) => sampleValueForColumn(c, ri)));

  if (!visible.length) return null;
  return (
    <div className="mt-2 space-y-1 opacity-40">
      <div className="flex gap-2 mb-1">
        {visible.slice(0, 5).map((c) => (
          <span key={c.key} className="flex-1 text-[9px] font-black text-text-muted uppercase truncate">{c.label}</span>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2 rounded-[4px] bg-bg-overlay px-1.5 py-1">
          {visible.slice(0, 5).map((c, ci) => (
            <span key={c.key} className={`flex-1 text-[10px] truncate font-bold ${c.type === "cur" || c.type === "num" ? "font-mono text-text-primary" : "text-text-secondary"}`}>
              {row[ci] ?? "—"}
            </span>
          ))}
        </div>
      ))}
      <p className="text-[9px] text-text-muted text-left mt-1">* بيانات عينة للمعاينة فقط</p>
    </div>
  );
}

// ─── Column Visibility Toggles ────────────────────────────────────────────────
export function ColumnToggleList({ catId, colVisibility, onChange, report }) {
  const cols = getPreviewColumns(report, catId);
  if (!cols.length) return null;
  return (
    <div className="space-y-1.5">
      {cols.map((c) => {
        const on = colVisibility[c.key] !== false;
        return (
          <div key={c.key} className="flex items-center justify-between py-1 border-b border-border-subtle/50 last:border-0">
            <span className={`text-[12px] font-bold ${on ? "text-text-primary" : "text-text-muted"}`}>{c.label}</span>
            <button
              type="button"
              onClick={() => onChange({ ...colVisibility, [c.key]: !on })}
              className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-border-strong"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Lookup Filter (for workspace filter panel) ──────────────────────────────
export function LookupEntityFilter({ entity, value, onChange, placeholder }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const entityApi = {
    category: "/api/categories",
    product: "/api/items",
    customer: "/api/customers",
    supplier: "/api/suppliers",
    user: "/api/users",
    warehouse: "/api/warehouses",
  }[entity];

  useEffect(() => {
    if (entityApi && !items.length) {
      api.get(entityApi).then(r => setItems(r.data.data || [])).catch(() => {});
    }
  }, [entity, entityApi, items.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items.slice(0, 12);
    const keys = entity === "product" ? ["name", "code", "item_code", "barcode"] : ["name"];
    return fuzzyFilterRows(items, search, keys).slice(0, 12);
  }, [search, items, entity]);

  const picked = value ? items.find((i) => String(i.id) === String(value)) : null;

  return (
    <div className="relative" ref={ref}>
      {picked ? (
        <div className="flex items-center justify-between rounded-[8px] border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-1.5">
          <span className="text-[12px] font-bold text-emerald-700">{picked.name}</span>
          <button onClick={() => { onChange(""); setSearch(""); }} className="text-emerald-500 hover:text-emerald-700">
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || "بحث..."}
            size="md"
            className="w-full"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) { e.preventDefault(); onChange(filtered[activeIndex].id); setSearch(""); setOpen(false); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            }}
          />
          {open && (
            <LookupList
              items={filtered}
              onPick={(item) => { onChange(item.id); setSearch(""); setOpen(false); }}
              activeIndex={activeIndex}
              query={search}
              emptyLabel="لا توجد نتائج"
            />
          )}
        </>
      )}
    </div>
  );
}
