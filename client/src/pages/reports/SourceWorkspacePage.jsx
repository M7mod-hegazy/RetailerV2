import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronDown, FileImage, FileSpreadsheet, FileText,
  LayoutTemplate, LayoutList, Loader2, Printer, RefreshCw, Search, SlidersHorizontal, X,
  ChevronLeft, ChevronRight, Settings2, Eye, EyeOff, ArrowUp, ArrowDown
} from "lucide-react";
import {
  LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell
} from "recharts";
import DataGrid from "../../components/ui/DataGrid";
import { reportsApi } from "../../services/reports";
import { useReportsStore, buildPrefKey } from "../../stores/reportsStore";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ReportPrintTemplate from "./templates/ReportPrintTemplate";
import ProgressBar from "../../components/ui/ProgressBar";
import { ClassificationSelector, DataModeToggle, MultiSelectCheckboxes, LookupEntityFilter, ScopeSelector } from "./reportsCenterParts";
import { SOURCES, SCOPE_OPTIONS, COST_METHODS, fmtDate } from "./reportsCenterConfig";

const CLS_ARABIC = {
  "cls_sales_daily": "الملخص اليومي",
  "cls_sales_detailed": "المبيعات التفصيلية",
  "cls_sales_by_item": "حسب الصنف",
  "cls_sales_by_category": "حسب الفئة",
  "cls_sales_by_cashier": "حسب الكاشير",
  "cls_sales_by_payment": "حسب طريقة الدفع",
  "cls_sales_heatmap": "خريطة حرارة",
  "cls_sales_period_compare": "مقارنة فترتين",
  "cls_sales_discounts": "تحليل الخصومات",
  "cls_sales_margin": "هوامش الربح",
  "cls_sales_tax": "تحليل الضرائب",
  "cls_purchases_summary": "ملخص المشتريات",
  "cls_purchases_detailed": "المشتريات التفصيلية",
  "cls_purchases_by_supplier": "حسب المورد",
  "cls_purchases_by_item": "حسب الصنف",
  "cls_purchases_supplier_pricing": "تسعير الموردين",
  "cls_preturn_summary": "ملخص المرتجعات",
  "cls_preturn_detailed": "مرتجعات تفصيلية",
  "cls_preturn_by_supplier": "حسب المورد",
  "cls_sreturn_summary": "ملخص المرتجعات",
  "cls_sreturn_detailed": "مرتجعات تفصيلية",
  "cls_sreturn_by_customer": "حسب العميل",
  "cls_supplier_statement": "كشف حساب المورد",
  "cls_supplier_aging": "تقادم ذمم الموردين",
  "cls_supplier_purchases": "سجل المشتريات",
  "cls_supplier_returns": "سجل المرتجعات",
  "cls_customer_statement": "كشف حساب العميل",
  "cls_customer_aging": "تقادم ذمم العملاء",
  "cls_top_customers": "أفضل العملاء",
  "cls_collection_efficiency": "كفاءة التحصيل",
  "cls_customer_loyalty": "ولاء العملاء",
  "cls_emp_cashier_perf": "أداء الكاشير",
  "cls_emp_shifts": "الورديات",
  "cls_emp_user_activity": "نشاط المستخدمين",
  "cls_emp_incentives": "الحوافز",
  "cls_inst_plans": "خطط التقسيط",
  "cls_inst_collections": "تحصيلات",
  "cls_inst_by_customer": "حسب العميل",
  "cls_inst_delinquent": "المتأخرات",
  "cls_item_stock_levels": "مستويات المخزون",
  "cls_item_valuation": "تقييم المخزون",
  "cls_item_count_sheet": "ورقة جرد",
  "cls_item_reorder": "إعادة الطلب",
  "cls_item_expiry": "انتهاء الصلاحية",
  "cls_item_slow_moving": "الراكد",
  "cls_item_aging": "تقادم المخزون",
  "cls_item_dead_stock": "مخزون ميت",
  "cls_wh_movements": "حركات المخازن",
  "cls_wh_transfers": "تحويلات",
  "cls_wh_per_warehouse": "حسب المخزن",
  "cls_exp_summary": "ملخص المصروفات",
  "cls_exp_detailed": "مصروفات تفصيلية",
  "cls_exp_by_category": "حسب الفئة",
  "cls_exp_by_payment": "حسب طريقة الدفع",
  "cls_rev_summary": "ملخص الإيرادات",
  "cls_rev_detailed": "إيرادات تفصيلية",
  "cls_rev_by_category": "حسب الفئة",
  "cls_rev_by_payment": "حسب طريقة الدفع",
  "cls_trs_cash_flow": "التدفق النقدي",
  "cls_trs_balances": "الأرصدة",
  "cls_trs_reconciliation": "التسويات",
  "cls_trs_daily_sessions": "الجلسات اليومية",
  "cls_trs_withdrawals": "السحوبات",
  "cls_profit_by_item": "الربح حسب الصنف",
  "cls_profit_by_category": "الربح حسب الفئة",
  "cls_profit_health": "صحة الأرباح",
  "cls_net_income": "قائمة الدخل",
  "cls_net_by_category": "صافي الربح حسب الفئة",
  "cls_net_by_customer": "صافي الربح حسب العميل",
  "cls_net_by_period": "صافي الربح حسب الفترة",
  "cheques": "الشيكات",
  "bank-transactions": "الحركات البنكية",
  "bank-summary": "ملخص البنوك",
  "daily-summary": "الملخص اليومي",
  "detailed": "تفصيلي",
  "summary": "ملخص",
  "by-item": "حسب الصنف",
  "by-category": "حسب الفئة",
  "by-cashier": "حسب الكاشير",
  "by-payment": "حسب طريقة الدفع",
  "by-supplier": "حسب المورد",
  "by-customer": "حسب العميل",
  "supplier-pricing": "تسعير الموردين",
  "income-statement": "قائمة الدخل",
  "by-period": "حسب الفترة",
  "health": "صحة الأرباح",
  "status": "الحالة",
  "paid": "مدفوع",
  "unpaid": "غير مدفوع",
  "cancelled": "ملغي",
  "cash": "نقداً",
  "card": "بطاقة",
  "credit": "آجل",
  "wallet": "محفظة",
};

