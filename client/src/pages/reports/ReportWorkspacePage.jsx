import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronDown, ChevronUp,
  FileImage, FileSpreadsheet, FileText, Filter,
  LayoutList, Loader2, Printer, RefreshCw, RotateCcw, Search,
  TrendingUp, Package, Wallet, Receipt, Shield, ClipboardList,
  SlidersHorizontal, X
} from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import DataGrid from "../../components/ui/DataGrid";
import api from "../../services/api";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import { getReportDefinitionBySlug } from "./reportCatalog";
import ReportPrintTemplate from "./templates/ReportPrintTemplate";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function prettifyLabel(key) {
  const labels = {
    item_code: "كود الصنف (SKU)",
    code: "كود الصنف (SKU)",
    sku: "SKU",
    item_id: "معرّف الصنف",
    item_name: "اسم الصنف",
    name: "الاسم",
    invoice_no: "رقم الفاتورة",
    customer_name: "العميل",
    supplier_name: "المورد",
    date: "التاريخ",
    total: "الإجمالي",
    total_sales: "إجمالي المبيعات",
    invoice_count: "عدد الفواتير",
    quantity: "الكمية",
    quantity_sold: "الكمية المباعة",
    stock_quantity: "رصيد المخزون",
    system_quantity: "رصيد النظام",
    category_name: "التصنيف",
    payment_type: "طريقة الدفع",
    status: "الحالة",
    balance: "الرصيد",
    source: "المصدر",
    tax_rate: "نسبة الضريبة",
    taxable_sales: "المبيعات الخاضعة",
    outstanding_balance: "الرصيد المستحق",
    hour_slot: "الساعة",
    weekday: "يوم الأسبوع",
    action: "الإجراء",
    resource: "الكيان",
    created_at: "تاريخ الإنشاء",
    line_total: "إجمالي السطر",
    movement_type: "نوع الحركة",
    reference_type: "نوع المرجع",
    reference_id: "رقم المرجع",
    revenue: "الإيراد",
    min_stock_qty: "حد أدنى للمخزون",
    min_stock: "حد أدنى",
    unit_name: "الوحدة",
    total_quantity: "إجمالي الكمية",
    cost_price: "سعر التكلفة",
    total_value: "القيمة الإجمالية",
    total_spent: "إجمالي الإنفاق",
    barcode: "الباركود",
    payload_json: "تفاصيل",
    user_id: "المستخدم",
    // New labels
    gross_sales: "المبيعات الإجمالية",
    net_sales: "المبيعات الصافية",
    total_discount: "إجمالي الخصم",
    avg_discount: "متوسط الخصم",
    return_total: "إجمالي المرتجع",
    reason: "السبب",
    profit_margin: "هامش الربح",
    margin_percent: "نسبة الربح %",
    cost: "التكلفة",
    purchase_count: "عدد المشتريات",
    total_purchases: "إجمالي المشتريات",
    purchase_no: "رقم الشراء",
    quantity_purchased: "الكمية المشتراة",
    total_cost: "إجمالي التكلفة",
    unit_price: "سعر الوحدة",
    purchase_date: "تاريخ الشراء",
    stock_status: "حالة المخزون",
    shift_id: "رقم الوردية",
    opening_cash: "النقد الافتتاحي",
    closing_cash: "النقد الختامي",
    variance: "الفرق",
    transaction_count: "عدد المعاملات",
    total_amount: "إجمالي المبلغ",
    type: "النوع",
    taxable_amount: "المبلغ الخاضع",
    vat_amount: "قيمة الضريبة",
    output_vat: "ضريبة المخرجات",
    input_vat: "ضريبة المدخلات",
    return_amount: "قيمة المرتجع",
    vat_reversed: "الضريبة المستردة",
    total_invoices: "إجمالي الفواتير",
    total_billed: "إجمالي الفوترة",
    collected: "المحصل",
    outstanding: "المستحق",
    collection_rate: "نسبة التحصيل %",
    action_count: "عدد العمليات",
  };
  return labels[key] || key;
}

