import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Trash2, Plus, Minus, History, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../services/api";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const editReturnId = location.state?.edit_return_id || null;
  const isEditMode = !!editReturnId;

  const [rightPanel, setRightPanel] = useState("products");
  const [cart, setCart] = useState([]);
  const [loadedPurchase, setLoadedPurchase] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [settlementType, setSettlementType] = useState("account");
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseResults, setPurchaseResults] = useState([]);
  const [purchaseSearchLoading, setPurchaseSearchLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [originalDocNo, setOriginalDocNo] = useState(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState(null);

  const purchaseSearchRef = useRef(null);

  const total = useMemo(() => cart.reduce((acc, l) => acc + (l.unit_cost * l.quantity), 0), [cart]);

  // Load warehouses, treasuries, suppliers
  useEffect(() => {
    api.get("/api/warehouses").then(r => {
      const wh = r.data.data || [];
      setWarehouses(wh);
      if (wh.length) setSelectedWarehouse(String(wh[0].id));
    }).catch(() => {});
    api.get("/api/treasuries").then(r => {
      const rows = r.data.data || [];
      setTreasuries(rows);
      if (rows.length) setSelectedTreasury(String(rows[0].id));
    }).catch(() => {});
    api.get("/api/suppliers?limit=500").then(r => setSuppliers(r.data.data || [])).catch(() => {});
  }, []);

  // Load existing return for edit mode
  useEffect(() => {
    if (!isEditMode) return;
    api.get(`/api/purchases/returns/${editReturnId}`).then(r => {
      const pr = r.data.data;
      setOriginalDocNo(pr.doc_no);
      setOriginalCreatedAt(pr.created_at);
      setSettlementType(pr.settlement_type || "account");
      if (pr.warehouse_id) setSelectedWarehouse(String(pr.warehouse_id));
      if (pr.treasury_id) setSelectedTreasury(String(pr.treasury_id));
      if (pr.supplier_id) setSupplier({ id: pr.supplier_id, name: pr.supplier_name || String(pr.supplier_id) });
      setCart((pr.lines || []).map((l, idx) => ({
        key: `edit-${l.id || idx}`,
        purchase_line_id: l.purchase_line_id || null,
        item_id: l.item_id,
        item_name: l.item_name || l.item_name_ar,
        unit_cost: Number(l.unit_cost || 0),
        quantity: Number(l.quantity),
        max_qty: Number(l.quantity),
      })));
      if (pr.purchase_id) {
        api.get(`/api/purchases/${pr.purchase_id}`).then(p => setLoadedPurchase(p.data.data)).catch(() => {});
      }
    }).catch(() => {});
  }, [isEditMode, editReturnId]);

  // Product search debounce
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/items?search=${encodeURIComponent(productSearch)}&limit=20`)
        .then(r => setProductResults(r.data.data || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  async function handlePurchaseSearch() {
    if (!purchaseSearch.trim()) return;
    setPurchaseSearchLoading(true);
    try {
      const byId = purchaseSearch.match(/^\d+$/)
        ? await api.get(`/api/purchases/${purchaseSearch}`).then(r => r.data.data ? [r.data.data] : []).catch(() => [])
        : [];
      const bySearch = await api.get(`/api/purchases?search=${encodeURIComponent(purchaseSearch)}&limit=20`)
        .then(r => r.data.data || []).catch(() => []);
      const merged = [...byId, ...bySearch.filter(p => !byId.find(x => x.id === p.id))];
      setPurchaseResults(merged.filter(p => p && p.status !== "cancelled" && p.status !== "voided" && !p.amended_by));
    } finally {
      setPurchaseSearchLoading(false);
    }
  }

  function loadPurchase(p) {
    setLoadedPurchase(p);
    setCart((p.lines || []).map(l => ({
      key: `pur-${l.id}`,
      purchase_line_id: l.id,
      item_id: l.item_id,
      item_name: l.item_name || l.name,
      unit_cost: Number(l.unit_cost || 0),
      quantity: Number(l.returnable_quantity ?? l.quantity),
      max_qty: Math.max(0, Number(l.returnable_quantity ?? l.quantity)),
    })).filter(l => l.max_qty > 0));
    if (p.supplier_id) setSupplier({ id: p.supplier_id, name: p.supplier_name || String(p.supplier_id) });
    setRightPanel("products");
    setPurchaseResults([]);
    setPurchaseSearch("");
  }

  function addProductToCart(item) {
    setCart(prev => {
      const existing = prev.find(l => l.item_id === item.id && !l.purchase_line_id);
      if (existing) return prev.map(l => l === existing ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, {
        key: `direct-${item.id}-${Date.now()}`,
        item_id: item.id,
        item_name: item.name,
        unit_cost: Number(item.cost || item.last_purchase_price || 0),
        quantity: 1,
        max_qty: Infinity,
        purchase_line_id: null,
      }];
    });
    setProductSearch("");
    setProductResults([]);
  }

  function updateQty(key, delta) {
    setCart(prev => prev
      .map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, Math.min(l.max_qty, l.quantity + delta)) })
      .filter(l => l.quantity > 0));
  }

  function setQty(key, val) {
    setCart(prev => prev
      .map(l => l.key !== key ? l : { ...l, quantity: Math.max(0, Math.min(l.max_qty, Number(val) || 0)) })
      .filter(l => l.quantity > 0));
  }

  function removeLine(key) { setCart(prev => prev.filter(l => l.key !== key)); }

  async function handleSave() {
    if (!cart.length) { setMessage({ text: "أضف أصناف للمرتجع أولاً", type: "error" }); return; }
    setIsSaving(true);
    setMessage({ text: "", type: "" });
    try {
      const payload = {
        supplier_id: supplier?.id || null,
        warehouse_id: Number(selectedWarehouse),
        settlement_type: settlementType,
        treasury_id: settlementType === "cash" ? Number(selectedTreasury) : null,
        lines: cart.map(l => ({
          purchase_line_id: l.purchase_line_id || null,
          item_id: l.item_id,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
        })),
      };
      if (isEditMode) {
        await api.put(`/api/purchases/returns/${editReturnId}`, payload);
        setMessage({ text: "تم تعديل المرتجع بنجاح", type: "success" });
      } else if (loadedPurchase) {
        await api.post(`/api/purchases/${loadedPurchase.id}/return`, payload);
        setMessage({ text: "تم تسجيل المرتجع بنجاح", type: "success" });
      } else {
        await api.post("/api/purchases/general-purchase-return", payload);
        setMessage({ text: "تم تسجيل المرتجع العام بنجاح", type: "success" });
      }
      setTimeout(() => navigate("/purchases/returns"), 1500);
    } catch (e) {
      setMessage({ text: e.response?.data?.message || "فشل تسجيل المرتجع", type: "error" });
    } finally { setIsSaving(false); }
  }

  return (
    <div className="flex h-screen flex-col bg-amber-50/30 font-sans overflow-hidden" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-amber-200 bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/purchases/returns")}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">
              {isEditMode ? "تعديل مرتجع مشتريات" : loadedPurchase ? `مرتجع فاتورة شراء #${loadedPurchase.id}` : "مرتجع مشتريات جديد"}
            </h1>
            <span className="text-[10px] font-bold text-amber-600">
              {isEditMode
                ? `${originalDocNo || ""} · ${originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""}`
                : loadedPurchase ? `${loadedPurchase.supplier_name || "بدون مورد"} · ${formatMoney(loadedPurchase.total)} ج.م`
                : "أضف أصناف مباشرة أو ابحث عن فاتورة شراء"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-bold border ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {message.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {message.text}
            </div>
          )}
          {isEditMode && (
            <div className="flex gap-1.5">
              <input disabled value={originalDocNo || ""}
                className="h-8 w-28 rounded-sm border border-amber-200 bg-amber-50 px-2 text-[11px] font-mono font-black text-amber-600 cursor-not-allowed outline-none" />
              <input disabled value={originalCreatedAt ? new Date(originalCreatedAt).toLocaleString("ar-EG") : ""}
                className="h-8 w-48 rounded-sm border border-amber-200 bg-amber-50 px-2 text-[11px] font-mono font-black text-amber-600 cursor-not-allowed outline-none" />
            </div>
          )}
          <button onClick={handleSave} disabled={isSaving || !cart.length}
            className="flex h-9 items-center gap-2 rounded-sm bg-amber-600 px-6 text-[13px] font-black text-white hover:bg-amber-500 disabled:opacity-40 transition-all active:scale-95 shadow-sm">
            {isSaving ? "جاري الحفظ..." : isEditMode ? "تأكيد التعديل" : "تأكيد المرتجع"}
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Cart ─────────────────────────────────────────────── */}
        <div className="flex flex-col w-[400px] shrink-0 border-l border-amber-200 bg-white shadow-sm">

          {/* Settings */}
          <div className="border-b border-amber-100 p-4 space-y-3 bg-amber-50/50">
            {/* Supplier */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest">المورد</label>
              <select
                value={supplier?.id || ""}
                onChange={e => setSupplier(suppliers.find(s => String(s.id) === e.target.value) || null)}
                className="w-full border border-amber-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 bg-white"
              >
                <option value="">بدون مورد</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Settlement type */}
            <div className="flex gap-2">
              <button onClick={() => setSettlementType("account")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${
                  settlementType === "account"
                    ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
                }`}>
                خصم من حساب المورد
              </button>
              <button onClick={() => setSettlementType("cash")}
                className={`flex-1 rounded-sm border py-2 text-[11px] font-black transition-all ${
                  settlementType === "cash"
                    ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
                }`}>
                نقداً
              </button>
            </div>

            {/* Treasury (cash only) */}
            {settlementType === "cash" && (
              <select value={selectedTreasury} onChange={e => setSelectedTreasury(e.target.value)}
                className="w-full border border-amber-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 bg-white">
                {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {/* Warehouse */}
            <select value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}
              className="w-full border border-amber-200 rounded-sm px-2 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-amber-500 bg-white">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Cart lines */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-300">
                <RotateCcw className="h-8 w-8" />
                <span className="text-[12px] font-bold">لا يوجد أصناف بعد</span>
                <span className="text-[11px]">أضف صنفاً أو حمّل فاتورة شراء من اليمين</span>
              </div>
            ) : cart.map(line => (
              <div key={line.key} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 hover:bg-amber-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-slate-800 truncate">{line.item_name}</div>
                  <div className="text-[11px] font-bold text-amber-600 font-mono">
                    {formatMoney(line.unit_cost)} × {line.quantity} = {formatMoney(line.unit_cost * line.quantity)} ج.م
                  </div>
                  {line.max_qty !== Infinity && (
                    <div className="text-[10px] font-bold text-slate-400">الحد الأقصى: {line.max_qty}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(line.key, -1)}
                    className="h-6 w-6 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-90 transition-all">
                    <Minus className="h-3 w-3" />
                  </button>
                  <input type="number" value={line.quantity}
                    onChange={e => setQty(line.key, e.target.value)}
                    onFocus={e => e.target.select()}
                    className="w-11 h-6 text-center font-mono font-black text-[12px] border border-amber-200 rounded-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200" />
                  <button onClick={() => updateQty(line.key, 1)}
                    disabled={line.max_qty !== Infinity && line.quantity >= line.max_qty}
                    className="h-6 w-6 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 active:scale-90 transition-all disabled:opacity-30">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => removeLine(line.key)}
                  className="h-6 w-6 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-sm transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-amber-700 px-5 py-4 shrink-0">
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">إجمالي المرتجع</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-black font-mono text-white">{formatMoney(total)}</span>
              <span className="text-[11px] font-black text-amber-400">ج.م</span>
            </div>
          </div>
        </div>

        {/* ── Right: Panel ───────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-h-0">

          {/* Toggle bar */}
          <div className="flex items-center gap-2 border-b border-amber-200 bg-white px-4 py-2.5 shrink-0">
            <button onClick={() => setRightPanel("products")}
              className={`px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${
                rightPanel === "products"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-300"
              }`}>
              إضافة صنف مباشر
            </button>
            <button onClick={() => { setRightPanel("search"); setTimeout(() => purchaseSearchRef.current?.focus(), 50); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-[12px] font-black border transition-all ${
                rightPanel === "search"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-300"
              }`}>
              <History className="h-3.5 w-3.5" /> بحث في فواتير الشراء
            </button>
            {loadedPurchase && (
              <span className="mr-auto text-[11px] font-black text-amber-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> مرتبط بفاتورة شراء #{loadedPurchase.id}
              </span>
            )}
          </div>

          {rightPanel === "products" ? (
            /* Product search */
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                <input
                  autoFocus
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الباركود أو الكود..."
                  className="w-full border border-amber-200 rounded-sm py-2.5 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 bg-white shadow-sm"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {productResults.map(item => (
                  <button key={item.id} onClick={() => addProductToCart(item)}
                    className="w-full flex items-center justify-between rounded-sm border border-slate-200 bg-white px-4 py-3 text-right hover:border-amber-400 hover:bg-amber-50/50 transition-all active:scale-[0.99] shadow-sm">
                    <div>
                      <div className="text-[13px] font-black text-slate-800">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.barcode || item.code || "—"}</div>
                    </div>
                    <div className="text-[13px] font-black text-amber-700 font-mono">{formatMoney(item.cost || 0)} ج.م</div>
                  </button>
                ))}
                {productSearch && productResults.length === 0 && (
                  <div className="flex items-center justify-center py-10 text-slate-400 text-[12px] font-bold">لا توجد نتائج</div>
                )}
              </div>
            </div>
          ) : (
            /* Purchase search */
            <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                  <input
                    ref={purchaseSearchRef}
                    value={purchaseSearch}
                    onChange={e => setPurchaseSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handlePurchaseSearch()}
                    placeholder="رقم فاتورة الشراء أو اسم المورد..."
                    className="w-full border border-amber-200 rounded-sm py-2.5 pr-10 pl-3 text-[13px] font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 bg-white shadow-sm"
                  />
                </div>
                <button onClick={handlePurchaseSearch} disabled={purchaseSearchLoading}
                  className="px-5 rounded-sm bg-amber-600 text-white text-[12px] font-black hover:bg-amber-500 disabled:opacity-60 transition-all active:scale-95 shadow-sm">
                  {purchaseSearchLoading ? "..." : "بحث"}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {purchaseResults.map(p => (
                  <div key={p.id} className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[14px] font-black text-slate-800">فاتورة شراء #{p.id}</span>
                        <span className="mr-2 text-[11px] font-bold text-slate-400">{new Date(p.created_at).toLocaleDateString("ar-EG")}</span>
                        {p.doc_no && (
                          <span className="mr-1 text-[10px] font-mono text-slate-400">{p.doc_no}</span>
                        )}
                      </div>
                      <button onClick={() => loadPurchase(p)}
                        className="px-4 py-1.5 rounded-sm bg-amber-600 text-white text-[11px] font-black hover:bg-amber-500 active:scale-95 transition-all">
                        تحميل وإرجاع
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                      <span>{p.supplier_name || "بدون مورد"}</span>
                      <span>·</span>
                      <span className="font-mono text-amber-700">{formatMoney(p.total)} ج.م</span>
                      <span>·</span>
                      <span>{(p.lines || []).length} أصناف</span>
                    </div>
                  </div>
                ))}
                {purchaseSearch && !purchaseSearchLoading && purchaseResults.length === 0 && (
                  <div className="flex items-center justify-center py-10 text-slate-400 text-[12px] font-bold">لا توجد نتائج — جرب رقم الفاتورة مباشرة</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
