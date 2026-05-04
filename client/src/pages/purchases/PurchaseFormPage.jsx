import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Package,
  Calendar,
  FileText,
  Warehouse,
  ChevronDown,
  ArrowLeft,
  X,
  CreditCard,
  Wallet,
  Banknote,
  Tag,
  AlertTriangle,
  Clock,
  ExternalLink,
  TrendingUp,
  Building2,
  Phone,
  ImageIcon,
  Settings,
  ZoomIn,
  Printer
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import toast from "react-hot-toast";
import SearchInput from "../../components/ui/SearchInput";
import Highlight from "../../components/ui/Highlight";
import { fuzzyFilterRows } from "../../utils/search";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

// --- Local Lookup Component ---
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

// --- Payment Method Config ---
const PAYMENT_METHODS = [
  {
    id: "cash",
    label: "نقدي من الخزينة",
    sub: "سداد فوري - خصم من الخزينة",
    icon: Banknote,
    color: "slate",
    requiresSupplier: false,
  },
  {
    id: "bank_transfer",
    label: "حوالة بنكية",
    sub: "خصم من حساب البنك",
    icon: CreditCard,
    color: "blue",
    requiresSupplier: true,
  },
  {
    id: "credit",
    label: "آجل",
    sub: "يُضاف لرصيد المورد",
    icon: Wallet,
    color: "amber",
    requiresSupplier: true,
  },
  {
    id: "future_due",
    label: "استحقاق لاحق",
    sub: "مع تحديد تاريخ الاستحقاق",
    icon: Clock,
    color: "rose",
    requiresSupplier: true,
  },
];

const COLOR_MAP = {
  slate: { border: "border-slate-800", bg: "bg-slate-800", text: "text-slate-800", light: "bg-slate-50" },
  blue: { border: "border-blue-600", bg: "bg-blue-600", text: "text-blue-700", light: "bg-blue-50" },
  amber: { border: "border-amber-500", bg: "bg-amber-500", text: "text-amber-700", light: "bg-amber-50" },
  rose: { border: "border-rose-500", bg: "bg-rose-500", text: "text-rose-700", light: "bg-rose-50" },
};