function a(key) { return CLS_ARABIC[key] || key; }

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const CHART_COLORS = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#F59E0B", "#EC4899"];

const DATE_PRESETS = [
  { label: "اليوم", days: 0 },
  { label: "أمس", days: 1 },
  { label: "الأسبوع", days: 7 },
  { label: "الشهر", days: 30 },
  { label: "الربع", days: 90 },
];

const PAGE_SIZES = [25, 50, 100, 250];

function TableSkeleton({ colCount = 6 }) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-3">
        {Array.from({ length: colCount }).map((_, i) => (
          <div key={i} className="h-8 flex-1 rounded-lg bg-zinc-100 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3">
          {Array.from({ length: colCount }).map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-lg bg-zinc-50 animate-pulse" style={{ animationDelay: `${(rowIdx + i) * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

const EXPORT_CONFIGS = {
  pdf: { label: "PDF", icon: FileImage, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  word: { label: "Word", icon: FileText, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
  print: { label: "Print", icon: Printer, color: "#475569", bg: "rgba(71,85,105,0.08)" },
};

function ExportPill({ format, onExport }) {
  const [status, setStatus] = useState("idle");
  const cfg = EXPORT_CONFIGS[format];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const handleClick = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try { await onExport(format); setStatus("ready"); setTimeout(() => setStatus("idle"), 2500); }
    catch { setStatus("error"); setTimeout(() => setStatus("idle"), 4000); }
  };
  return (
    <button onClick={handleClick} disabled={status === "loading"}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 border bg-white shadow-sm hover:shadow-md active:scale-95"
      style={{ color: status === "ready" ? "#047857" : status === "error" ? "#b91c1c" : cfg.color, borderColor: status === "ready" ? "#6ee7b7" : status === "error" ? "#fca5a5" : "#e4e4e7" }}>
      {status === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      <span>{status === "loading" ? "جاري..." : status === "ready" ? "تم ✓" : status === "error" ? "خطأ" : cfg.label}</span>
    </button>
  );
}

function FilterInput({ filter, value, onChange }) {
  if (filter.type === "lookup") {
    const entityLabel = { category: "تصنيف", product: "منتج", customer: "عميل", supplier: "مورد", user: "مستخدم", warehouse: "مخزن" }[filter.entity] || filter.entity;
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{a(filter.label_key) || entityLabel}</label>
        <LookupEntityFilter entity={filter.entity} value={value || ""} onChange={(v) => onChange(filter.key, v)} placeholder={`بحث عن ${entityLabel}...`} />
      </div>
    );
  }
  if (filter.type === "select") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{a(filter.label_key)}</label>
        <select value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium">
          <option value="">الكل</option>
          {(filter.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{a(opt.label_key)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (filter.type === "text") {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-zinc-500">{a(filter.label_key)}</label>
        <input type="text" value={value || ""} onChange={(e) => onChange(filter.key, e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium" />
      </div>
    );
  }
  return null;
}

function suggestChartType(columns) {
  const keys = columns.map((c) => c.id || c.key || c);
  if (keys.some((k) => k.toLowerCase().includes("date") || k === "created_at")) return "line";
  return "bar";
}

function prepareChartData(rows, columns, chartType) {
  if (!rows.length || !columns.length) return { data: [], xKey: null, yKey: null };
  const keys = columns.map((c) => c.id || c.key || c);
  const dateKey = keys.find((k) => k.toLowerCase().includes("date") || k === "created_at");
  const catKey = keys.find((k) => ["category_name", "payment_type", "movement_type", "status", "type", "hour_slot", "weekday", "reason", "stock_status", "source", "name", "item_name", "customer_name", "supplier_name"].includes(k.toLowerCase()));
  const numericKeys = keys.filter((k) => {
    if (["id", "shift_id", "user_id", "reference_id", "item_id", "resource", "action"].includes(k.toLowerCase())) return false;
    const sample = rows[0]?.[k];
    return sample != null && !isNaN(Number(sample));
  });
  const totalKey = numericKeys.find((k) => ["total", "total_sales", "total_purchases", "revenue", "total_value", "total_amount", "net_sales", "gross_sales", "total_cost", "quantity", "quantity_sold", "balance", "vat_amount"].includes(k.toLowerCase()));
  const yKey = totalKey || numericKeys[0];
  const xKey = chartType === "line" ? dateKey : catKey || keys[0];
  if (!xKey || !yKey) return { data: [], xKey: null, yKey: null };
  let chartData = rows.map((r) => ({ ...r }));
  if (chartType === "line" && dateKey) {
    chartData = [...chartData].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
  }
  return { data: chartData, xKey, yKey };
}

export default function SourceWorkspacePage() {
  const { sourceKey, classificationId, dataMode } = useParams();
  const setColumnOrderAction = useReportsStore((s) => s.setColumnOrder);
  const setColumnVisibilityAction = useReportsStore((s) => s.setColumnVisibility);
  const getStorePreference = useReportsStore((s) => s.getPreference);
  const setCostMethodAction = useReportsStore((s) => s.setCostMethod);
  const store = useReportsStore();

  const prefKey = buildPrefKey(sourceKey, classificationId, dataMode);

  const { data: registry } = useQuery({
    queryKey: ["report-registry"],
    queryFn: () => reportsApi.fetchRegistry(),
    staleTime: 5 * 60 * 1000,
  });

  const sourceDef = useMemo(() => {
    return (SOURCES || []).find((s) => s.id === sourceKey) || null;
  }, [sourceKey]);

  const classifications = useMemo(() => {
    return registry?.classifications?.[sourceKey] || [];
  }, [registry, sourceKey]);

  const clsDef = useMemo(() => {
    return classifications.find((c) => c.id === classificationId) || null;
  }, [classifications, classificationId]);

  // Local state
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultTo = useMemo(() => fmtDate(today), [today]);

  const [activeTab, setActiveTab] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ from: defaultFrom, to: defaultTo, q: "" });
  const [scope, setScope] = useState({ type: "all", values: [] });
  const [costMethod, setCostMethod] = useState("wacc");
  const [exportProgress, setExportProgress] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [columnVisibility, setColumnVisibilityState] = useState({});
  const [columnOrder, setColumnOrderState] = useState([]);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const columnDropdownRef = useRef(null);

  const [appliedParams, setAppliedParams] = useState(() => {
    const params = {};
    if (clsDef?.supportsDates) { params.start_date = defaultFrom; params.end_date = defaultTo; }
    if (clsDef?.hasProfit) { params.cost_method = "wacc"; }
    params.page = 1;
    params.pageSize = 50;
    return params;
  });

  useEffect(() => {
    if (!columnVisibilityOpen) return;
    const handler = (e) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(e.target)) setColumnVisibilityOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [columnVisibilityOpen]);

  const {
    data: result,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["source-report", sourceKey, classificationId, dataMode, appliedParams],
    queryFn: () => reportsApi.fetchSourceReport(sourceKey, classificationId, dataMode, appliedParams),
    enabled: !!clsDef,
    placeholderData: keepPreviousData,
  });

  const rows = Array.isArray(result?.data) ? result.data : [];
  const columnsDef = result?.columns || [];
  const totalRows = result?.total || 0;
  const currentPage = result?.page || 1;
  const currentPageSize = result?.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPageSize));
  const serverTotals = result?.totals || {};

  // Normalize columns
  const allColumns = useMemo(() => {
    let cols;
    if (columnsDef.length > 0) {
      cols = columnsDef.map((c, index) => {
        const key = c?.key || c?.id || c;
        return { id: key, key, header: c?.label || key, label: c?.label || key, type: c?.type || "text", defaultVisible: c?.defaultVisible !== false };
      });
    } else {
      const sample = rows[0];
      if (!sample) return [];
      cols = Object.keys(sample).map((key) => ({ id: key, key, header: key, label: key, type: "text", defaultVisible: true }));
    }
    if (columnOrder.length > 0 && columnOrder.length === cols.length) {
      const colMap = {};
      cols.forEach((c) => { colMap[c.id] = c; });
      return columnOrder.map((id) => colMap[id]).filter(Boolean);
    }
    return cols;
  }, [columnsDef, rows, columnOrder]);

  useEffect(() => {
    if (allColumns.length > 0 && Object.keys(columnVisibility).length === 0) {
      const initial = {};
      allColumns.forEach((c) => { initial[c.id] = c.defaultVisible !== false; });
      setColumnVisibilityState(initial);
    }
    if (allColumns.length > 0 && columnOrder.length === 0) {
      const order = allColumns.map((c) => c.id);
      setColumnOrderState(order);
    }
  }, [allColumns]);

  const visibleColumns = useMemo(() => allColumns.filter((c) => columnVisibility[c.id] !== false), [allColumns, columnVisibility]);

  function toggleColumnVisibility(colId) {
    setColumnVisibilityState((prev) => {
      const next = { ...prev, [colId]: !(prev[colId] !== false) };
      setColumnVisibilityAction(prefKey, next);
      return next;
    });
  }

  function moveColumn(colId, direction) {
    setColumnOrderState((prev) => {
      const idx = prev.indexOf(colId);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      setColumnOrderAction(prefKey, next);
      return next;
    });
  }

  const columnTotals = useMemo(() => {
    if (!rows.length) return {};
    if (Object.keys(serverTotals).length > 0) return serverTotals;
    const totals = {};
    allColumns.forEach((col) => {
      if (col.type === "money" || col.type === "number" || col.type === "percent") {
        let sum = 0;
        let hasValue = false;
        rows.forEach((r) => {
          const val = Number(r[col.id]);
          if (!isNaN(val)) { sum += val; hasValue = true; }
        });
        if (hasValue && sum !== 0) totals[col.id] = Math.round(sum * 100) / 100;
      }
    });
    return totals;
  }, [rows, allColumns, serverTotals]);

  const chartType = useMemo(() => suggestChartType(allColumns), [allColumns]);
  const { data: chartData, xKey, yKey } = useMemo(() => prepareChartData(rows, allColumns, chartType), [rows, allColumns, chartType]);

  const invalidRange = clsDef?.supportsDates && filters.from > filters.to;

  function handleApplyFilters() {
    if (invalidRange) { toast.error("تاريخ البداية يجب أن يكون أصغر من تاريخ النهاية."); return; }
    const params = { page: 1, pageSize: currentPageSize };
    if (clsDef?.supportsDates) { params.start_date = filters.from; params.end_date = filters.to; }
    if (clsDef?.hasProfit) { params.cost_method = costMethod; setCostMethodAction(prefKey, costMethod); }
    (clsDef?.filters || []).forEach((f) => {
      if (filters[f.key]) params[f.key] = filters[f.key];
    });
    if (scope.type === "category" && scope.values?.length) params.category_id = scope.values[0];
    else if (scope.type === "product" && scope.values?.length) params.item_id = scope.values[0];
    else if (scope.type === "customer" && scope.values?.length) params.customer_id = scope.values[0];
    else if (scope.type === "supplier" && scope.values?.length) params.supplier_id = scope.values[0];
    if (filters.q) params.q = filters.q;
    setAppliedParams(params);
    setFiltersOpen(false);
  }

  function handleResetFilters() {
    setFilters({ from: defaultFrom, to: defaultTo, q: "" });
    setScope({ type: "all", values: [] });
    setCostMethod("wacc");
    setAppliedParams({ page: 1, pageSize: 50 });
  }

  function handlePageChange(page) {
    setAppliedParams((prev) => ({ ...prev, page: Math.max(1, Math.min(page, totalPages)) }));
  }

  function handlePageSizeChange(size) {
    setAppliedParams((prev) => ({ ...prev, page: 1, pageSize: size }));
  }

  const handleExport = useCallback(async (format, exportColumns = visibleColumns) => {
    if (format === "print") { setPrintOpen(true); return; }
    setExportProgress({ format, percent: 0 });
    try {
      const querySlug = dataMode === "summary" ? clsDef?.summaryQuery : clsDef?.detailedQuery;
      const blob = await reportsApi.exportReport(querySlug, format, {
        ...appliedParams,
        columns: exportColumns,
        onProgress: (e) => {
          if (e.total) setExportProgress((prev) => prev ? { ...prev, percent: Math.round((e.loaded / e.total) * 100) } : null);
        },
      });
      setExportProgress((prev) => prev ? { ...prev, percent: 100 } : null);
      const extMap = { pdf: "pdf", excel: "xlsx", word: "docx" };
      const ext = extMap[format] || "xlsx";
      const filename = `${sourceKey}-${classificationId}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`تم تحميل ${filename}`);
    } catch (error) {
      toast.error(error.message || "فشل التصدير");
      throw error;
    } finally { setTimeout(() => setExportProgress(null), 2000); }
  }, [sourceKey, classificationId, clsDef, appliedParams, visibleColumns]);

  if (!sourceDef) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400 shadow-inner"><LayoutTemplate size={36} /></div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 mb-2">المصدر غير متاح</h1>
            <p className="text-sm text-zinc-500">مصدر التقرير غير معروف.</p>
          </div>
          <Link to="/reports/center" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-900 text-white text-[13px] font-bold hover:bg-zinc-800 transition-colors shadow-lg">
            <ArrowLeft size={16} /> العودة إلى مركز التقارير
          </Link>
        </div>
      </div>
    );
  }

  const SourceIcon = sourceDef.icon;
  const exportFormats = ["pdf", "excel", "print"];
  const categoryColor = sourceDef.color;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8 bg-[#fafafa] min-h-screen text-zinc-900" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-[24px] border border-zinc-200 p-8 shadow-sm mb-6 relative overflow-visible">
        <div className="absolute -left-32 -top-32 w-96 h-96 rounded-full blur-[80px] opacity-10 pointer-events-none" style={{ backgroundColor: categoryColor }} />
        <div className="flex items-start gap-4 mb-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-zinc-50 border border-zinc-100" style={{ color: categoryColor }}>
            <SourceIcon size={26} strokeWidth={2} />
          </div>
          <div className="pt-1 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Link to="/reports/center" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-600 transition-colors">{sourceDef.label}</Link>
              <span className="w-1 h-1 rounded-full bg-zinc-300" />
              <span className="text-[11px] font-bold text-zinc-500">{a(classificationId)}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-300" />
              <span className="text-[11px] font-bold text-zinc-400">{a(dataMode)}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black tracking-tight text-zinc-900">{sourceDef.label}</h1>
              <select
                value={classificationId}
                onChange={(e) => {
                  const cls = classifications.find((c) => c.id === e.target.value);
                  const mode = cls?.availableModes?.[0] || "detailed";
                  window.location.href = `/reports/source/${sourceKey}/${e.target.value}/${mode}`;
                }}
                className="h-11 px-4 rounded-2xl border border-zinc-200 bg-zinc-50 text-[13px] font-bold text-zinc-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                {classifications.map((cls) => (
                  <option key={cls.id} value={cls.id}>{a(cls.label_key)}</option>
                ))}
              </select>
              <DataModeToggle
                availableModes={clsDef?.availableModes || ["detailed"]}
                value={dataMode}
                onChange={(mode) => {
                  window.location.href = `/reports/source/${sourceKey}/${classificationId}/${mode}`;
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Command Bar */}
      <div className="sticky top-4 z-40 bg-white/80 backdrop-blur-xl border border-zinc-200 rounded-[20px] p-2.5 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-3 transition-all">
        <div className="flex items-center gap-2">
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`px-4 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 transition-all ${filtersOpen ? "bg-zinc-900 text-white shadow-md" : "bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200"}`}>
            <SlidersHorizontal size={16} />
            <span>الفلاتر</span>
            <ChevronDown size={14} className={`transition-transform duration-300 ${filtersOpen ? "rotate-180" : ""}`} />
          </button>
          <div className="w-px h-6 bg-zinc-200 mx-1" />
          <button onClick={() => refetch()} className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-[13px] font-bold flex items-center gap-2 transition-all active:scale-95">
            <RefreshCw size={14} className={isFetching ? "animate-spin text-emerald-500" : ""} /> تحديث
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 ml-2">تصدير</span>
          {exportFormats.map((fmt) => <ExportPill key={fmt} format={fmt} onExport={handleExport} />)}
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
            <div className="bg-white rounded-[24px] border border-zinc-200 p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">بحث عام</label>
                  <div className="relative group">
                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="text" value={filters.q || ""} onChange={(e) => setFilters((c) => ({ ...c, q: e.target.value }))}
                      placeholder="ابحث..." className="w-full h-11 pr-11 pl-4 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] text-zinc-900 font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                  </div>
                </div>
                {clsDef?.supportsDates && (
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500 flex justify-between items-center">
                      الفترة الزمنية
                      <div className="flex gap-1">
                        {DATE_PRESETS.map((p) => (
                          <button key={p.label} onClick={() => {
                            const end = new Date(); const start = new Date();
                            if (p.days > 0) start.setDate(end.getDate() - p.days);
                            setFilters((c) => ({ ...c, from: formatDate(start), to: formatDate(end) }));
                          }} className="text-[10px] text-zinc-400 hover:text-zinc-900 transition-colors bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded-md">{p.label}</button>
                        ))}
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={filters.from} onChange={(e) => setFilters((c) => ({ ...c, from: e.target.value }))} className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900" />
                      <span className="text-zinc-400">-</span>
                      <input type="date" value={filters.to} onChange={(e) => setFilters((c) => ({ ...c, to: e.target.value }))} className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900" />
                    </div>
                  </div>
                )}
                {(clsDef?.filters || []).map((f) => (
                  <FilterInput key={f.key} filter={f} value={filters[f.key]} onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))} />
                ))}
                {(clsDef?.multiSelectFilters || []).map((msf) => (
                  <div key={msf.key} className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{a(msf.label_key)}</label>
                    <MultiSelectCheckboxes options={msf.options} value={filters[msf.key] || []} onChange={(v) => setFilters((prev) => ({ ...prev, [msf.key]: v }))} label={a(msf.label_key)} formatLabel={a} />
                  </div>
                ))}
                {clsDef?.supportsScope && (
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">النطاق التحليلي</label>
                    <ScopeSelector scopeOptions={SCOPE_OPTIONS[sourceKey] || SCOPE_OPTIONS.sales} scope={scope} onScopeChange={setScope} />
                  </div>
                )}
                {clsDef?.hasProfit && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-widest text-zinc-500">طريقة حساب التكلفة</label>
                    <select value={costMethod} onChange={(e) => setCostMethod(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[13px] font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-zinc-900">
                      {COST_METHODS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-zinc-100">
                <button onClick={handleResetFilters} className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">إعادة تعيين</button>
                <button onClick={handleApplyFilters} disabled={isLoading || invalidRange}
                  className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-zinc-900 hover:bg-emerald-600 transition-colors shadow-md active:scale-95 disabled:opacity-50">
                  تطبيق
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {exportProgress && (
        <div className="mb-6 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[12px] font-bold text-emerald-800 mb-2">
            <span>جاري تصدير {exportProgress.format.toUpperCase()}...</span>
            <span>{exportProgress.percent}%</span>
          </div>
          <ProgressBar value={exportProgress.percent} max={100} color="emerald" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setActiveTab("table")}
          className={`px-5 py-2.5 text-[13px] font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "table" ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50"}`}>
          <LayoutList size={16} /> جدول
        </button>
        <button onClick={() => setActiveTab("chart")}
          className={`px-5 py-2.5 text-[13px] font-black transition-all rounded-[14px] flex items-center gap-2 ${activeTab === "chart" ? "bg-zinc-900 text-white shadow-md" : "bg-transparent text-zinc-500 hover:bg-zinc-200/50"}`}>
          <BarChart3 size={16} /> رسم بياني
        </button>
      </div>

      {/* Data Area */}
      <div className="bg-white rounded-[24px] border border-zinc-200 shadow-sm overflow-hidden flex flex-col relative" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
        {isLoading ? (
          <TableSkeleton colCount={Math.min(visibleColumns.length || 6, 8)} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center bg-zinc-50/50">
            <div className="h-16 w-16 rounded-3xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-300 mb-4 shadow-sm"><Search size={28} /></div>
            <h3 className="text-[16px] font-black text-zinc-800 mb-1">لا توجد بيانات</h3>
            <p className="text-[13px] text-zinc-500 max-w-xs">يرجى تغيير الفلاتر أو اختيار تصنيف آخر.</p>
          </div>
        ) : activeTab === "table" ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-black text-zinc-900">البيانات</span>
                <span className="text-[11px] font-bold text-zinc-500 bg-white border border-zinc-200 rounded-full px-2.5 py-0.5 shadow-sm">{totalRows.toLocaleString("ar-EG")} صف</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" ref={columnDropdownRef}>
                  <button onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-all shadow-sm">
                    <Settings2 size={14} /> الأعمدة
                  </button>
                  <AnimatePresence>
                    {columnVisibilityOpen && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-zinc-200 bg-white shadow-xl p-3 max-h-[400px] overflow-y-auto">
                        <div className="text-[10px] font-black text-zinc-400 px-2 py-1 mb-2 border-b border-zinc-100 pb-2">الأعمدة</div>
                        {allColumns.map((col, idx) => (
                          <div key={col.id} className="flex items-center justify-between group px-2 py-1.5 rounded-xl hover:bg-zinc-50">
                            <button onClick={() => toggleColumnVisibility(col.id)} className="flex items-center gap-2.5 flex-1 text-right">
                              {columnVisibility[col.id] !== false ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} className="text-zinc-300" />}
                              <span className={`text-[12px] font-bold ${columnVisibility[col.id] !== false ? "text-zinc-800" : "text-zinc-400 line-through"}`}>{col.header}</span>
                            </button>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                              <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"><ArrowUp size={12} /></button>
                              <button onClick={() => moveColumn(col.id, 1)} disabled={idx === allColumns.length - 1} className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 disabled:opacity-30"><ArrowDown size={12} /></button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <DataGrid data={rows} virtualized={rows.length > 50}
              columns={visibleColumns.map((c) => ({
                id: c.id, header: c.header, width: Math.max(120, Math.min(200, 80 + c.header.length * 8)),
                sortable: true,
                headerClass: "text-right font-black text-[11px] text-zinc-500 uppercase tracking-wide bg-zinc-50/80 border-b border-zinc-200",
                cellClass: "text-right border-b border-zinc-100 py-3",
              }))} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-zinc-500">صف لكل صفحة:</span>
                  <select value={currentPageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))} className="text-[11px] font-bold border border-zinc-200 rounded-lg px-2 py-1 bg-white">
                    {PAGE_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30"><ChevronRight size={16} /></button>
                  <span className="text-[12px] font-bold text-zinc-700 px-2">{currentPage} / {totalPages}</span>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-30"><ChevronLeft size={16} /></button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 p-6">
            {chartData.length > 0 && xKey && yKey ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <RechartsLine data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={yKey} stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                  </RechartsLine>
                ) : (
                  <RechartsBar data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={yKey} fill="#059669" radius={[4, 4, 0, 0]} />
                  </RechartsBar>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400 text-[13px] font-bold">
                لا توجد بيانات كافية للرسم البياني
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print Modal */}
      <PrintPreviewModal open={printOpen} onClose={() => setPrintOpen(false)} title={`${sourceDef?.label || ''} - ${a(classificationId)}`}>
        <ReportPrintTemplate data={rows} columns={visibleColumns} title={`${sourceDef?.label || ''} - ${a(classificationId)}`} totals={columnTotals} />
      </PrintPreviewModal>
    </div>
  );
}