function orderReportColumnKeys(keys) {
  const out = [];
  const used = new Set();
  for (const k of ["item_code", "code", "sku", "barcode"]) {
    if (keys.includes(k) && !used.has(k)) { out.push(k); used.add(k); }
  }
  for (const k of ["item_name", "name"]) {
    if (keys.includes(k) && !used.has(k)) { out.push(k); used.add(k); }
  }
  for (const k of keys) { if (!used.has(k)) out.push(k); }
  return out;
}

const SKU_COLUMN_KEYS = new Set(["item_code", "code", "sku", "barcode"]);

const CATEGORY_META = {
  sales: { color: "#059669", bg: "rgba(5,150,105,0.10)", icon: TrendingUp, label: "مبيعات" },
  purchases: { color: "#2563EB", bg: "rgba(37,99,235,0.10)", icon: Package, label: "مشتريات" },
  inventory: { color: "#7C3AED", bg: "rgba(124,58,237,0.10)", icon: Package, label: "مخزون" },
  accounts: { color: "#D97706", bg: "rgba(217,119,6,0.10)", icon: Wallet, label: "حسابات" },
  treasury: { color: "#0891B2", bg: "rgba(8,145,178,0.10)", icon: Receipt, label: "خزينة" },
  tax: { color: "#DC2626", bg: "rgba(220,38,38,0.10)", icon: FileText, label: "ضرائب" },
  audit: { color: "#475569", bg: "rgba(71,85,105,0.10)", icon: Shield, label: "تدقيق" },
};