export default function PurchaseFormPage() {
  const navigate = useNavigate();

  // --- Core State ---
  const [lines, setLines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [supplier, setSupplier] = useState(null);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState(() => `INV-${Date.now().toString().slice(-6)}`);

  const [units, setUnits] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  // --- Staging (quick entry bar) ---
  const [itemQuery, setItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [staging, setStaging] = useState({
    quantity: "1",
    unitCost: "",
    sellingPrice: "",
    warehouseId: "",
    unitId: "",
  });

  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierLookupOpen, setSupplierLookupOpen] = useState(false);
  const [activeSupplierIndex, setActiveSupplierIndex] = useState(0);

  // --- Payment ---
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankRef, setBankRef] = useState("");
  const [dueDate, setDueDate] = useState("");

  // --- UI ---
  const [isSaving, setIsSaving] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [printSettings, setPrintSettings] = useState({});
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState({ name: "", phone: "", address: "" });

  const itemInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const costInputRef = useRef(null);
  const sellInputRef = useRef(null);
  const supplierInputRef = useRef(null);
  const whSelectRef = useRef(null);
  const unitSelectRef = useRef(null);
  const addBtnRef = useRef(null);

  // --- Keyboard Navigation Hook ---
  const handleFieldKeyDown = (e, nextRef, prevRef, isEnterSubmit = false) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        if (prevRef?.current) {
          prevRef.current.focus();
          if (prevRef.current.select) prevRef.current.select();
        }
      } else {
        if (isEnterSubmit) addLine();
        else if (nextRef?.current) {
          nextRef.current.focus();
          if (nextRef.current.select) nextRef.current.select();
        }
      }
    }
  };

  // --- Data Loading ---
  useEffect(() => {
    api.get("/api/settings").then(r => setPrintSettings(r.data.data || {})).catch(() => {});
    api.get("/api/suppliers").then(r => setSuppliers(r.data.data || [])).catch(() => {});
    api.get("/api/items").then(r => setItems(r.data.data || [])).catch(() => {});
    api.get("/api/units").then(r => setUnits(r.data.data || [])).catch(() => {});
    api.get("/api/stock/levels").then(r => {
      const grouped = {};
      (r.data.data || []).forEach(row => {
        if (!grouped[row.item_id]) grouped[row.item_id] = {};
        grouped[row.item_id][row.warehouse_id] = row.quantity;
      });
      setStockLevels(grouped);
    }).catch(() => {});
    api.get("/api/warehouses").then(r => {
      const w = r.data.data || [];
      setWarehouses(w);
      if (w.length) {
        const firstId = String(w[0].id);
        setDefaultWarehouseId(firstId);
        setStaging(s => ({ ...s, warehouseId: firstId }));
      }
    }).catch(() => {});
  }, []);

  // When default warehouse changes, update staging if no item picked yet
  useEffect(() => {
    if (!selectedItem) {
      setStaging(s => ({ ...s, warehouseId: defaultWarehouseId }));
    }
  }, [defaultWarehouseId]);

  // --- Lookups ---
  const filteredItems = useMemo(() => {
    return fuzzyFilterRows(items, itemQuery, ["name", "code", "item_code", "barcode"]).slice(0, 8);
  }, [itemQuery, items]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 8);
    return suppliers
      .filter(s => String(s.name).toLowerCase().includes(q) || String(s.phone || "").includes(q))
      .slice(0, 8);
  }, [supplierQuery, suppliers]);

  // --- Handlers ---
  function handlePickItem(item) {
    setSelectedItem(item);
    setItemQuery(item.name);
    setStaging(prev => ({
      ...prev,
      unitCost: String(item.purchase_price || 0),
      sellingPrice: String(item.sale_price || 0),
      unitId: String(item.unit_id || prev.unitId),
    }));
    setLookupOpen(false);
    setTimeout(() => {
      whSelectRef.current?.focus();
    }, 50);
  }

  function handlePickSupplier(s) {
    setSupplier(s);
    setSupplierQuery(s.name);
    setSupplierLookupOpen(false);
    // Credit and future_due require supplier — reset to cash if no supplier
  }

  function addLine() {
    if (!selectedItem) return;
    const qty = Number(staging.quantity || 1);
    const cost = Number(staging.unitCost || 0);
    const sellingPrice = Number(staging.sellingPrice || 0);
    const wid = staging.warehouseId || defaultWarehouseId;

    setLines(prev => [
      ...prev,
      {
        item_id: selectedItem.id,
        name: selectedItem.name,
        code: selectedItem.code || selectedItem.barcode,
        quantity: qty,
        unit_cost: cost,
        selling_price: sellingPrice,
        original_sale_price: Number(selectedItem.sale_price || 0),
        warehouse_id: wid,
        unit_id: staging.unitId || null,
        total: qty * cost,
      },
    ]);

    setSelectedItem(null);
    setItemQuery("");
    setStaging(s => ({ quantity: "1", unitCost: "", sellingPrice: "", warehouseId: s.warehouseId, unitId: "" }));
    setTimeout(() => {
      itemInputRef.current?.focus();
      itemInputRef.current?.select();
    }, 50);
  }

  function removeLine(index) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  function updateLineField(index, field, value) {
    setLines(prev =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        if (field === "quantity" || field === "unit_cost") {
          updated.total = Number(updated.quantity) * Number(updated.unit_cost);
        }
        return updated;
      })
    );
  }

  const totals = useMemo(() => {
    const sub = lines.reduce((acc, l) => acc + l.total, 0);
    return { sub, total: sub };
  }, [lines]);

  const priceChangedLines = useMemo(
    () => lines.filter(l => Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0),
    [lines]
  );

  async function handleSave() {
    if (!supplier) { toast.error("يرجى اختيار المورد"); return; }
    if (!lines.length) { toast.error("الفاتورة فارغة — أضف أصناف أولاً"); return; }
    if (paymentMethod === "future_due" && !dueDate) { toast.error("يرجى تحديد تاريخ الاستحقاق"); return; }

    setIsSaving(true);
    try {
      await api.post("/api/purchases", {
        supplier_id: supplier.id,
        warehouse_id: defaultWarehouseId,
        ref_no: refNo,
        date: docDate,
        payment_method: paymentMethod,
        bank_ref: paymentMethod === "bank_transfer" ? bankRef : undefined,
        due_date: paymentMethod === "future_due" ? dueDate : undefined,
        lines: lines.map(l => ({
          item_id: l.item_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          warehouse_id: l.warehouse_id || defaultWarehouseId,
        })),
      });

      if (priceChangedLines.length > 0) {
        toast.success(`تم تحديث أسعار بيع ${priceChangedLines.length} صنف وتسجيلها في السجل`);
      }

      toast.success("تم حفظ فاتورة المشتريات بنجاح");
      setTimeout(() => navigate("/purchases"), 1200);
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل حفظ الفاتورة");
    } finally {
      setIsSaving(false);
    }
  }

  async function createSupplier() {
    if (!supplierDraft.name) return;
    try {
      const r = await api.post("/api/suppliers", supplierDraft);
      const newSup = r.data.data;
      setSuppliers(prev => [newSup, ...prev]);
      handlePickSupplier(newSup);
      setSupplierModalOpen(false);
      setSupplierDraft({ name: "", phone: "", address: "" });
    } catch {
      toast.error("فشل إنشاء المورد");
    }
  }

  function handleSelectPayment(methodId) {
    const method = PAYMENT_METHODS.find(m => m.id === methodId);
    if (method?.requiresSupplier && !supplier) return;
    setPaymentMethod(methodId);
  }

  const selectedPaymentColors = COLOR_MAP[PAYMENT_METHODS.find(m => m.id === paymentMethod)?.color || "slate"];

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden pb-6">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <Link to="/purchases" className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800">فاتورة مشتريات جديدة</h1>
            <span className="text-[10px] font-bold text-slate-400">إدخال مخزون جديد</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {priceChangedLines.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-sm bg-amber-50 border border-amber-200 px-3 py-1.5 text-[11px] font-bold text-amber-700">
              <TrendingUp className="h-3.5 w-3.5" />
              {priceChangedLines.length} أسعار بيع ستتغير
            </div>
          )}
          <button
            onClick={() => setPrintPreview(true)}
            className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Printer className="h-4 w-4" /> طباعة ومراجعة المستند
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ الفاتورة (F9)"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-4 p-4 overflow-hidden">
        {/* Left: Main Content */}
        <div className="flex flex-1 flex-col gap-3 min-w-0 overflow-hidden">
          {/* Header Info Grid */}
          <section className="grid grid-cols-3 gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm shrink-0">
            {/* Supplier */}
            <div className="relative flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">المورد</label>
              <div className="flex items-center gap-1">
                <div className="relative flex-1">
                  <User className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={supplierInputRef}
                    type="text"
                    value={supplierQuery}
                    onChange={(e) => { setSupplierQuery(e.target.value); setSupplierLookupOpen(true); }}
                    onFocus={() => setSupplierLookupOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierLookupOpen(false), 200)}
                    placeholder="ابحث عن مورد..."
                    className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                  />
                  {supplierLookupOpen && (
                    <LookupList
                      items={filteredSuppliers}
                      onPick={handlePickSupplier}
                      activeIndex={activeSupplierIndex}
                      emptyLabel="لم يتم العثور على مورد"
                    />
                  )}
                </div>
                <button
                  onClick={() => setSupplierModalOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">تاريخ الفاتورة</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-sm bg-white py-2 pl-3 pr-9 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                />
              </div>
            </div>

            {/* Ref No */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">رقم مرجع المورد</label>
              <div className="relative">
                <FileText className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  value={refNo}
                  className="w-full border border-slate-300 rounded-sm bg-slate-50 py-2 pl-3 pr-9 text-[12px] font-bold text-slate-500 outline-none focus:border-slate-800 font-mono cursor-not-allowed"
                />
              </div>
            </div>
          </section>

          {/* Quick Entry Bar */}
          <section className="rounded-md border border-slate-300 bg-white p-3 shadow-sm shrink-0">
            <div className="grid grid-cols-[3fr_110px_80px_100px_100px_100px_80px] gap-2 items-end">
              {/* Item search */}
              <div className="relative flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">الصنف</label>
                <div className="relative">
                  <SearchInput
                    ref={itemInputRef}
                    value={itemQuery}
                    onChange={(val) => { setItemQuery(val); setLookupOpen(true); setSelectedItem(null); }}
                    onFocus={(e) => { setLookupOpen(true); e.target.select(); }}
                    onBlur={() => setTimeout(() => setLookupOpen(false), 200)}
                    placeholder="ابحث بالاسم، الباركود، أو الكود..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredItems.length > 0) {
                        e.preventDefault();
                        handlePickItem(filteredItems[activeIndex]);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
                      }
                    }}
                  />
                  {lookupOpen && (
                    <LookupList
                      items={filteredItems}
                      onPick={handlePickItem}
                      activeIndex={activeIndex}
                      query={itemQuery}
                    />
                  )}
                </div>
              </div>
              
              {/* Warehouse Selection Listbox */}
              <div className="flex flex-col gap-1 relative z-10">
                <label className="text-[11px] font-bold text-slate-600 truncate">الرصيد / المخزن (اختر)</label>
                <select
                  ref={whSelectRef}
                  size={4}
                  value={staging.warehouseId}
                  onChange={(e) => setStaging(s => ({ ...s, warehouseId: e.target.value }))}
                  onKeyDown={(e) => handleFieldKeyDown(e, qtyInputRef, itemInputRef)}
                  className="w-full border border-slate-300 rounded-sm bg-slate-50 py-1 px-1 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 overflow-y-auto custom-scrollbar h-[37px] absolute top-[calc(100%-37px)] hover:h-[120px] focus:h-[120px] focus:z-20 transition-all shadow-sm focus:shadow-xl"
                >
                  {warehouses.map(w => {
                    const qty = selectedItem && stockLevels[selectedItem.id] ? (stockLevels[selectedItem.id][w.id] || 0) : 0;
                    return (
                      <option key={w.id} value={w.id} className="py-1 px-2 border-b border-slate-100 last:border-0 rounded-sm cursor-pointer hover:bg-slate-200">
                        {w.name} {selectedItem && `(${qty})`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Qty */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">الكمية</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.001"
                  step="any"
                  value={staging.quantity}
                  onChange={(e) => setStaging(s => ({ ...s, quantity: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, unitSelectRef, whSelectRef)}
                  className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                />
              </div>

              {/* Unit */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">الوحدة</label>
                <div className="relative">
                  <select
                    ref={unitSelectRef}
                    value={staging.unitId}
                    onChange={(e) => setStaging(s => ({ ...s, unitId: e.target.value }))}
                    onKeyDown={(e) => handleFieldKeyDown(e, costInputRef, qtyInputRef)}
                    className="w-full h-[37px] appearance-none border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                  >
                    <option value="">أساسية</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <ChevronDown className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
              </div>

              {/* Cost */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">التكلفة</label>
                <input
                  ref={costInputRef}
                  type="number"
                  step="any"
                  value={staging.unitCost}
                  onChange={(e) => setStaging(s => ({ ...s, unitCost: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, sellInputRef, unitSelectRef)}
                  className="w-full h-[37px] border border-slate-300 rounded-sm bg-slate-50 py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center"
                />
              </div>
              {/* Selling price */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  سعر البيع
                  {selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0 && (
                    <span className="text-amber-600 text-[9px]">• متغير</span>
                  )}
                </label>
                <input
                  ref={sellInputRef}
                  type="number"
                  step="any"
                  value={staging.sellingPrice}
                  onChange={(e) => setStaging(s => ({ ...s, sellingPrice: e.target.value }))}
                  onFocus={e => e.target.select()}
                  onKeyDown={(e) => handleFieldKeyDown(e, addBtnRef, costInputRef, true)}
                  className={`w-full h-[37px] border rounded-sm py-2 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-slate-800 text-center ${
                    selectedItem && Number(staging.sellingPrice) !== Number(selectedItem.sale_price) && Number(staging.sellingPrice) > 0
                      ? "border-amber-400 bg-amber-50"
                      : "border-slate-300 bg-slate-50"
                  }`}
                />
              </div>
              {/* Add button */}
              <button
                ref={addBtnRef}
                onClick={addLine}
                onKeyDown={(e) => { if (e.key === "Enter" && selectedItem) { e.preventDefault(); addLine(); } }}
                disabled={!selectedItem}
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
                id: "index", header: "#", width: 40, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-400 border-l border-slate-100", sortable: false,
                render: (_, i) => i + 1
              },
              {
                id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[11px] font-black tracking-wider text-slate-500 border-l border-slate-100",
                render: (l) => l.barcode || l.code || l.item_code || '-'
              },
              {
                id: "name", header: "البيان", width: 220, sortable: true, cellClass: "font-black text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                render: (l) => {
                  const item = items.find(i => i.id === l.item_id);
                  const imgUrl = item?.primary_image_url || item?.image_url || item?.image;
                  return (
                    <div className="flex items-center gap-2 py-1">
                      {imgUrl ? (
                        <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                          <img src={resolveImageUrl(imgUrl)} alt={l.name} className="w-8 h-8 object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-8 h-8 shrink-0 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200"><ImageIcon className="w-4 h-4 text-slate-300"/></div>
                      )}
                      <span className="truncate">{l.name}</span>
                    </div>
                  );
                }
              },
              {
                id: "quantity", header: "الكمية", width: 90, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => (
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={l.quantity}
                    onChange={(e) => updateLineField(i, "quantity", Number(e.target.value))}
                    className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-indigo-50/50 transition-colors"
                  />
                )
              },
              {
                id: "unit_cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => (
                  <input
                    type="number"
                    step="any"
                    value={l.unit_cost}
                    onChange={(e) => updateLineField(i, "unit_cost", Number(e.target.value))}
                    className="w-full h-[40px] text-center text-[13px] font-mono font-black bg-transparent outline-none border-0 ring-0 focus:ring-0 focus:bg-indigo-50/50 text-slate-700 transition-colors"
                  />
                )
              },
              {
                id: "selling_price", header: "سعر البيع", width: 110, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100",
                render: (l, i) => {
                  const priceChanged = Number(l.selling_price) !== Number(l.original_sale_price) && Number(l.selling_price) > 0;
                  return (
                    <div className="relative w-full h-full">
                      <input
                        type="number"
                        step="any"
                        value={l.selling_price}
                        onChange={(e) => updateLineField(i, "selling_price", Number(e.target.value))}
                        className={`w-full h-[40px] text-center text-[13px] font-mono font-black outline-none border-0 ring-0 focus:ring-0 transition-colors ${
                          priceChanged
                            ? "bg-amber-50 text-amber-800"
                            : "bg-transparent focus:bg-indigo-50/50"
                        }`}
                      />
                      {priceChanged && (
                        <span title={`السعر الحالي: ${l.original_sale_price}`} className="absolute top-1 left-1 h-2 w-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                  );
                }
              },
              {
                id: "warehouse_id", header: "المخزن", width: 120, sortable: true, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 relative",
                render: (l, i) => (
                  <select
                    value={l.warehouse_id}
                    onChange={(e) => updateLineField(i, "warehouse_id", e.target.value)}
                    className="w-full h-[40px] text-[11px] font-bold bg-transparent outline-none border-0 ring-0 focus:ring-0 text-slate-600 appearance-none text-center focus:bg-slate-50 truncate"
                  >
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )
              },
              {
                id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/50 border-l border-slate-100",
                render: (l) => Number(l.total).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              },
              {
                id: "actions", header: "", width: 50, sortable: false, cellClass: "p-0 border-l-0 text-center",
                render: (_, i) => (
                  <button onClick={() => removeLine(i)} className="inline-flex h-[40px] w-full items-center justify-center text-slate-400 opacity-60 hover:bg-slate-100 hover:text-rose-500 hover:opacity-100 transition-colors focus:outline-none">
                    <X className="h-4 w-4" />
                  </button>
                )
              }
            ]}
          />

            {/* Price change notice */}
            {priceChangedLines.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-700 font-bold shrink-0 mt-2 border border-amber-200 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                سيتم تحديث أسعار البيع لـ {priceChangedLines.map(l => l.name).join("، ")} وتسجيلها في سجل تغييرات الأسعار
                <Link to="/operations/bulk-price-update" className="mr-auto flex items-center gap-1 text-amber-600 hover:underline">
                  <ExternalLink className="h-3 w-3" /> سجل الأسعار
                </Link>
              </div>
            )}
        </div>

        {/* Right Sidebar */}
        <aside className="w-[280px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Supplier Card */}
          {supplier ? (
            <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">المورد</h3>
                <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700">
                  <ExternalLink className="h-3 w-3" /> السجل
                </Link>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-[14px] font-black">
                  {supplier.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-slate-800 truncate">{supplier.name}</p>
                  {supplier.phone && (
                    <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                      <Phone className="h-3 w-3" /> {supplier.phone}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between rounded-sm bg-slate-50 border border-slate-200 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-slate-500">الرصيد الحالي</span>
                    <span className={`text-[13px] font-black font-mono ${Number(supplier.opening_balance) > 0 ? "text-rose-600" : "text-slate-800"}`}>
                      {Number(supplier.opening_balance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center">
              <Building2 className="h-8 w-8 mx-auto text-slate-200 mb-2" />
              <p className="text-[11px] font-bold text-slate-400">اختر مورداً لتفعيل<br />خيارات الدفع المتقدمة</p>
            </div>
          )}

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
              {PAYMENT_METHODS.map(m => {
                const isSelected = paymentMethod === m.id;
                const isDisabled = m.requiresSupplier && !supplier;
                const colors = COLOR_MAP[m.color];
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectPayment(m.id)}
                    disabled={isDisabled}
                    title={isDisabled ? "يجب اختيار مورد أولاً" : undefined}
                    className={`flex w-full items-center gap-3 rounded-sm border p-3 text-right transition-all ${
                      isSelected
                        ? `${colors.border} ${colors.light} shadow-sm`
                        : isDisabled
                          ? "border-slate-200 opacity-40 cursor-not-allowed"
                          : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white ${isSelected ? colors.bg : "bg-slate-200"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 flex flex-col text-right">
                      <span className={`text-[12px] font-black ${isSelected ? colors.text : "text-slate-700"}`}>{m.label}</span>
                      <span className={`text-[10px] ${isSelected ? colors.text : "text-slate-400"} opacity-80`}>{m.sub}</span>
                    </div>
                    {isSelected && <div className={`h-2 w-2 rounded-full ${colors.bg} shrink-0`} />}
                  </button>
                );
              })}
            </div>

            {/* Payment extra fields */}
            {paymentMethod === "bank_transfer" && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">رقم الحوالة / المرجع</label>
                <input
                  type="text"
                  value={bankRef}
                  onChange={(e) => setBankRef(e.target.value)}
                  placeholder="مثلاً: TXN-98765"
                  className="w-full border border-blue-300 rounded-sm bg-blue-50 px-3 py-2 text-[12px] font-bold outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
            {paymentMethod === "future_due" && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-600">تاريخ الاستحقاق *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={docDate}
                  className="w-full border border-rose-300 rounded-sm bg-rose-50 px-3 py-2 text-[12px] font-bold outline-none focus:border-rose-500"
                />
              </div>
            )}
            {paymentMethod === "credit" && supplier && (
              <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 font-bold">
                سيتم إضافة {totals.total.toFixed(2)} ج.م لرصيد {supplier.name}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* New Supplier Modal */}
      <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="إضافة مورد جديد">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">اسم المورد / الشركة *</label>
            <input
              value={supplierDraft.name}
              onChange={(e) => setSupplierDraft(s => ({ ...s, name: e.target.value }))}
              placeholder="مثلاً: شركة التوريدات التقنية..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">رقم الهاتف</label>
            <input
              value={supplierDraft.phone}
              onChange={(e) => setSupplierDraft(s => ({ ...s, phone: e.target.value }))}
              placeholder="01..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">العنوان بالتفصيل</label>
            <input
              value={supplierDraft.address}
              onChange={(e) => setSupplierDraft(s => ({ ...s, address: e.target.value }))}
              placeholder="المدينة، المنطقة..."
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <button onClick={() => setSupplierModalOpen(false)} className="rounded-sm border border-slate-300 px-4 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50">إلغاء</button>
            <button onClick={createSupplier} className="rounded-sm bg-slate-800 px-6 py-2 text-[13px] font-black text-white hover:bg-slate-700">إنشاء وتحديد</button>
          </div>
        </div>
      </Modal>
      {/* Image Preview Modal */}
      <Modal open={imageModalOpen} onClose={() => setImageModalOpen(false)} title="معاينة صورة الصنف" size="md">
        <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-lg border border-slate-100">
          {imagePreviewUrl ? (
            <img src={imagePreviewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain rounded-md shadow-sm border border-slate-200 bg-white" />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="font-bold">الصورة غير متوفرة</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Leave Warning Modal */}
      <Modal open={warnModalOpen} onClose={() => setWarnModalOpen(false)} title="تحذير: مغادرة الصفحة" size="md">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-slate-900 mb-1">لديك أصناف غير محفوظة</h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                الانتقال إلى إعدادات المخازن الآن سيؤدي إلى <span className="text-rose-600">فقدان جميع الأصناف</span> التي تم إدراجها في الفاتورة. هل أنت متأكد أنك تريد المغادرة؟
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال الفاتورة
            </button>
            <button onClick={() => navigate("/definitions/warehouses")} className="rounded-sm bg-rose-600 px-5 py-2 text-[13px] font-black text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20">
              نعم، غادر الصفحة
            </button>
          </div>
        </div>
      </Modal>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        invoice={{
          invoice_no: refNo,
          created_at: docDate,
          supplier_name: supplier?.name,
          lines: lines.map(l => ({
            item_name: l.item_name,
            quantity: l.quantity,
            unit_price: l.unit_cost,
            discount_amount: 0,
          })),
        }}
        settings={printSettings}
        operationLabel="فاتورة مشتريات"
      />

    </div>
  );
}
