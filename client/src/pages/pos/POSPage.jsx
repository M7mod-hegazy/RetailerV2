import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpDown,
  Banknote,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Gift,
  Image as ImageIcon,
  Layers,
  ListTodo,
  Minus,
  PackageCheck,
  PauseCircle,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  X,
  LogOut,
  TrendingUp,
  Clock,
  Filter,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import { InvoiceSaveSuccess } from "../../components/pos/InvoiceSaveSuccess";
import BarcodeListener from "../../components/pos/BarcodeListener";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";
import { LayoutGrid, List, Package } from "lucide-react";
import WarehouseStockMatrix from "../../components/pos/WarehouseStockMatrix";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import DataGrid from "../../components/ui/DataGrid";
import { usePageTour } from "../../hooks/usePageTour";
import { usePosStore } from "../../stores/posStore";
import { useAuthStore } from "../../stores/authStore";
import { useSound } from "../../hooks/useSound";

// --- Local Lookup Component ---
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function LookupList({ items, onPick, activeIndex, query, emptyLabel = "لا توجد نتائج" }) {
  if (!items.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md p-4 text-center text-[12px] font-bold text-slate-400 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[12px] border border-slate-100 bg-white/95 backdrop-blur-md shadow-[0_10px_40px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2.5 text-start transition-all ${activeIndex === i ? "bg-indigo-50/80" : "hover:bg-slate-50"}`}
          >
            <div className="flex items-center gap-2">
              {item.primary_image_url || item.image_url || item.image ? (
                <img src={resolveImageUrl(item.primary_image_url || item.image_url || item.image)} alt={item.name} className="w-8 h-8 rounded-md object-cover border border-slate-200" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><Package className="w-4 h-4 text-slate-300"/></div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[13px] font-black ${activeIndex === i ? "text-indigo-900" : "text-slate-800"}`}><Highlight text={item.name} query={query} /></span>
                <span className="font-mono text-[10px] text-slate-400 font-bold"><Highlight text={item.item_code || item.code || item.barcode || `#${item.id}`} query={query} /></span>
              </div>
            </div>
            <div className="flex flex-col items-end">
               {item.price_label && <span className="font-mono text-[12px] font-black text-slate-600">{item.price_label}</span>}
               {item.sub_label && <span className="text-[10px] font-bold text-slate-400">{item.sub_label}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ar-EG", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatArabicDate(date) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-arab", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatArabicDateTime(date) {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WALK_IN_CUSTOMER = { id: null, name: "زبون نقدي", phone: "", opening_balance: 0 };
const DEFAULT_WAREHOUSE = { id: "default", name: "المخزن الرئيسي" };

const PAYMENT_TYPES = [
  { type: "cash",          label: "نقدي",      Icon: Banknote  },
  { type: "bank_transfer", label: "بنك / فيزا", Icon: CreditCard },
  { type: "credit",        label: "آجل",        Icon: Wallet    },
  { type: "multi",         label: "متعدد",      Icon: Layers    },
];

const PAYMENT_STATUS_LABELS = {
  paid:    { label: "مدفوع",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial: { label: "جزئي",    cls: "bg-amber-50 text-amber-700 border-amber-200"    },
  unpaid:  { label: "آجل",     cls: "bg-rose-50 text-rose-700 border-rose-200"       },
  voided:  { label: "ملغي",    cls: "bg-slate-100 text-slate-500 border-slate-200"   },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ step, children, isActive }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {step && (
        <span className={`inline-flex h-[18px] w-[18px] items-center justify-center border text-[9px] font-black leading-none shrink-0 transition-all duration-150 ${
          isActive ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 text-zinc-500"
        }`}>
          {step}
        </span>
      )}
      <span className={`text-[10px] font-black uppercase tracking-[0.12em] leading-none transition-colors ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>{children}</span>
    </div>
  );
}



function SortTh({ label, sortKey, sortConfig, onSort, width, onResizeStart, resizableKey, className = "" }) {
  const active = sortConfig.key === sortKey;
  return (
    <th
      className={`relative select-none px-2 py-2 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors ${className}`}
      style={{ width: width ? `${width}px` : undefined, minWidth: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
    >
      <div className="inline-flex items-center gap-1 cursor-pointer" onClick={() => onSort && onSort(sortKey)}>
        {label}
        {onSort && (active
          ? sortConfig.dir === "asc" ? <ChevronUp className="h-3 w-3 text-slate-900" /> : <ChevronDown className="h-3 w-3 text-slate-900" />
          : <ArrowUpDown className="h-3 w-3 opacity-20" />)}
      </div>
      {resizableKey && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(e, resizableKey)}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-slate-400 z-10 transition-colors"
        />
      )}
    </th>
  );
}

// Custom navigation guard — works with BrowserRouter (no data router needed)
function useNavGuard(shouldBlock) {
  const [showModal, setShowModal] = useState(false);
  const pendingNavRef = useRef(null);
  const proceedingRef = useRef(false);

  useEffect(() => {
    if (!shouldBlock) return;

    const origPush    = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = (state, unused, url) => {
      if (proceedingRef.current) { origPush(state, unused, url); return; }
      const target = typeof url === "string" ? url : (url?.toString() ?? "");
      const current = window.location.pathname + window.location.search;
      if (target === current || target === window.location.href) { origPush(state, unused, url); return; }
      pendingNavRef.current = () => { origPush(state, unused, url); window.dispatchEvent(new PopStateEvent("popstate", { state })); };
      setShowModal(true);
    };

    window.history.replaceState = (state, unused, url) => {
      if (proceedingRef.current) { origReplace(state, unused, url); return; }
      origReplace(state, unused, url);
    };

    const handlePop = () => {
      if (proceedingRef.current) return;
      origPush(null, "", window.location.href); // push back current to cancel pop
      pendingNavRef.current = () => { window.history.go(-1); };
      setShowModal(true);
    };

    window.addEventListener("popstate", handlePop);

    return () => {
      window.history.pushState    = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("popstate", handlePop);
    };
  }, [shouldBlock]);

  function proceed() {
    setShowModal(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    if (nav) { proceedingRef.current = true; nav(); proceedingRef.current = false; }
  }

  function cancel() {
    setShowModal(false);
    pendingNavRef.current = null;
  }

  return { showModal, proceed, cancel };
}

function NavLockModal({ onProceed, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] rounded-md border border-slate-200 bg-white shadow-2xl" dir="rtl">
        <div className="border-b border-slate-100 bg-slate-950 px-6 py-4 rounded-t-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <p className="text-[14px] font-black text-white">تحذير — فاتورة جارية</p>
              <p className="text-[11px] text-slate-400 font-bold">لديك أصناف في السلة لم تحفظ بعد</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-[13px] font-bold text-slate-600 leading-relaxed">
            إذا غادرت الصفحة الآن ستفقد الفاتورة الحالية. هل تريد المتابعة؟
          </p>
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 rounded-sm border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-colors">
              البقاء في الصفحة
            </button>
            <button onClick={onProceed}
              className="flex-1 rounded-sm border border-rose-600 bg-rose-600 px-4 py-2.5 text-[13px] font-black text-white hover:bg-rose-700 transition-colors">
              <span className="flex items-center justify-center gap-2">
                <LogOut className="h-4 w-4" /> المغادرة والتخلي
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSPage() {
  usePageTour("pos_sales");
  const user = useAuthStore((state) => state.user);
  const { playBeep } = useSound();

  // POS store
  const lines             = usePosStore((s) => s.lines);
  const addLine           = usePosStore((s) => s.addLine);
  const updateLine        = usePosStore((s) => s.updateLine);
  const removeLine        = usePosStore((s) => s.removeLine);
  const customer          = usePosStore((s) => s.customer);
  const setCustomer       = usePosStore((s) => s.setCustomer);
  const discount          = usePosStore((s) => s.discount);
  const setDiscount       = usePosStore((s) => s.setDiscount);
  const promotionDiscount = usePosStore((s) => s.promotionDiscount);
  const appliedPromotions = usePosStore((s) => s.appliedPromotions);
  const paymentType       = usePosStore((s) => s.paymentType);
  const setPaymentType    = usePosStore((s) => s.setPaymentType);
  const getTotals         = usePosStore((s) => s.getTotals);
  const clear             = usePosStore((s) => s.clear);
  const heldInvoices      = usePosStore((s) => s.heldInvoices);
  const holdCurrentInvoice = usePosStore((s) => s.holdCurrentInvoice);
  const resumeHeldInvoice  = usePosStore((s) => s.resumeHeldInvoice);

  // UI state
  const [openShiftModal, setOpenShiftModal]   = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [customers, setCustomers]         = useState([]);
  const [items, setItems]                 = useState([]);
  const [warehouses, setWarehouses]       = useState([]);
  const [banks, setBanks]                 = useState([]);
  const [treasuries, setTreasuries]       = useState([]);
  const [units, setUnits]                 = useState([]);
  const [stockLevels, setStockLevels]     = useState({});
  const [storeSettings, setStoreSettings] = useState({ company_name: "المتجر", address: "" });
  const [printPreview, setPrintPreview] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [invoiceTick, setInvoiceTick] = useState(() => Date.now());
  const [invoiceSeq, setInvoiceSeq]   = useState(1);

  // Search state
  const [itemNameQuery, setItemNameQuery]     = useState("");
  const [itemCodeQuery, setItemCodeQuery]     = useState("");
  const [customerQuery, setCustomerQuery]     = useState("");
  const [activeLookupIndex, setActiveLookupIndex]     = useState(0);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [itemLookupOpen, setItemLookupOpen]       = useState(false);
  const [customerLookupOpen, setCustomerLookupOpen] = useState(false);

  // Detailed search
  const [detailedSearchOpen, setDetailedSearchOpen]   = useState(false);
  const [detailedSearchQuery, setDetailedSearchQuery] = useState("");
  const [detailedCategoryFilter, setDetailedCategoryFilter] = useState("all");
  const [detailedSortConfig, setDetailedSortConfig] = useState({ key: "name", dir: "asc" });
  const [detailedColWidths, setDetailedColWidths] = useState({
    image: 54, code: 100, name: 240, barcode: 130, category: 120, price: 100, stock: 80,
  });

  // Cart sorting & resizing
  const [cartSortConfig, setCartSortConfig] = useState({ key: null, dir: "asc" });
  const [cartColWidths, setCartColWidths] = useState({
    index: 36, code: 110, name: 220, unit: 70, qty: 72, price: 88, warehouse: 96, discount: 84, total: 96, actions: 44,
  });

  // Held invoices
  const [showHeldMenu, setShowHeldMenu] = useState(false);

  // Payment
  const [amountPaid, setAmountPaid]         = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [selectedBankId, setSelectedBankId]         = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [activeMultiPayments, setActiveMultiPayments] = useState([]);
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [multiCash, setMultiCash] = useState("");
  const [multiBank, setMultiBank] = useState("");
  const [multiCredit, setMultiCredit] = useState("");

  // Modals
  const [profitModalOpen, setProfitModalOpen]           = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen]     = useState(false);
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "", phone2: "", address: "", notes: "" });
  const [supervisorOverrideOpen, setSupervisorOverrideOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);

  // Today's receipts
  const [receiptsOpen, setReceiptsOpen]       = useState(false);
  const [receipts, setReceipts]               = useState([]);
  const [receiptSummary, setReceiptSummary]   = useState({ count: 0, total: 0 });
  const [receiptDateFrom, setReceiptDateFrom] = useState(toDateInput());
  const [receiptDateTo, setReceiptDateTo]     = useState(toDateInput());
  const [receiptSort, setReceiptSort]         = useState("created_at");
  const [receiptDir, setReceiptDir]           = useState("desc");
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  // Staging area
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({ warehouseId: "", quantity: "1", unitPrice: "", lineDiscount: "0" });
  const [activeEntryField, setActiveEntryField] = useState(null);

  // Save feedback
  const [saveMessage, setSaveMessage]   = useState("");
  const [isSaving, setIsSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess]   = useState(null);
  const [lastSavedInvoice, setLastSavedInvoice] = useState(null);
  const [pendingPrint, setPendingPrint] = useState(false);

  // Offline
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Refs
  const codeInputRef     = useRef(null);
  const customerInputRef = useRef(null);
  const saveInvoiceRef   = useRef(null);
  const qtyInputRef      = useRef(null);
  const priceInputRef    = useRef(null);
  const discInputRef     = useRef(null);
  const detailedResizingCol = useRef(null);
  const detailedStartX      = useRef(0);
  const detailedStartWidth  = useRef(0);
  const cartResizingCol  = useRef(null);
  const cartStartX       = useRef(0);
  const cartStartWidth   = useRef(0);

  const entryFieldRefs = [codeInputRef, qtyInputRef, priceInputRef, discInputRef];

  // Page navigation guard (works with BrowserRouter / HashRouter)
  const { showModal: navLockVisible, proceed: navProceed, cancel: navCancel } = useNavGuard(lines.length > 0);

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (lines.length > 0) {
      const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [lines.length]);

  useEffect(() => {
    const t = window.setInterval(() => setInvoiceTick(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);


  useEffect(() => { setCustomerQuery(customer?.name || ""); }, [customer]);

  useEffect(() => {
    api.get("/api/customers").then((r) => setCustomers(r.data.data || [])).catch(() => {});
    api.get("/api/items").then((r) => setItems(r.data.data || [])).catch(() => {});
    api.get("/api/warehouses").then((r) => setWarehouses(r.data.data || [])).catch(() => {});
    api.get("/api/banks").then((r) => setBanks(r.data.data || [])).catch(() => {});
    api.get("/api/treasuries").then((r) => setTreasuries(r.data.data || [])).catch(() => {});
    api.get("/api/units").then((r) => setUnits(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then((r) => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = {};
        grouped[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
    api.get("/api/settings").then((r) => setStoreSettings(r.data.data || {})).catch(() => {});
    api.get("/api/payment-methods").then((r) => setPaymentMethods(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!warehouses.length) return;
    setStaging((s) => ({ ...s, warehouseId: s.warehouseId || String(warehouses[0].id) }));
  }, [warehouses]);

  useEffect(() => {
    if (!selectedItem) return;
    setStaging((s) => ({
      ...s,
      unitPrice: String(Number(selectedItem.sale_price || selectedItem.price || 0)),
      warehouseId: s.warehouseId || String(warehouses[0]?.id || ""),
      quantity: "1",
      lineDiscount: "0",
    }));
  }, [selectedItem, warehouses]);

  useEffect(() => {
    const handler = (e) => { if (e.detail) handleSelectItem(e.detail); };
    window.addEventListener("pos-barcode-scanned", handler);
    return () => window.removeEventListener("pos-barcode-scanned", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingPrint && lastSavedInvoice) {
      const t = setTimeout(() => { window.print(); setPendingPrint(false); }, 100);
      return () => clearTimeout(t);
    }
  }, [pendingPrint, lastSavedInvoice]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "F2") { e.preventDefault(); codeInputRef.current?.focus(); codeInputRef.current?.select(); }
      if (e.key === "F1") { e.preventDefault(); customerInputRef.current?.focus(); setCustomerLookupOpen(true); }
      if (e.key === "F9")  { e.preventDefault(); saveInvoiceRef.current?.(false); }
      if (e.key === "F12") { e.preventDefault(); saveInvoiceRef.current?.(true); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Column resize handlers
  const onDetailedResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    detailedResizingCol.current = key;
    detailedStartX.current = e.clientX;
    detailedStartWidth.current = detailedColWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (mv) => {
      if (!detailedResizingCol.current) return;
      const diff = detailedStartX.current - mv.clientX;
      const w = Math.max(detailedStartWidth.current + diff, 50);
      setDetailedColWidths(prev => ({ ...prev, [detailedResizingCol.current]: w }));
    };
    const onMouseUp = () => {
      detailedResizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onCartResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    cartResizingCol.current = key;
    cartStartX.current = e.clientX;
    cartStartWidth.current = cartColWidths[key] || 100;
    document.body.classList.add("cursor-col-resize", "select-none");
    const onMouseMove = (mv) => {
      if (!cartResizingCol.current) return;
      const diff = cartStartX.current - mv.clientX;
      const w = Math.max(cartStartWidth.current + diff, 36);
      setCartColWidths(prev => ({ ...prev, [cartResizingCol.current]: w }));
    };
    const onMouseUp = () => {
      cartResizingCol.current = null;
      document.body.classList.remove("cursor-col-resize", "select-none");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toggleDetailedSort = (key) => setDetailedSortConfig(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const toggleCartSort     = (key) => setCartSortConfig(p => p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });

  // ── Derived ──────────────────────────────────────────────────────────────────

  const totals             = getTotals();
  const paidAmountNumber   = Number(amountPaid || 0);
  const creditRemaining    = Math.max(0, totals.total - Math.max(0, paidAmountNumber));
  const changeAmount       = Math.max(0, Number(amountReceived || 0) - totals.total);

  const invoiceNumber = useMemo(() => {
    const stamp = new Date(invoiceTick);
    const yy = String(stamp.getFullYear()).slice(-2);
    const mm = String(stamp.getMonth() + 1).padStart(2, "0");
    const dd = String(stamp.getDate()).padStart(2, "0");
    return `INV-${yy}${mm}${dd}-${String(invoiceSeq).padStart(4, "0")}`;
  }, [invoiceSeq, invoiceTick]);

  const customerResults = useMemo(() => {
    if (!customerLookupOpen) return [];
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.phone || "").includes(q))
      : customers.slice(0, 8);
    return list.slice(0, 8).map((c) => ({
      ...c,
      stock_label: c.phone || "بدون هاتف",
      price_label: c.opening_balance ? `رصيد ${formatMoney(c.opening_balance)}` : "",
    }));
  }, [customerLookupOpen, customerQuery, customers]);

  const itemResults = useMemo(() => {
    const q = (itemNameQuery || itemCodeQuery).trim();
    const source = q
      ? fuzzyFilterRows(items, q, ["name", "code", "item_code", "barcode"])
      : items.slice(0, 8);
    return source.slice(0, 8).map((item) => ({
      ...item,
      stock_label: `\u0645\u062e\u0632\u0648\u0646: ${Number(item.stock_quantity || item.stock || 0)}`,
      price_label: formatMoney(item.sale_price || item.price || 0),
    }));
  }, [itemNameQuery, itemCodeQuery, items]);

  const detailedItemResults = useMemo(() => {
    const q = (detailedSearchQuery || itemNameQuery || itemCodeQuery).trim();
    let source = q
      ? fuzzyFilterRows(items, q, ["name", "code", "barcode", "category_name"])
      : items;
    if (detailedCategoryFilter !== "all")
      source = source.filter((item) => String(item.category_name || "غير مصنف") === detailedCategoryFilter);
    if (detailedSortConfig.key) {

      source = [...source].sort((a, b) => {
        let valA, valB;
        if (detailedSortConfig.key === "price") { valA = Number(a.sale_price || 0); valB = Number(b.sale_price || 0); }
        else if (detailedSortConfig.key === "stock") { valA = Number(a.stock_quantity || 0); valB = Number(b.stock_quantity || 0); }
        else { valA = String(a[detailedSortConfig.key] || ""); valB = String(b[detailedSortConfig.key] || ""); }
        if (typeof valA === "number") return detailedSortConfig.dir === "asc" ? valA - valB : valB - valA;
        return detailedSortConfig.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
      });
    }
    return source.slice(0, 120);
  }, [detailedSearchQuery, itemNameQuery, itemCodeQuery, items, detailedCategoryFilter, detailedSortConfig]);

  const detailedCategories = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => String(item.category_name || "غير مصنف"))));
    return ["all", ...names];
  }, [items]);

  const sortedLines = useMemo(() => {
    if (!cartSortConfig.key) return lines;
    return [...lines].sort((a, b) => {
      let valA, valB;
      if (cartSortConfig.key === "qty")      { valA = Number(a.quantity || 0);  valB = Number(b.quantity || 0); }
      else if (cartSortConfig.key === "price") { valA = Number(a.unit_price || 0); valB = Number(b.unit_price || 0); }
      else if (cartSortConfig.key === "discount") { valA = Number(a.line_discount || 0); valB = Number(b.line_discount || 0); }
      else if (cartSortConfig.key === "total") {
        valA = Number(a.quantity || 0) * Number(a.unit_price || 0) - Number(a.line_discount || 0);
        valB = Number(b.quantity || 0) * Number(b.unit_price || 0) - Number(b.line_discount || 0);
      }
      else if (cartSortConfig.key === "code") { valA = String(a.code || ""); valB = String(b.code || ""); }
      else if (cartSortConfig.key === "name") { valA = String(a.item_name || ""); valB = String(b.item_name || ""); }
      else { valA = String(a[cartSortConfig.key] || ""); valB = String(b[cartSortConfig.key] || ""); }
      if (typeof valA === "number") return cartSortConfig.dir === "asc" ? valA - valB : valB - valA;
      return cartSortConfig.dir === "asc" ? valA.localeCompare(valB, "ar") : -valA.localeCompare(valB, "ar");
    });
  }, [lines, cartSortConfig]);

  const selectedCustomer   = customer || WALK_IN_CUSTOMER;
  const hasCustomerBalance = Number(selectedCustomer.opening_balance || 0) > 0;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getItemImage(item) {
    if (item?.primary_image_url) return item.primary_image_url;
    if (Array.isArray(item?.image_urls) && item.image_urls.length > 0) return item.image_urls[0];
    return "";
  }

  function resetStaging() {
    setItemNameQuery("");
    setItemCodeQuery("");
    setSelectedItem(null);
    setItemLookupOpen(false);
    setStaging((s) => ({ ...s, quantity: "1", unitPrice: "", lineDiscount: "0" }));
    window.requestAnimationFrame(() => codeInputRef.current?.focus());
  }

  function resetPaymentFields() {
    setAmountPaid("");
    setAmountReceived("");
    setSelectedBankId("");
    setSelectedTreasuryId("");
    setActiveMultiPayments([]);
  }

  function handleSelectItem(item) {
    setSelectedItem(item);
    setItemNameQuery(item.name || "");
    setItemCodeQuery(item.code || item.item_code || item.barcode || "");
    setItemLookupOpen(false);
    setDetailedSearchOpen(false);
    // Focus next field depending on view mode
    if (viewMode === "list") {
      window.requestAnimationFrame(() => { listWhRef.current?.focus(); });
    } else {
      window.requestAnimationFrame(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); });
    }
  }

  function handleCodeFieldKeyDown(e) {
    if (!itemLookupOpen && itemResults.length && e.key === "ArrowDown") { e.preventDefault(); setItemLookupOpen(true); return; }
    if (itemLookupOpen && itemResults.length && e.key === "ArrowDown")  { e.preventDefault(); setActiveLookupIndex((v) => Math.min(v + 1, itemResults.length - 1)); return; }
    if (itemLookupOpen && itemResults.length && e.key === "ArrowUp")    { e.preventDefault(); setActiveLookupIndex((v) => Math.max(v - 1, 0)); return; }
    if (itemLookupOpen && itemResults.length && e.key === "Enter")      { e.preventDefault(); handleSelectItem(itemResults[activeLookupIndex] || itemResults[0]); return; }
    if (e.key === "Escape") setItemLookupOpen(false);
  }

  function handlePickCustomer(c) {
    setCustomer(c);
    setCustomerQuery(c.name || "");
    setCustomerLookupOpen(false);
    if (!customer?.id) setPaymentType("cash");
  }

  function handleCustomerKeyDown(e) {
    if (!customerLookupOpen && e.key === "ArrowDown") { setCustomerLookupOpen(true); return; }
    if (customerLookupOpen && customerResults.length && e.key === "ArrowDown") { e.preventDefault(); setActiveCustomerIndex((v) => Math.min(v + 1, customerResults.length - 1)); return; }
    if (customerLookupOpen && customerResults.length && e.key === "ArrowUp")   { e.preventDefault(); setActiveCustomerIndex((v) => Math.max(v - 1, 0)); return; }
    if (customerLookupOpen && customerResults.length && e.key === "Enter") {
      e.preventDefault();
      const next = customerResults[activeCustomerIndex] || customerResults[0];
      setCustomer(next); setCustomerQuery(next.name); setCustomerLookupOpen(false); customerInputRef.current?.blur();
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setCustomer(null); setCustomerQuery(""); setCustomerLookupOpen(false); }
  }

  function handleEntryFieldKeyDown(e, fieldIndex) {
    if (itemLookupOpen && fieldIndex === 0) { handleCodeFieldKeyDown(e); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        const prev = fieldIndex - 1;
        if (prev >= 0) { entryFieldRefs[prev].current?.focus(); entryFieldRefs[prev].current?.select(); }
        return;
      }
      if (fieldIndex === 3) { if (selectedItem) addCurrentLine(); return; }
      if (fieldIndex === 0 && !selectedItem) return;
      const next = fieldIndex + 1;
      if (next < entryFieldRefs.length) { entryFieldRefs[next].current?.focus(); entryFieldRefs[next].current?.select(); }
      return;
    }
    if (e.shiftKey && e.key === "Tab") {
      e.preventDefault();
      const prev = fieldIndex - 1;
      if (prev >= 0) { entryFieldRefs[prev].current?.focus(); entryFieldRefs[prev].current?.select(); }
      return;
    }
    if (e.key === "Escape") resetStaging();
  }

  function addCurrentLine() {
    if (!selectedItem) return;
    const warehouse   = warehouses.find((w) => String(w.id) === String(staging.warehouseId)) || DEFAULT_WAREHOUSE;
    const quantity    = Math.max(1, Number(staging.quantity || 1));
    const unitPrice   = Math.max(0, Number(staging.unitPrice || 0));
    const lineDiscount = Math.max(0, Number(staging.lineDiscount || 0));
    const stockValue  = Number(selectedItem.stock_quantity || selectedItem.stock || 0);
    const purchasePrice = Number(selectedItem.purchase_price || 0);

    if (unitPrice <= 0)           { setSaveMessage("لا يمكن إضافة صنف بسعر صفر."); setTimeout(() => setSaveMessage(""), 3000); return; }
    if (quantity > stockValue)    { setSaveMessage(`المخزون غير كافٍ (المتاح: ${stockValue})`); setTimeout(() => setSaveMessage(""), 3000); return; }
    if (unitPrice < purchasePrice) {
      if (!window.confirm(`السعر أقل من الشراء (${formatMoney(purchasePrice)}). هل تريد المتابعة؟`)) return;
    }

    addLine({
      id: selectedItem.id,
      name: selectedItem.name,
      code: selectedItem.code || selectedItem.item_code || "",
      barcode: selectedItem.barcode || "",
      sale_price: unitPrice,
      category_name: selectedItem.category_name || "غير مصنف",
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      stock_quantity: stockValue,
      unit_name: selectedItem.unit_name || "قطعة",
      primary_image_url: getItemImage(selectedItem) || null,
      quantity,
      line_discount: lineDiscount,
    });
    playBeep();
    resetStaging();
  }

  // Today's receipts
  async function loadReceipts() {
    setReceiptsLoading(true);
    try {
      const r = await api.get(`/api/invoices?date_from=${receiptDateFrom}&date_to=${receiptDateTo}&sort=${receiptSort}&dir=${receiptDir}`);
      setReceipts(r.data.data || []);
      setReceiptSummary(r.data.summary || { count: 0, total: 0 });
    } catch { /* silent */ }
    finally { setReceiptsLoading(false); }
  }

  useEffect(() => {
    if (receiptsOpen) loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptsOpen, receiptDateFrom, receiptDateTo, receiptSort, receiptDir]);

  // ── Save invoice ──────────────────────────────────────────────────────────────

  async function saveInvoice(printAfter, opts = {}) {
    if (!lines.length || isSaving) return;
    if (lines.some((l) => Number(l.unit_price || 0) <= 0)) {
      setSaveMessage("يوجد صنف بسعر غير صالح."); setTimeout(() => setSaveMessage(""), 5000); return;
    }
    if (lines.some((l) => Number(l.quantity || 0) > Number(l.stock_quantity || 0))) {
      setSaveMessage("لا يمكن الحفظ: يوجد صنف يتجاوز المخزون."); setTimeout(() => setSaveMessage(""), 5000); return;
    }
    if (paymentType === "credit" && !customer?.id) {
      setCustomerCreateOpen(true); setSaveMessage("البيع الآجل يتطلب تحديد عميل."); return;
    }
    if (paymentType === "bank_transfer" && !selectedBankId && banks.length > 0) {
      setSaveMessage("يرجى اختيار البنك."); setTimeout(() => setSaveMessage(""), 4000); return;
    }
    if (paymentType === "multi" && Math.abs(totals.total - activeMultiPayments.reduce((acc, p) => acc + Number(p.amount), 0)) > 0.005) {
      setSaveMessage(`مجموع الدفع المتعدد لا يساوي الإجمالي (${formatMoney(totals.total)}).`);
      setTimeout(() => setSaveMessage(""), 5000); return;
    }

    setIsSaving(true); setSaveMessage("");
    try {
      const hasBelowCost = lines.some((l) => {
        const item = items.find((e) => e.id === l.item_id);
        return Number(l.unit_price || 0) < Number(item?.purchase_price || 0);
      });
      const payload = {
        customer_id: customer?.id || null,
        lines: lines.map((l) => ({
          item_id:      l.item_id,
          quantity:     Number(l.quantity || 0),
          unit_price:   Number(l.unit_price || 0),
          warehouse_id: l.warehouse_id || null,
          discount:     Number(l.line_discount || 0),
        })),
        discount,
        promotion_discount: promotionDiscount,
        payment_type: paymentType,
        amount_paid:  paymentType === "credit" ? Math.max(0, paidAmountNumber) : totals.total,
        bank_id:      selectedBankId  ? Number(selectedBankId)  : null,
        treasury_id:  selectedTreasuryId ? Number(selectedTreasuryId) : null,
        payments:     paymentType === "multi" ? activeMultiPayments.map(p => ({ method_id: p.method_id, amount: Number(p.amount) })) : [],
        allow_loss_sale:    hasBelowCost || Boolean(opts.allowLoss),
        supervisor_override: Boolean(opts.supervisorOverride),
      };
      const response = await api.post("/api/invoices", payload);
      const savedInvoiceNo = response.data?.data?.invoice_no || invoiceNumber;
      const receiptSnap = {
        invoice_no: savedInvoiceNo, date: new Date(), lines: [...lines],
        customer: customer ? { ...customer } : null, totals: { ...totals },
        discount, promotionDiscount, appliedPromotions: [...(appliedPromotions || [])],
        paymentType, amountReceived: Number(amountReceived || 0),
        cashier: user?.name || "الكاشير",
        storeName: storeSettings.company_name || "المتجر",
        storeAddress: storeSettings.address || "",
      };
      setLastSavedInvoice(receiptSnap);
      setSaveSuccess({ invoiceNumber: savedInvoiceNo, total: formatMoney(totals.total) });
      clear(); resetPaymentFields(); resetStaging(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1);
      if (printAfter) setPendingPrint(true);
    } catch (error) {
      if (error.response?.status === 403 && error.response?.data?.code === "DISCOUNT_LIMIT_EXCEEDED") {
        setPendingSave({ printAfter, opts }); setSupervisorOverrideOpen(true);
      } else {
        setSaveMessage(error.response?.data?.message || "فشل حفظ الفاتورة.");
        setTimeout(() => setSaveMessage(""), 6000);
      }
    } finally { setIsSaving(false); }
  }

  saveInvoiceRef.current = saveInvoice;

  async function confirmSupervisorOverride() {
    if (!pendingSave) return;
    setSupervisorOverrideOpen(false);
    const { printAfter, opts } = pendingSave;
    setPendingSave(null);
    await saveInvoice(printAfter, { ...opts, supervisorOverride: true });
  }

  async function createQuickCustomer() {
    if (!customerDraft.name.trim() || !customerDraft.phone.trim()) {
      setSaveMessage("أدخل اسم العميل ورقم هاتفه."); return;
    }
    try {
      const response = await api.post("/api/customers", {
        name:    customerDraft.name.trim(),
        phone:   `${customerDraft.phone.trim()}${customerDraft.phone2.trim() ? ` | ${customerDraft.phone2.trim()}` : ""}`,
        notes:   customerDraft.notes.trim() || null,
        address: customerDraft.address.trim() || null,
      });
      const newCustomer = response.data?.data;
      if (newCustomer) { setCustomers((prev) => [newCustomer, ...prev]); setCustomer(newCustomer); setCustomerQuery(newCustomer.name); }
      setCustomerCreateOpen(false);
      setCustomerDraft({ name: "", phone: "", phone2: "", address: "", notes: "" });
      setSaveMessage("");
    } catch (error) { setSaveMessage(error.response?.data?.message || "تعذر إنشاء العميل."); }
  }

  
  function handleGridItemClick(item) {
    const warehouse = warehouses.length ? warehouses[0] : { id: "default", name: "المخزن الرئيسي" };
    const stockValue = Number(item.stock_quantity || item.stock || 0);
    const salePrice = Number(item.sale_price || item.price || 0);

    if (salePrice <= 0) { setSaveMessage("لا يمكن إضافة صنف بسعر صفر."); setTimeout(() => setSaveMessage(""), 3000); return; }
    if (1 > stockValue) { setSaveMessage(`المخزون غير كافٍ (المتاح: ${stockValue})`); setTimeout(() => setSaveMessage(""), 3000); return; }

    addLine({
      id: item.id,
      name: item.name,
      code: item.code || item.item_code || "",
      barcode: item.barcode || "",
      sale_price: salePrice,
      category_name: item.category_name || "غير مصنف",
      warehouse_id: warehouse.id,
      warehouse_name: warehouse.name,
      stock_quantity: stockValue,
      unit_name: item.unit_name || "قطعة",
      primary_image_url: getItemImage(item) || null,
      quantity: 1,
      line_discount: 0,
    });
    if (typeof playBeep === 'function') playBeep();
  }

  // ── Render ────────────────────────────────────────────────────────────────────


  const multiTotal = activeMultiPayments.reduce((acc, p) => acc + Number(p.amount), 0);

  // ── List-view helpers ────────────────────────────────────────────────────────
  const listItemInputRef = useRef(null);
  const listQtyRef       = useRef(null);
  const listPriceRef     = useRef(null);
  const listDiscRef      = useRef(null);
  const listWhRef        = useRef(null);
  const listUnitRef      = useRef(null);
  const listAddBtnRef    = useRef(null);

  function handleListFieldKeyDown(e, nextRef, prevRef) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) { prevRef?.current?.focus(); prevRef?.current?.select?.(); }
      else { nextRef?.current?.focus(); nextRef?.current?.select?.(); }
    }
  }

  const [listImageModal, setListImageModal] = useState(false);
  const [listImageUrl, setListImageUrl]     = useState("");

  if (viewMode === "list") {
    return (
      <div className="flex h-screen flex-col bg-slate-50 font-sans overflow-hidden" dir="rtl">
        <BarcodeListener />
        {navLockVisible && <NavLockModal onProceed={navProceed} onCancel={navCancel} />}
        {isOffline && (
          <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-[12px] font-black tracking-wide text-white shrink-0 z-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            لا يوجد اتصال بالشبكة — سيتم التزامن تلقائياً عند الاتصال
          </div>
        )}

        {/* Header like purchases/new */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6 z-40">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-[14px] font-black text-slate-800">فاتورة مبيعات جديدة</h1>
              <span className="text-[10px] font-bold text-slate-400">نقطة البيع - القائمة</span>
            </div>
            <div className="flex shrink-0 bg-slate-100 rounded-md p-1 border border-slate-200 mr-4">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-sm transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                title="عرض الشبكة"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-sm transition-all ${viewMode === "list" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                title="عرض القائمة"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setLastSavedInvoice(null); setPrintPreview(true); }}
              disabled={!lines.length}
              className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <Printer className="h-4 w-4" /> طباعة ومراجعة المستند
            </button>
            <button
              onClick={() => saveInvoice(false)}
              disabled={isSaving || !lines.length}
              className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all"
            >
              {isSaving ? "جاري الحفظ..." : "حفظ الفاتورة (F9)"}
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
          
          {/* Right Sidebar (Customer, Summary, Payment) */}
          <aside className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">العميل</h3>
                {customer && customer.id && (
                  <button
                    onClick={() => { setCustomer(null); setCustomerQuery(""); setPaymentType("cash"); }}
                    title="إلغاء تحديد العميل"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="relative">
                <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={customerInputRef}
                  type="text"
                  value={customerQuery}
                  placeholder={customer?.id ? customer.name : "زبون نقدي — ابحث لتغيير..."}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustomerLookupOpen(true); if (!e.target.value) { setCustomer(null); setPaymentType("cash"); } }}
                  onFocus={() => { if (!customer?.id) setCustomerQuery(""); setCustomerLookupOpen(true); }}
                  onBlur={() => { setTimeout(() => { setCustomerLookupOpen(false); if (!customer?.id) setCustomerQuery(""); }, 200); }}
                  onKeyDown={handleCustomerKeyDown}
                  className="w-full rounded-sm border border-slate-300 bg-white py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                />
                {customerLookupOpen && (
                  <LookupList
                    items={customerResults}
                    onPick={handlePickCustomer}
                    activeIndex={activeCustomerIndex}
                    query={customerQuery}
                    emptyLabel="لم يتم العثور على عميل"
                  />
                )}
              </div>
              {/* Show selected customer name badge */}
              {customer?.id && (
                <div className="mt-2 flex items-center gap-2 rounded-sm bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] font-black text-emerald-800 truncate">{customer.name}</span>
                  {customer.phone && <span className="text-[10px] text-emerald-600 mr-auto shrink-0">{customer.phone}</span>}
                </div>
              )}
            </div>

            {/* Invoice Summary */}
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 border-slate-100">ملخص الفاتورة</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-500">إجمالي الأصناف</span>
                  <span className="text-[12px] font-black text-slate-800">{lines.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-500">مجموع الكميات</span>
                  <span className="text-[12px] font-black text-slate-800">{lines.reduce((acc, l) => acc + Number(l.quantity), 0)}</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="mt-3 rounded-sm bg-slate-900 p-4 text-center text-white">
                  <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">إجمالي المستحق</div>
                  <div className="text-[26px] font-black tracking-tighter font-mono">
                    {totals.total.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] opacity-40">ج.م</div>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">طريقة الدفع</h3>
              <div className="space-y-2">
                {PAYMENT_TYPES.map(({ type, label, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && type !== "cash";
                  return (
                    <button
                      key={type}
                      onClick={() => !isDisabled && setPaymentType(type)}
                      disabled={isDisabled}
                      title={isDisabled ? "يجب اختيار عميل مسجل أولاً" : undefined}
                      className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all ${
                        paymentType === type
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
                          : isDisabled
                            ? "border-slate-200 opacity-40 cursor-not-allowed bg-slate-50 text-slate-400"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-[12px] font-black">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Payment extra inputs */}
              {paymentType === "bank_transfer" && (
                <div className="mt-3 flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">اختر البنك</label>
                  <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full border border-blue-300 rounded-sm bg-blue-50 px-3 py-2 text-[12px] font-bold outline-none focus:border-blue-500">
                    <option value="">اختر البنك / البطاقة</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {paymentType === "credit" && customer && (
                <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 font-bold">
                  سيتم إضافة {formatMoney(totals.total)} لرصيد {customer.name}
                </div>
              )}
              {paymentType === "multi" && (
                <div className="mt-3 flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-2"><span className="text-[11px] font-black text-slate-500 w-10">نقدي:</span><input type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-slate-300 px-2 py-1 text-[12px] font-black outline-none focus:border-emerald-500" /></div>
                  <div className="flex items-center gap-2"><span className="text-[11px] font-black text-slate-500 w-10">بنكي:</span><input type="number" min="0" value={multiBank} onChange={(e) => setMultiBank(e.target.value)} placeholder="0.00" className="w-20 rounded-sm border border-slate-300 px-2 py-1 text-[12px] font-black outline-none focus:border-emerald-500" /><select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="flex-1 rounded-sm border border-slate-300 px-2 py-1 text-[11px] outline-none"><option value="">بنك</option>{banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                  <div className="flex items-center gap-2"><span className="text-[11px] font-black text-slate-500 w-10">آجل:</span><input type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-amber-300 px-2 py-1 text-[12px] font-black text-amber-900 outline-none focus:border-amber-500 bg-amber-50" /></div>
                  <div className={`text-center text-[11px] font-black rounded-sm py-1 ${Math.abs((Number(multiCash)||0)+(Number(multiBank)||0)+(Number(multiCredit)||0)-totals.total)<0.01?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700"}`}>
                    المُدخل: {formatMoney((Number(multiCash)||0)+(Number(multiBank)||0)+(Number(multiCredit)||0))} / {formatMoney(totals.total)}
                  </div>
                </div>
              )}
            </div>

            {/* Customer detail when selected */}
            {customer && customer.id && (
              <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-[14px] font-black">{customer.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800 truncate">{customer.name}</p>
                    {customer.phone && <p className="text-[11px] text-slate-500 mt-0.5">{customer.phone}</p>}
                    <div className="mt-2 flex items-center justify-between rounded-sm bg-slate-50 border border-slate-200 px-3 py-1.5">
                      <span className="text-[10px] font-bold text-slate-500">الرصيد الحالي</span>
                      <span className={`text-[13px] font-black font-mono ${Number(customer.opening_balance) > 0 ? "text-rose-600" : "text-slate-800"}`}>{Number(customer.opening_balance || 0).toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>


          {/* Main Content (Entry & Grid) */}
          <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
            {/* Quick Entry Bar */}
            <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
              <div className="grid grid-cols-[3fr_80px_90px_80px_130px_100px_auto] gap-2 items-end">
                {/* Item search */}
                <div className="relative flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                  <div className="relative">
                    <SearchInput
                      ref={listItemInputRef}
                      value={itemNameQuery}
                      onChange={(val) => { setItemNameQuery(val); setItemLookupOpen(true); setSelectedItem(null); }}
                      onFocus={(e) => { setItemLookupOpen(true); e.target.select(); }}
                      onBlur={() => setTimeout(() => setItemLookupOpen(false), 200)}
                      placeholder="ابحث بالاسم، الباركود، أو الكود..."
                      onKeyDown={(e) => {
                         if (e.key === "Enter" && itemResults.length > 0) {
                            e.preventDefault();
                            handleSelectItem(itemResults[activeLookupIndex]);
                            setTimeout(() => listWhRef.current?.focus(), 50);
                         } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev < itemResults.length - 1 ? prev + 1 : prev));
                         } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setActiveLookupIndex(prev => (prev > 0 ? prev - 1 : 0));
                         }
                      }}
                    />
                    {itemLookupOpen && (
                      <LookupList
                        items={itemResults}
                        onPick={(item) => { handleSelectItem(item); }}
                        activeIndex={activeLookupIndex}
                        query={itemNameQuery}
                      />
                    )}
                  </div>
                </div>

                {/* Qty */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                  <input
                    ref={listQtyRef}
                    type="number"
                    min="0.001"
                    step="any"
                    value={staging.quantity}
                    onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listWhRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">السعر</label>
                  <input
                    ref={listPriceRef}
                    type="number"
                    step="any"
                    value={staging.unitPrice}
                    onChange={(e) => setStaging(s => ({ ...s, unitPrice: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listDiscRef, listQtyRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Discount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">خصم</label>
                  <input
                    ref={listDiscRef}
                    type="number"
                    min="0"
                    step="any"
                    value={staging.lineDiscount}
                    onChange={(e) => setStaging(s => ({ ...s, lineDiscount: e.target.value }))}
                    onFocus={e => e.target.select()}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listAddBtnRef, listPriceRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                  />
                </div>

                {/* Warehouse */}
                <div className="flex flex-col gap-1 relative">
                  <label className="text-[11px] font-bold text-slate-600 truncate">الرصيد / المخزن</label>
                  <select
                    ref={listWhRef}
                    value={staging.warehouseId}
                    onChange={(e) => setStaging(s => ({ ...s, warehouseId: e.target.value }))}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listQtyRef, listItemInputRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-1 px-2 text-[11px] font-bold text-slate-800 outline-none focus:border-slate-800"
                  >
                    {warehouses.map(w => {
                      const qty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : "";
                      return <option key={w.id} value={w.id}>{w.name}{selectedItem && qty !== "" ? ` (${qty})` : ""}</option>;
                    })}
                  </select>
                </div>

                {/* Unit */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                  <select
                    ref={listUnitRef}
                    value={staging.unitId || ""}
                    onChange={(e) => setStaging(s => ({ ...s, unitId: e.target.value }))}
                    onKeyDown={(e) => handleListFieldKeyDown(e, listPriceRef, listWhRef)}
                    className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-1 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                  >
                    <option value="">أساسية</option>
                    {(units || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                {/* Add */}
                <button
                  ref={listAddBtnRef}
                  onClick={addCurrentLine}
                  disabled={!selectedItem}
                  onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addCurrentLine(); } }}
                  className="flex h-[37px] items-center justify-center gap-2 rounded-sm bg-slate-800 px-4 text-[12px] font-bold text-white hover:bg-slate-700 disabled:opacity-40 self-end transition-all"
                >
                  <Plus className="h-4 w-4" /> إضافة
                </button>
              </div>
            </section>

            {/* Lines DataGrid */}
            <DataGrid
              data={lines}
              rowKey={(row, i) => `${row.item_id}-${i}`}
              emptyMessage="لا يوجد أصناف في الفاتورة بعد"
              emptyIcon={<ShoppingCart className="h-12 w-12 mb-2" />}
              className="border-0"
              containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent rounded-md border border-slate-300 min-h-0"
              columns={[
                {
                  id: "index", header: "#", width: 40, sortable: false,
                  headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100",
                  render: (_, i) => i + 1
                },
                {
                  id: "name", header: "البيان", width: 240, sortable: true,
                  cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                  render: (l) => {
                    const item = items.find(it => it.id === l.item_id);
                    const imgUrl = item?.primary_image_url || item?.image_url || item?.image || l.primary_image_url;
                    const resolved = imgUrl ? resolveImageUrl(imgUrl) : null;
                    return (
                      <div className="flex items-center gap-2 py-1">
                        {resolved ? (
                          <button onClick={() => { setListImageUrl(resolved); setListImageModal(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                            <img src={resolved} alt={l.item_name} className="w-8 h-8 object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Search className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                        )}
                        <span className="truncate">{l.item_name}</span>
                      </div>
                    );
                  }
                },
                {
                  id: "quantity", header: "الكمية", width: 80, sortable: true,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l, i) => (
                    <input type="number" min="0.001" step="any" value={l.quantity}
                      onChange={(e) => updateLine(l.item_id, { quantity: Number(e.target.value) || 1 })}
                      className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:bg-indigo-50/50 transition-colors" />
                  )
                },
                {
                  id: "unitPrice", header: "السعر", width: 100, sortable: true,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l, i) => (
                    <input type="number" step="any" value={l.unit_price}
                      onChange={(e) => updateLine(l.item_id, { unit_price: Number(e.target.value) || 0 })}
                      className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:bg-indigo-50/50 transition-colors" />
                  )
                },
                {
                  id: "lineDiscount", header: "خصم", width: 80, sortable: false,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l, i) => (
                    <input type="number" min="0" step="any" value={l.line_discount || 0}
                      onChange={(e) => updateLine(l.item_id, { line_discount: Number(e.target.value) || 0 })}
                      className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:bg-amber-50/50 transition-colors" />
                  )
                },
                {
                  id: "warehouseId", header: "المخزن", width: 120, sortable: false,
                  headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                  render: (l, i) => (
                    <select value={l.warehouse_id || staging.warehouseId}
                      onChange={(e) => updateLine(l.item_id, { warehouse_id: e.target.value })}
                      className="w-full h-[40px] text-[11px] font-bold bg-transparent outline-none border-0 ring-0 text-slate-600 appearance-none text-center focus:bg-slate-50 truncate">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )
                },
                {
                  id: "total", header: "الإجمالي", width: 110, sortable: true,
                  headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/50 border-l border-slate-100",
                  render: (l) => formatMoney(l.quantity * l.unit_price - (l.line_discount || 0))
                },
                {
                  id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 text-center",
                  render: (row) => (
                    <button onClick={() => removeLine(row.item_id)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )
                }
              ]}
            />
          </div>
        </main>

        {/* Image Preview Modal */}
        <Modal open={listImageModal} onClose={() => setListImageModal(false)} title="معاينة صورة الصنف" size="md">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg">
            {listImageUrl
              ? <img src={listImageUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded-md shadow-sm border border-slate-200 bg-white" />
              : <div className="flex flex-col items-center py-12 text-slate-400"><ImageIcon className="w-16 h-16 mb-4 opacity-50" /><p className="font-bold">الصورة غير متوفرة</p></div>
            }
          </div>
        </Modal>

        {/* Toast */}
        {saveMessage && (
          <div className="absolute left-1/2 top-4 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-[13px] text-rose-700 shadow-xl">
            {saveMessage}
          </div>
        )}
      </div>
    );
  }



  return (
    <div className="flex h-screen flex-col bg-slate-50 font-sans overflow-hidden" dir="rtl">
      <BarcodeListener />
      {navLockVisible && <NavLockModal onProceed={navProceed} onCancel={navCancel} />}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-center text-[12px] font-black tracking-wide text-white shrink-0 z-50">
          <AlertTriangle className="h-3.5 w-3.5" />
          لا يوجد اتصال بالشبكة — سيتم التزامن تلقائياً عند الاتصال
        </div>
      )}


      {/* Main content */}
      <div
        className="flex min-h-0 flex-1 transition-all flex-row relative"
      >
        {/* ── Left Column: Grid & Search (~65%) ── */}
        <div className="flex flex-col flex-[1.8] bg-slate-50 border-l border-slate-200 overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-3 shrink-0 bg-white border-b border-slate-200 p-4 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SearchInput
                  value={detailedSearchQuery}
                  onChange={(val) => setDetailedSearchQuery(val)}
                  placeholder="ابحث بالاسم، الكود، الباركود (عربي/إنجليزي)..."
                  className="w-full text-[13px] py-2"
                />
              </div>
              <div className="flex shrink-0 bg-slate-100 rounded-md p-1 border border-slate-200">
                <button 
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-sm transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                  title="عرض الشبكة"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-sm transition-all ${viewMode === "list" ? "bg-white shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
                  title="عرض القائمة"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setDetailedSearchQuery("")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 custom-scrollbar">
              {detailedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setDetailedCategoryFilter(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-black transition-all border ${detailedCategoryFilter === cat ? "bg-slate-900 border-slate-900 text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"}`}
                >
                  {cat === "all" ? "كل الفئات" : cat}
                </button>
              ))}
            </div>
          </div>


          {/* Main Body Toggle */}
          {viewMode === "grid" ? (
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

            {detailedItemResults.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 opacity-60">
                <Search className="h-16 w-16 mb-4 text-slate-300" />
                <p className="text-[14px] font-black tracking-widest">لا توجد أصناف مطابقة</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {detailedItemResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleGridItemClick(item)}
                    className="group relative flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1 transition-all text-right overflow-hidden"
                  >
                    <div className="w-full aspect-square rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
                      {getItemImage(item) ? (
                        <img src={getItemImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col w-full min-w-0">
                      <span className="text-[12px] font-black text-slate-800 truncate block leading-tight">{item.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono truncate">{item.barcode || item.code || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-auto pt-1 border-t border-slate-50">
                      <span className="text-[14px] font-black text-emerald-600 font-mono">{formatMoney(item.sale_price || item.price || 0)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${Number(item.stock_quantity || item.stock || 0) <= 0 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                        {Number(item.stock_quantity || item.stock || 0)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          ) : (
             <div className="flex-1 overflow-y-auto bg-white custom-scrollbar flex flex-col">
                <DataGrid
                  data={detailedItemResults}
                  sortConfig={detailedSortConfig}
                  onSort={(k) => setDetailedSortConfig({ key: k, dir: detailedSortConfig.key === k && detailedSortConfig.dir === "asc" ? "desc" : "asc" })}
                  colWidths={detailedColWidths}
                  onResizeColumn={(k, w) => setDetailedColWidths(p => ({...p, [k]: w}))}
                  columns={[
                    { key: "image", label: "صورة", width: detailedColWidths.image, render: (r) => (
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-slate-50 overflow-hidden">
                         {getItemImage(r) ? <img src={getItemImage(r)} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300"/>}
                      </div>
                    )},
                    { key: "code", label: "الكود", width: detailedColWidths.code, render: r => <span className="font-mono text-slate-500">{r.code}</span> },
                    { key: "name", label: "اسم الصنف", width: detailedColWidths.name, render: r => <span className="font-bold">{r.name}</span> },
                    { key: "price", label: "السعر", width: detailedColWidths.price, render: r => <span className="font-mono font-bold text-emerald-600">{formatMoney(r.sale_price || r.price)}</span> },
                    { key: "stock", label: "الرصيد", width: detailedColWidths.stock, render: r => <span className="font-mono">{r.stock_quantity || r.stock || 0}</span> },
                    { key: "actions", label: "", width: 60, render: r => (
                        <button onClick={() => handleGridItemClick(r)} className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Plus className="h-4 w-4"/></button>
                    )}
                  ]}
                />
             </div>
          )}
        </div>


        {/* ── Right Column: Fixed Invoice Panel (~35%) ── */}
        <div className="flex flex-col flex-1 max-w-[420px] min-w-[340px] bg-white shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-20">
          
          {/* Top Panel: Customer & Actions */}
          <div className="flex flex-col shrink-0 border-b border-slate-100 bg-slate-50 p-3 gap-2.5">
            {/* Meta Row */}
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span className="font-mono bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">{invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { clear(); resetPaymentFields(); resetStaging(); setPaymentType("cash"); setInvoiceSeq((s) => s + 1); }} className="hover:text-slate-800 transition-colors" title="إلغاء وبدء جديد">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setProfitModalOpen(true)} className="hover:text-emerald-600 transition-colors" title="الربح المتوقع">
                  <TrendingUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setReceiptsOpen(true)} className="hover:text-slate-800 transition-colors" title="فواتير اليوم">
                  <ListTodo className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer Select */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className={`pointer-events-none absolute inset-y-0 right-2.5 flex items-center ${hasCustomerBalance ? "text-amber-500" : "text-slate-400"}`}>
                  <User className="h-4 w-4" />
                </div>
                <input
                  ref={customerInputRef}
                  type="text"
                  value={(!customer && !customerQuery) ? "زبون نقدي" : customerQuery}
                  placeholder="ابحث عن عميل..."
                  onChange={(e) => {
                    const v = e.target.value.replace("زبون نقدي", "");
                    setCustomerQuery(v); setCustomerLookupOpen(true); setActiveCustomerIndex(0);
                    if (!v) setCustomer(null);
                  }}
                  onFocus={() => setCustomerLookupOpen(true)}
                  onBlur={() => setTimeout(() => { setCustomerLookupOpen(false); if (!customer) setCustomerQuery(""); }, 200)}
                  onKeyDown={handleCustomerKeyDown}
                  className={`w-full border rounded-sm py-2 pl-2 pr-9 text-[13px] font-black outline-none transition-all shadow-inner ${
                    hasCustomerBalance
                      ? "border-amber-400 bg-amber-50 text-amber-900 focus:ring-1 focus:ring-amber-400"
                      : "border-slate-300 bg-white text-slate-800 focus:border-slate-800"
                  }`}
                />
                {customerLookupOpen && (
                  <LookupList items={customerResults} activeIndex={activeCustomerIndex} emptyLabel="ابحث عن عميل..." onPick={(c) => { setCustomer(c); setCustomerQuery(c.name); setCustomerLookupOpen(false); }} />
                )}
              </div>
              <button onClick={() => setCustomerCreateOpen(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-800 hover:text-slate-800 transition-colors shadow-sm">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {customer?.id && hasCustomerBalance && (
              <div className="text-[11px] font-black text-amber-700 bg-amber-100/50 border border-amber-200 px-2 py-1 rounded-sm text-center">
                رصيد العميل الحالي: {formatMoney(selectedCustomer.opening_balance)}
              </div>
            )}
          </div>

          {/* Cart List */}
          <div className="flex-1 overflow-y-auto p-2 bg-slate-50 custom-scrollbar shadow-inner relative">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center opacity-40">
                <ShoppingCart className="h-16 w-16 mb-4 text-slate-400" />
                <span className="text-[14px] font-black tracking-widest text-slate-500">الفاتورة فارغة</span>
                <span className="mt-1 text-[11px] font-bold text-slate-400">اضغط على الأصناف لإضافتها</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lines.map((line, idx) => {
                  const isExceedingStock = Number(line.quantity || 0) > Number(line.stock_quantity || 0);
                  const lineTotal = Math.max(0, Number(line.quantity || 0) * Number(line.sale_price || line.unit_price || 0) - Number(line.line_discount || 0));
                  return (
                    <div key={`${line.item_id}-${idx}`} className={`flex flex-col gap-1.5 p-2.5 rounded-lg border shadow-sm transition-all ${isExceedingStock ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-black text-slate-800 truncate block leading-tight" title={line.item_name || line.name}>{line.item_name || line.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">{line.code || "—"}</span>
                        </div>
                        <button onClick={() => removeLine(line.item_id)} className="shrink-0 p-1 rounded-sm text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                          <button onClick={() => updateLine(line.item_id, { quantity: Math.max(1, Number(line.quantity) - 1) })} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Minus className="w-3 h-3" /></button>
                          <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.item_id, { quantity: Number(e.target.value || 1) })} className="w-10 h-7 text-center text-[12px] font-black bg-transparent outline-none ring-0 border-0" />
                          <button onClick={() => updateLine(line.item_id, { quantity: Number(line.quantity) + 1 })} className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-[14px] font-black text-emerald-700">{formatMoney(lineTotal)}</span>
                          <span className="text-[10px] font-bold text-slate-400">{formatMoney(line.sale_price || line.unit_price)} للقطعة</span>
                        </div>
                      </div>
                      {isExceedingStock && <div className="text-[10px] font-bold text-rose-600 bg-rose-100/50 px-1.5 py-0.5 rounded-sm self-start mt-0.5">تجاوز المخزون (متاح: {line.stock_quantity})</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Totals & Payments */}
          <div className="shrink-0 flex flex-col border-t border-slate-200 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-30">
            {/* Totals Summary */}
            <div className="flex flex-col px-4 py-3 bg-slate-900 gap-1.5 border-b border-slate-800">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-slate-400">الفرعي</span>
                <span className="font-mono font-black text-slate-200">{formatMoney(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-slate-400">خصم إضافي</span>
                <input type="number" min="0" max={totals.subtotal} value={discount} onChange={(e) => { const v = Number(e.target.value || 0); setDiscount(v > totals.subtotal ? totals.subtotal : v); }} className="w-20 rounded-sm border border-slate-700 bg-slate-800 px-2 py-0.5 text-right font-mono text-[12px] font-black text-white outline-none focus:border-slate-500" />
              </div>
              <div className="border-t border-slate-700 mt-1 pt-1.5 flex items-center justify-between">
                <span className="text-[12px] font-black text-slate-300 uppercase tracking-widest">الإجمالي المطلوب</span>
                <span className="font-mono text-[28px] font-black text-emerald-400 leading-none drop-shadow-md">{formatMoney(totals.total)}</span>
              </div>
            </div>
            {/* Payment Methods */}
            <div className="flex flex-col p-3 gap-3 bg-white">
              <div className="flex gap-1.5">
                {PAYMENT_TYPES.map(({ type, label, Icon }) => {
                  const isWalkIn = !customer || customer.id === null;
                  const isDisabled = isWalkIn && type !== "cash";
                  return (
                    <button 
                      key={type} 
                      type="button" 
                      onClick={() => !isDisabled && setPaymentType(type)} 
                      disabled={isDisabled}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-1 py-2 text-[11px] font-black transition-all 
                        ${paymentType === type ? "border-slate-800 bg-slate-800 text-white shadow-md" : 
                          isDisabled ? "opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400"}`}
                      title={isDisabled ? "متاح للعملاء المسجلين فقط" : label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Payment Input */}
              {paymentType === "cash" && (
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder="المبلغ المستلم..." className="flex-1 rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white shadow-inner" />
                  {Number(amountReceived) > 0 && (
                    <div className={`rounded-sm px-3 py-2 text-[12px] font-black shrink-0 ${Number(amountReceived) - totals.total >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      الباقي: {formatMoney(Math.abs(Number(amountReceived) - totals.total))}
                    </div>
                  )}
                </div>
              )}
              {paymentType === "bank_transfer" && (
                <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-700 outline-none focus:border-slate-800 shadow-inner">
                  <option value="">اختر البنك / البطاقة</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
              {paymentType === "credit" && (
                <div className="flex flex-col gap-1.5">
                  <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="المدفوع الآن (اختياري)" className="w-full rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-black text-amber-900 outline-none focus:border-amber-500 shadow-inner" />
                  <div className="text-[11px] font-black text-amber-700 text-center">المتبقي آجل على العميل: {formatMoney(Math.max(0, totals.total - Number(amountPaid)))}</div>
                </div>
              )}
              {paymentType === "multi" && (
                <div className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md shadow-inner">
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">نقدي:</span>
                      <input type="number" min="0" value={multiCash} onChange={(e) => setMultiCash(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-[13px] font-black outline-none focus:border-emerald-500" />
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">بنكي:</span>
                      <input type="number" min="0" value={multiBank} onChange={(e) => setMultiBank(e.target.value)} placeholder="0.00" className="w-24 rounded-sm border border-slate-300 px-2 py-1.5 text-[13px] font-black outline-none focus:border-emerald-500" />
                      <select value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="flex-1 rounded-sm border border-slate-300 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-slate-800">
                         <option value="">اختر بنك</option>
                         {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-500 w-12">آجل:</span>
                      <input type="number" min="0" value={multiCredit} onChange={(e) => setMultiCredit(e.target.value)} placeholder="0.00" className="flex-1 rounded-sm border border-amber-300 px-2 py-1.5 text-[13px] font-black text-amber-900 outline-none focus:border-amber-500 bg-amber-50" />
                   </div>
                   <div className={`mt-1 text-center text-[11px] font-black rounded-sm py-1 ${Math.abs((Number(multiCash)||0) + (Number(multiBank)||0) + (Number(multiCredit)||0) - totals.total) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      الإجمالي المُدخل: {formatMoney((Number(multiCash)||0) + (Number(multiBank)||0) + (Number(multiCredit)||0))} من {formatMoney(totals.total)}
                   </div>
                </div>
              )}

              {/* Main Actions */}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => saveInvoice(false)} disabled={!lines.length || isSaving} className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-3 text-[13px] font-black transition-all ${!lines.length || isSaving ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white text-slate-800 hover:border-slate-800 hover:bg-slate-50 shadow-sm"}`}>
                  {isSaving ? "جارٍ الحفظ..." : "حفظ فقط"}
                </button>
                <button type="button" onClick={() => saveInvoice(true)} disabled={!lines.length || isSaving} className={`flex flex-[2] items-center justify-center gap-2 rounded-md px-3 py-3 text-[14px] font-black text-white transition-all shadow-md ${!lines.length || isSaving ? "cursor-not-allowed bg-slate-300" : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg"}`}>
                  <Printer className="h-5 w-5" /> {isSaving ? "جارٍ الحفظ..." : "دفع وطباعة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {saveMessage && (
        <div className="absolute left-1/2 top-4 z-[150] -translate-x-1/2 rounded-sm border border-rose-200 bg-rose-50 px-5 py-2.5 font-bold text-[13px] text-rose-700 shadow-xl">
          {saveMessage}
        </div>
      )}


      {/* ── Today's Receipts Modal ── */}
      <Modal open={receiptsOpen} onClose={() => setReceiptsOpen(false)} title="فواتير اليوم">
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">من</label>
              <input type="date" value={receiptDateFrom} onChange={(e) => setReceiptDateFrom(e.target.value)}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">إلى</label>
              <input type="date" value={receiptDateTo} onChange={(e) => setReceiptDateTo(e.target.value)}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-slate-800" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ترتيب</label>
              <select value={receiptSort} onChange={(e) => setReceiptSort(e.target.value)}
                className="rounded-sm border border-slate-200 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-slate-800">
                <option value="created_at">الوقت</option>
                <option value="total">الإجمالي</option>
                <option value="invoice_no">رقم الفاتورة</option>
                <option value="payment_type">طريقة الدفع</option>
              </select>
              <button onClick={() => setReceiptDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </div>
            <button onClick={loadReceipts}
              className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-black text-slate-600 hover:border-slate-800 hover:text-slate-900 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${receiptsLoading ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>

          {/* Summary strip */}
          <div className="flex items-center gap-4 rounded-sm bg-slate-950 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">عدد الفواتير</span>
              <span className="font-mono text-[20px] font-black text-white leading-none">{receiptSummary.count}</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي الإيرادات</span>
              <span className="font-mono text-[20px] font-black text-emerald-400 leading-none">{formatMoney(receiptSummary.total)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[420px] overflow-auto rounded-sm border border-slate-200">
            <DataGrid
              data={receiptsLoading ? [] : receipts}
              rowKey="id"
              emptyMessage={receiptsLoading ? "جاري التحميل..." : "لا توجد فواتير في هذه الفترة"}
              className="border-0"
              columns={[
                {
                  id: "invoice_no", header: "رقم الفاتورة", width: 140, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 font-mono text-[12px] font-black text-slate-700",
                  render: (inv) => inv.invoice_no
                },
                {
                  id: "customer_name", header: "العميل", width: 160, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 text-[12px] font-bold text-slate-800",
                  render: (inv) => inv.customer_name || "زبون نقدي"
                },
                {
                  id: "items_count", header: "الأصناف", width: 80, sortable: true,
                  headerClass: "text-center px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 text-center text-[12px] font-bold text-slate-600",
                  render: (inv) => inv.items_count
                },
                {
                  id: "total", header: "الإجمالي", width: 120, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 font-mono text-[13px] font-black text-emerald-700",
                  render: (inv) => formatMoney(inv.total)
                },
                {
                  id: "payment_type", header: "طريقة الدفع", width: 120, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 text-[12px] font-bold text-slate-600",
                  render: (inv) => PAYMENT_TYPES.find((p) => p.type === inv.payment_type)?.label || inv.payment_type
                },
                {
                  id: "status", header: "الحالة", width: 100, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3",
                  render: (inv) => {
                    const statusInfo = PAYMENT_STATUS_LABELS[inv.status] || PAYMENT_STATUS_LABELS.paid;
                    return <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-black ${statusInfo.cls}`}>{statusInfo.label}</span>;
                  }
                },
                {
                  id: "created_at", header: "الوقت", width: 150, sortable: true,
                  headerClass: "text-right px-3 font-black uppercase tracking-widest text-slate-500",
                  cellClass: "px-3 text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap",
                  render: (inv) => formatArabicDateTime(new Date(inv.created_at))
                }
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* ── Detailed item search ── */}
      <Modal open={detailedSearchOpen} onClose={() => setDetailedSearchOpen(false)} title="بحث تفصيلي عن الأصناف">
        <div className="flex flex-col gap-3">
          <input type="text" value={detailedSearchQuery} onChange={(e) => setDetailedSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الكود أو الباركود أو الفئة..."
            className="w-full rounded-sm border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-800" />
          <div className="flex items-center gap-2">
            <select value={detailedCategoryFilter} onChange={(e) => setDetailedCategoryFilter(e.target.value)}
              className="rounded-sm border border-slate-200 px-2 py-2 text-sm outline-none focus:border-slate-800">
              {detailedCategories.map((cat) => <option key={cat} value={cat}>{cat === "all" ? "كل الفئات" : cat}</option>)}
            </select>
          </div>
          <div className="max-h-[420px] overflow-x-auto overflow-y-auto rounded-sm border border-slate-200" dir="rtl">
            <table className="w-full text-sm border-collapse min-w-max">
              <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <SortTh label="صورة"    width={detailedColWidths.image}    onResizeStart={onDetailedResizeStart} resizableKey="image"    sortConfig={detailedSortConfig} />
                  <SortTh label="الكود"   sortKey="code"     onSort={toggleDetailedSort} width={detailedColWidths.code}    onResizeStart={onDetailedResizeStart} resizableKey="code"    sortConfig={detailedSortConfig} />
                  <SortTh label="الصنف"   sortKey="name"     onSort={toggleDetailedSort} width={detailedColWidths.name}    onResizeStart={onDetailedResizeStart} resizableKey="name"    sortConfig={detailedSortConfig} />
                  <SortTh label="الباركود" sortKey="barcode" onSort={toggleDetailedSort} width={detailedColWidths.barcode} onResizeStart={onDetailedResizeStart} resizableKey="barcode" sortConfig={detailedSortConfig} />
                  <SortTh label="الفئة"   sortKey="category" onSort={toggleDetailedSort} width={detailedColWidths.category} onResizeStart={onDetailedResizeStart} resizableKey="category" sortConfig={detailedSortConfig} />
                  <SortTh label="السعر"   sortKey="price"    onSort={toggleDetailedSort} width={detailedColWidths.price}   onResizeStart={onDetailedResizeStart} resizableKey="price"   sortConfig={detailedSortConfig} />
                  <SortTh label="المخزون" sortKey="stock"    onSort={toggleDetailedSort} width={detailedColWidths.stock}   onResizeStart={onDetailedResizeStart} resizableKey="stock"   sortConfig={detailedSortConfig} />
                </tr>
              </thead>
              <tbody>
                {detailedItemResults.map((item) => (
                  <tr key={item.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-900 hover:text-white transition-colors group" onClick={() => handleSelectItem(item)}>
                    <td className="p-2 border-l border-slate-50">
                      <div className="h-8 w-8 overflow-hidden rounded-sm border border-slate-200 bg-white">
                        {getItemImage(item) ? <img src={getItemImage(item)} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><ImageIcon className="h-3.5 w-3.5" /></div>}
                      </div>
                    </td>
                    <td className="p-2 font-mono font-bold text-slate-600 group-hover:text-slate-200 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.code}px` }}>{item.code || item.item_code || "—"}</td>
                    <td className="p-2 font-black text-slate-800 group-hover:text-white border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.name}px` }}>{item.name}</td>
                    <td className="p-2 font-mono font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.barcode}px` }}>{item.barcode || "—"}</td>
                    <td className="p-2 font-bold text-slate-500 group-hover:text-slate-300 border-l border-slate-50 truncate" style={{ maxWidth: `${detailedColWidths.category}px` }}>{item.category_name || "—"}</td>
                    <td className="p-2 font-mono font-black text-emerald-700 group-hover:text-emerald-300 border-l border-slate-50" style={{ maxWidth: `${detailedColWidths.price}px` }}>{formatMoney(item.sale_price || item.price || 0)}</td>
                    <td className="p-2 font-black text-slate-700 group-hover:text-slate-200" style={{ maxWidth: `${detailedColWidths.stock}px` }}>{Number(item.stock_quantity || item.stock || 0)}</td>
                  </tr>
                ))}
                {detailedItemResults.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center font-black text-slate-400">لا توجد نتائج مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-slate-400 font-bold">اضغط على أي صف لاختيار الصنف وإضافته</div>
        </div>
      </Modal>

      {/* ── Profit analysis ── */}
      <Modal open={profitModalOpen} onClose={() => setProfitModalOpen(false)} title="تحليل ربح الإيصال الحالي">
        <div className="space-y-2">
          {lines.map((line) => {
            const item        = items.find((e) => e.id === line.item_id);
            const purchase    = Number(item?.purchase_price || 0);
            const unitProfit  = Number(line.unit_price || 0) - purchase;
            const totalProfit = unitProfit * Number(line.quantity || 0);
            return (
              <div key={line.item_id} className="flex items-center justify-between rounded-sm border border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-[13px] font-black text-slate-800">{line.item_name}</div>
                  <div className="text-[11px] text-slate-500">شراء: {formatMoney(purchase)} · بيع: {formatMoney(line.unit_price)} · كمية: {line.quantity}</div>
                </div>
                <div className={`font-mono text-[13px] font-black ${totalProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatMoney(totalProfit)}</div>
              </div>
            );
          })}
          {lines.length > 0 && (
            <div className="flex items-center justify-between rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="font-black text-emerald-800">إجمالي الربح المتوقع</div>
              <div className="font-mono text-[16px] font-black text-emerald-700">
                {formatMoney(lines.reduce((sum, l) => {
                  const item = items.find((e) => e.id === l.item_id);
                  return sum + (Number(l.unit_price || 0) - Number(item?.purchase_price || 0)) * Number(l.quantity || 0);
                }, 0))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Quick customer creation ── */}
      <Modal open={customerCreateOpen} onClose={() => setCustomerCreateOpen(false)} title="إنشاء عميل جديد">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">اسم العميل *</label>
            <input value={customerDraft.name} onChange={(e) => setCustomerDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="الاسم بالكامل..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">رقم الهاتف الأساسي *</label>
              <input value={customerDraft.phone} onChange={(e) => setCustomerDraft((s) => ({ ...s, phone: e.target.value }))}
                placeholder="01..."
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-slate-600">هاتف بديل (اختياري)</label>
              <input value={customerDraft.phone2} onChange={(e) => setCustomerDraft((s) => ({ ...s, phone2: e.target.value }))}
                placeholder="01..."
                className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">العنوان (اختياري)</label>
            <input value={customerDraft.address} onChange={(e) => setCustomerDraft((s) => ({ ...s, address: e.target.value }))}
              placeholder="المنطقة، الشارع..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">ملاحظات (اختياري)</label>
            <textarea value={customerDraft.notes} onChange={(e) => setCustomerDraft((s) => ({ ...s, notes: e.target.value }))}
              placeholder="أي ملاحظات..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800" rows={2} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setCustomerCreateOpen(false)}
              className="rounded-sm border border-slate-300 px-5 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50">إلغاء</button>
            <button type="button" onClick={createQuickCustomer}
              className="rounded-sm bg-slate-900 px-6 py-2 text-[13px] font-bold text-white hover:bg-slate-800">تأكيد وإنشاء</button>
          </div>
        </div>
      </Modal>

      {/* ── Supervisor override ── */}
      <Modal open={supervisorOverrideOpen} onClose={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }} title="تجاوز حد الخصم">
        <div className="space-y-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mx-auto">
            <ShieldCheck className="h-7 w-7 text-amber-600" />
          </div>
          <p className="text-[13px] font-bold text-slate-700">الخصم المطبق يتجاوز الحد المسموح (15% من الإجمالي).</p>
          <p className="text-[12px] text-slate-500">هل تريد تجاوز هذا القيد بصلاحية المشرف؟</p>
          <div className="flex justify-center gap-3 pt-2">
            <button type="button" onClick={() => { setSupervisorOverrideOpen(false); setPendingSave(null); }}
              className="rounded-sm border border-slate-200 px-5 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">إلغاء — تعديل الخصم</button>
            <button type="button" onClick={confirmSupervisorOverride}
              className="rounded-sm bg-amber-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-amber-700">تجاوز بصلاحية المشرف</button>
          </div>
        </div>
      </Modal>

      {/* ── Multi-payment modal ── */}
      <Modal open={multiModalOpen} onClose={() => setMultiModalOpen(false)} title="توزيع مبالغ الدفع المتعدد">
        <div className="space-y-4">
          <div className="rounded-sm bg-slate-950 p-5 text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">المبلغ المطلوب توزيعه</p>
            <p className="font-mono text-[28px] font-black text-white">{formatMoney(totals.total)}</p>
          </div>
          <div className="space-y-2">
            {paymentMethods.map(m => {
              const current = activeMultiPayments.find(p => p.method_id === m.id);
              const amount  = current?.amount || "";
              return (
                <div key={m.id} className="flex items-center gap-4 rounded-sm border border-slate-200 bg-white p-3 hover:border-slate-800 transition-colors">
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-slate-50 text-slate-500">
                      {m.type === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <span className="text-[13px] font-black text-slate-800">{m.name}</span>
                  </div>
                  <input type="number" value={amount} placeholder="0.000"
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveMultiPayments(prev => [...prev.filter(p => p.method_id !== m.id), { method_id: m.id, amount: val }]);
                    }}
                    className="w-28 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-right font-mono text-[13px] font-black text-slate-800 outline-none focus:border-slate-800" />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase">الموزع</span>
              <span className={`font-mono text-[16px] font-black ${Math.abs(totals.total - multiTotal) < 0.005 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatMoney(multiTotal)}
              </span>
            </div>
            <button onClick={() => setMultiModalOpen(false)}
              className="rounded-sm bg-slate-900 px-8 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 shadow-sm active:scale-95">
              تأكيد وإغلاق
            </button>
          </div>
        </div>
      </Modal>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        invoice={lastSavedInvoice ? {
          invoice_no: lastSavedInvoice.invoice_no,
          created_at: lastSavedInvoice.date instanceof Date ? lastSavedInvoice.date.toISOString() : new Date().toISOString(),
          customer_name: lastSavedInvoice.customer?.name,
          lines: lastSavedInvoice.lines.map(l => ({ item_name: l.name, quantity: l.quantity, unit_price: l.unit_price, discount_amount: Number(l.lineDiscount || 0) })),
          payments: [{ method: lastSavedInvoice.paymentType, amount: lastSavedInvoice.totals?.total }],
        } : {
          invoice_no: invoiceNumber,
          created_at: new Date().toISOString(),
          customer_name: customer?.name,
          lines: lines.map(l => ({ item_name: l.name, quantity: l.quantity, unit_price: l.unit_price, discount_amount: Number(l.lineDiscount || 0) })),
          payments: [{ method: paymentType, amount: totals.total }],
        }}
        settings={storeSettings}
        operationLabel="فاتورة مبيعات نقدية"
      />
    </div>
  );
}