const EXPORT_CONFIGS = {
  pdf: { label: "PDF", icon: FileImage, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  word: { label: "Word", icon: FileText, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  print: { label: "Print", icon: Printer, color: "#475569", bg: "rgba(71,85,105,0.08)" },
};

const DATE_PRESETS = [
  { label: "اليوم", days: 0 },
  { label: "أمس", days: 1 },
  { label: "الأسبوع", days: 7 },
  { label: "الشهر", days: 30 },
  { label: "الربع", days: 90 },
];

/* ─── Loading Skeleton ─── */
function TableSkeleton({ colCount = 6 }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-3">
        {Array.from({ length: colCount }).map((_, i) => (
          <div key={i} className="h-8 flex-1 rounded-lg bg-slate-100 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: colCount }).map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-lg bg-slate-50 animate-pulse" style={{ animationDelay: `${(rowIdx + i) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Modern Export Button ─── */
function ExportPill({ format, onExport }) {
  const [status, setStatus] = useState("idle");
  const cfg = EXPORT_CONFIGS[format];
  if (!cfg) return null;
  const Icon = cfg.icon;

  const handleClick = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try {
      await onExport(format);
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      console.error("[ExportPill] Export failed:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const isReady = status === "ready";
  const isError = status === "error";
  const isLoading = status === "loading";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold transition-all duration-200 border"
      style={{
        backgroundColor: isReady ? "#ecfdf5" : isError ? "#fef2f2" : cfg.bg,
        color: isReady ? "#047857" : isError ? "#b91c1c" : cfg.color,
        borderColor: isReady ? "#6ee7b7" : isError ? "#fca5a5" : `${cfg.color}25`,
        transform: isLoading ? "scale(0.98)" : "scale(1)",
        opacity: isLoading ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isLoading && !isReady && !isError) {
          e.currentTarget.style.backgroundColor = cfg.color;
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = `0 4px 12px ${cfg.color}30`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isLoading && !isReady && !isError) {
          e.currentTarget.style.backgroundColor = cfg.bg;
          e.currentTarget.style.color = cfg.color;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
    >
      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
      <span>
        {isLoading ? "جاري..." : isReady ? "تم ✓" : isError ? "خطأ ✕" : cfg.label}
      </span>
    </button>
  );
}

/* ─── Summary Stat Chip ─── */
function StatChip({ label, value, color = "var(--primary)" }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: `${color}10` }}>
      <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[13px] font-black tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

/* ─── Main Component ─── */
export default function ReportWorkspacePage() {
  const { reportSlug } = useParams();
  const [searchParams] = useSearchParams();
  const definition = getReportDefinitionBySlug(reportSlug);

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const defaultFrom = useMemo(() => formatDate(monthStart), [monthStart]);
  const defaultTo = useMemo(() => formatDate(today), [today]);

  const initialFrom = useMemo(() => {
    const value = searchParams.get("start_date");
    return isValidDateString(value) ? value : defaultFrom;
  }, [defaultFrom, searchParams]);

  const initialTo = useMemo(() => {
    const value = searchParams.get("end_date");
    return isValidDateString(value) ? value : defaultTo;
  }, [defaultTo, searchParams]);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);
  const [refreshTick, setRefreshTick] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printOpen, setPrintOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => ({
    from: initialFrom,
    to: initialTo,
    status: "",
    payment_type: "",
    q: "",
    movement_type: "",
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    from: initialFrom,
    to: initialTo,
    status: "",
    payment_type: "",
    q: "",
    movement_type: "",
  }));

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
    setAppliedFrom(initialFrom);
    setAppliedTo(initialTo);
    setFilters((cur) => ({ ...cur, from: initialFrom, to: initialTo }));
    setAppliedFilters((cur) => ({ ...cur, from: initialFrom, to: initialTo }));
    setRefreshTick((current) => current + 1);
  }, [initialFrom, initialTo, reportSlug]);

  useEffect(() => {
    if (!definition) return undefined;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/reports/run/${reportSlug}`, {
          params: {
            ...(definition.supportsDates ? { start_date: appliedFilters.from, end_date: appliedFilters.to } : {}),
            ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
            ...(appliedFilters.payment_type ? { payment_type: appliedFilters.payment_type } : {}),
            ...(appliedFilters.movement_type ? { movement_type: appliedFilters.movement_type } : {}),
            ...(appliedFilters.q ? { q: appliedFilters.q } : {}),
          },
        });
        if (!mounted) return;
        setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (error) {
        if (!mounted) return;
        setRows([]);
        toast.error(error.response?.data?.message || "فشل تحميل التقرير");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [appliedFrom, appliedTo, definition, refreshTick, reportSlug]);

  const columns = useMemo(() => {
    const sample = rows[0];
    if (!sample) return [];
    const keys = orderReportColumnKeys(Object.keys(sample));
    return keys.map((key) => ({ key, label: prettifyLabel(key) }));
  }, [rows]);

  const categoryMeta = definition ? CATEGORY_META[definition.cat] : null;
  const CategoryIcon = categoryMeta?.icon || BarChart3;
  const exportFormats = definition?.exportFormats || ["pdf", "excel", "print"];

  // Summary stats
  const stats = useMemo(() => {
    if (!rows.length) return null;
    const out = [{ label: "عدد السجلات", value: rows.length.toLocaleString("ar-EG") }];
    // Try to find a total/numeric column to sum
    const totalKey = Object.keys(rows[0]).find((k) =>
      ["total", "total_sales", "total_purchases", "revenue", "total_value", "total_amount", "net_sales", "gross_sales"].includes(k)
    );
    if (totalKey) {
      const sum = rows.reduce((acc, r) => acc + (Number(r[totalKey]) || 0), 0);
      out.push({ label: "الإجمالي", value: sum.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) });
    }
    return out;
  }, [rows]);

  async function handleExport(format) {
    if (format === "print") { setPrintOpen(true); return; }

    const extMap = { pdf: "pdf", excel: "xlsx", word: "docx", docx: "docx" };
    const ext = extMap[format] || "xlsx";
    const filename = `${definition.title}-${new Date().toISOString().slice(0,10)}.${ext}`;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
      const params = new URLSearchParams();
      params.set("format", format);
      if (definition.supportsDates) {
        params.set("start_date", appliedFilters.from);
        params.set("end_date", appliedFilters.to);
      }
      if (appliedFilters.status) params.set("status", appliedFilters.status);
      if (appliedFilters.payment_type) params.set("payment_type", appliedFilters.payment_type);
      if (appliedFilters.movement_type) params.set("movement_type", appliedFilters.movement_type);
      if (appliedFilters.q) params.set("q", appliedFilters.q);

      const url = `${baseUrl}/api/reports/export-slug/${reportSlug}?${params.toString()}`;

      const authData = JSON.parse(localStorage.getItem("retailer.auth") || "null") || {};
      const token = authData.token || "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      console.log("[Export] fetching:", url);
      const response = await fetch(url, { headers });
      console.log("[Export] response status:", response.status, "content-type:", response.headers.get("content-type"));

      if (!response.ok) {
        const text = await response.text().catch(() => "No body");
        console.error("[Export] Server error:", response.status, text.slice(0, 300));
        throw new Error(`خطأ الخادم: ${response.status} - ${text.slice(0, 60)}`);
      }

      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || "";
      console.log("[Export] blob size:", blob.size, "type:", contentType);

      // Safety check: if server sent JSON instead of a file, reject it
      if (contentType.includes("application/json")) {
        const text = await blob.text();
        console.error("[Export] Server returned JSON:", text.slice(0, 300));
        const err = JSON.parse(text);
        throw new Error(err.message || "الخادم أرجع خطأ بدلاً من الملف");
      }

      // Extra safety: a valid .xlsx or .docx must start with PK (ZIP signature)
      const peek = await blob.slice(0, 4).text();
      if (!peek.startsWith("PK") && !contentType.includes("pdf")) {
        console.error("[Export] Invalid file header:", peek);
        throw new Error("الملف المُرسل غير صالح (header خاطئ)");
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`تم تحميل ${filename}`);
    } catch (error) {
      console.error("[Export] Caught error:", error);
      toast.error(error.message || "فشل التصدير، تأكد من اتصالك بالخادم");
      throw error;
    }
  }

  const invalidRange = definition?.supportsDates && filters.from > filters.to;

  function handleApplyFilters() {
    if (invalidRange) { toast.error("تاريخ البداية يجب أن يكون أصغر أو يساوي تاريخ النهاية."); return; }
    setAppliedFrom(filters.from);
    setAppliedTo(filters.to);
    setAppliedFilters(filters);
    setRefreshTick((current) => current + 1);
    setFiltersOpen(false);
  }

  function handleResetFilters() {
    const reset = { from: defaultFrom, to: defaultTo, status: "", payment_type: "", q: "", movement_type: "" };
    setFrom(defaultFrom); setTo(defaultTo);
    setAppliedFrom(defaultFrom); setAppliedTo(defaultTo);
    setFilters(reset); setAppliedFilters(reset);
    setRefreshTick((current) => current + 1);
  }

  function applyPreset(days) {
    const end = new Date();
    const start = new Date();
    if (days > 0) { start.setDate(end.getDate() - days); }
    const s = formatDate(start);
    const e = formatDate(end);
    setFrom(s); setTo(e);
    setFilters((cur) => ({ ...cur, from: s, to: e }));
  }

  if (!definition) {
    return (
      <PageWrapper className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex flex-col items-center justify-center text-center space-y-6">
          <div className="h-20 w-20 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <LayoutList size={36} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 mb-2">التقرير غير متاح</h1>
            <p className="text-sm text-slate-500 max-w-sm">هذا التقرير غير معروف في النظام الحالي. الرجاء التحقق من الرابط أو العودة لمركز التقارير.</p>
          </div>
          <Link to="/reports/center" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-600)] transition-colors shadow-lg shadow-emerald-200/50">
            <ArrowLeft size={16} />
            العودة إلى مركز التقارير
          </Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="mx-auto max-w-[1440px] px-4 py-5">
      {/* ═══════════ HERO HEADER ═══════════ */}
      <div className="relative overflow-hidden rounded-2xl mb-5" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
        <div className="relative flex items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${categoryMeta?.color}20`, color: categoryMeta?.color || "#fff" }}
            >
              <CategoryIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide"
                  style={{ background: categoryMeta?.bg, color: categoryMeta?.color }}
                >
                  {definition.id}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{categoryMeta?.label}</span>
                {definition.supportsDates && (
                  <span className="text-[10px] text-slate-500 bg-slate-700/50 rounded-md px-2 py-0.5">يدعم الفترة الزمنية</span>
                )}
              </div>
              <h1 className="text-[18px] font-black text-white leading-tight mb-1">{definition.title}</h1>
              <p className="text-[12px] text-slate-400 leading-relaxed max-w-xl">{definition.desc}</p>
            </div>
          </div>
          <Link
            to="/reports/center"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-300 bg-slate-700/40 hover:bg-slate-700/70 hover:text-white transition-all border border-slate-600/30"
          >
            <ArrowLeft size={14} />
            مركز التقارير
          </Link>
        </div>

        {/* Stats strip */}
        {stats && !loading && (
          <div className="relative flex items-center gap-4 px-6 pb-4 flex-wrap">
            {stats.map((s) => (
              <StatChip key={s.label} label={s.label} value={s.value} color={categoryMeta?.color || "#fff"} />
            ))}
            <div className="mr-auto flex items-center gap-2 text-[11px] text-slate-500">
              <CalendarDays size={12} />
              {definition.supportsDates ? (
                <span>الفترة: <span className="text-slate-300 font-bold tabular-nums">{appliedFilters.from}</span> → <span className="text-slate-300 font-bold tabular-nums">{appliedFilters.to}</span></span>
              ) : (
                <span>أحدث البيانات المتاحة</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ TOOLBAR ═══════════ */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Top toolbar row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all border"
            style={{
              background: filtersOpen ? "var(--primary-50)" : "var(--bg-surface)",
              color: filtersOpen ? "var(--primary)" : "var(--text-secondary)",
              borderColor: filtersOpen ? "var(--primary-200)" : "var(--border-subtle)",
              boxShadow: filtersOpen ? "0 2px 8px var(--primary-glow)" : "var(--shadow-card)",
            }}
          >
            <SlidersHorizontal size={14} />
            الفلاتر
            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* Quick refresh */}
          <button
            onClick={() => setRefreshTick((c) => c + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all disabled:opacity-50"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            تحديث
          </button>

          {/* Export pills */}
          <div className="flex items-center gap-2 mr-auto flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">تصدير:</span>
            {exportFormats.map((fmt) => (
              <ExportPill key={fmt} format={fmt} onExport={handleExport} />
            ))}
          </div>
        </div>

        {/* Collapsible filter panel */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: filtersOpen ? "500px" : "0px", opacity: filtersOpen ? 1 : 0 }}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" style={{ boxShadow: "var(--shadow-elevated)" }}>
            {/* Date presets + range */}
            {definition.supportsDates && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-slate-400" />
                  <span className="text-[12px] font-bold text-slate-700">الفترة الزمنية</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p.days)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-[var(--primary-50)] hover:text-[var(--primary)] hover:border-[var(--primary-200)] transition-all"
                    >
                      {p.label}
                    </button>
                  ))}
                  <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-500 font-medium">من</label>
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => { setFrom(e.target.value); setFilters((c) => ({ ...c, from: e.target.value })); }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] transition-all"
                    />
                    <label className="text-[11px] text-slate-500 font-medium">إلى</label>
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => { setTo(e.target.value); setFilters((c) => ({ ...c, to: e.target.value })); }}
                      className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] transition-all"
                    />
                  </div>
                </div>
                {invalidRange && (
                  <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-1.5 w-fit">
                    <X size={12} />
                    تاريخ البداية يجب أن يكون أصغر أو يساوي تاريخ النهاية.
                  </div>
                )}
              </div>
            )}

            {/* Dynamic filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">بحث</label>
                <div className="relative">
                  <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filters.q}
                    onChange={(e) => setFilters((c) => ({ ...c, q: e.target.value }))}
                    placeholder="ابحث في التقرير…"
                    className="w-full h-9 pr-9 pl-3 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] transition-all"
                  />
                </div>
              </div>

              {reportSlug === "detailed-sales" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500">حالة الفاتورة</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:border-[var(--primary)] transition-all"
                    >
                      <option value="">الكل</option>
                      <option value="paid">مدفوعة</option>
                      <option value="unpaid">غير مدفوعة</option>
                      <option value="cancelled">ملغاة</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500">طريقة الدفع</label>
                    <select
                      value={filters.payment_type}
                      onChange={(e) => setFilters((c) => ({ ...c, payment_type: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:border-[var(--primary)] transition-all"
                    >
                      <option value="">الكل</option>
                      <option value="cash">نقداً</option>
                      <option value="card">بطاقة</option>
                      <option value="transfer">تحويل</option>
                    </select>
                  </div>
                </>
              )}

              {reportSlug === "stock-movements" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500">نوع الحركة</label>
                  <select
                    value={filters.movement_type}
                    onChange={(e) => setFilters((c) => ({ ...c, movement_type: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700 focus:outline-none focus:border-[var(--primary)] transition-all"
                  >
                    <option value="">الكل</option>
                    <option value="sale">مبيعات</option>
                    <option value="purchase">مشتريات</option>
                    <option value="transfer">تحويل</option>
                    <option value="manual_adjustment">تعديل يدوي</option>
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleApplyFilters}
                disabled={loading || invalidRange}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-200/40"
              >
                <Filter size={13} />
                تطبيق الفلاتر
              </button>
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <RotateCcw size={13} />
                إعادة تعيين
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ DATA SECTION ═══════════ */}
      <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <LayoutList size={14} className="text-slate-400" />
            <span className="text-[12px] font-bold text-slate-600">نتائج التقرير</span>
            {!loading && (
              <span className="text-[11px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                {rows.length.toLocaleString("ar-EG")} سجل
              </span>
            )}
          </div>
          {!loading && rows.length > 0 && (
            <span className="text-[11px] text-slate-400">
              انقر على عنوان العمود للترتيب
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton colCount={Math.min(columns.length || 6, 8)} />
        ) : columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
              <Search size={28} />
            </div>
            <h3 className="text-[15px] font-black text-slate-700 mb-1">لا توجد بيانات</h3>
            <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">
              لا توجد نتائج مطابقة للفلاتر المحددة. جرب تغيير الفترة الزمنية أو إزالة بعض الفلاتر.
            </p>
          </div>
        ) : (
          <DataGrid
            data={rows}
            columns={columns.map((c) => ({
              id: c.key,
              header: c.label,
              width: SKU_COLUMN_KEYS.has(c.key) ? 130 : Math.min(180, 100 + c.label.length * 8),
              sortable: true,
              headerClass: "text-right font-bold text-[11px] text-slate-500 uppercase tracking-wide",
              cellClass: SKU_COLUMN_KEYS.has(c.key) ? "text-right" : "text-right",
              render: SKU_COLUMN_KEYS.has(c.key)
                ? (row) => (
                    <span className="font-mono text-[12px] text-slate-700 tabular-nums" dir="ltr">
                      {row[c.key] != null && row[c.key] !== "" ? String(row[c.key]) : "—"}
                    </span>
                  )
                : (row) => {
                    const val = row[c.key];
                    if (val == null || val === "") return <span className="text-slate-300">—</span>;
                    const num = Number(val);
                    const isNum = !isNaN(num) && String(val).trim() !== "";
                    if (isNum) {
                      return (
                        <span className="tabular-nums text-[13px] text-slate-700 font-medium" dir="ltr">
                          {num.toLocaleString("ar-EG", { maximumFractionDigits: 2 })}
                        </span>
                      );
                    }
                    return <span className="text-[13px] text-slate-700">{String(val)}</span>;
                  },
            }))}
            rowKey={(row) => row.id || JSON.stringify(row)}
            containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
          />
        )}
      </div>

      {/* Print Modal */}
      <PrintPreviewModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        settings={{}}
        operationLabel={definition.title}
        docType="reports_generic"
        renderContent={(printSettings) => (
          <ReportPrintTemplate
            title={definition.title}
            subtitle={definition.desc}
            rows={rows}
            columns={columns}
            filters={definition.supportsDates ? { from: appliedFrom, to: appliedTo } : null}
            settings={printSettings}
          />
        )}
      />
    </PageWrapper>
  );
}