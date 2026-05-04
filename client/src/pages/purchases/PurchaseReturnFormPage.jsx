import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Search,
  ShoppingCart,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  User,
  Package,
  History,
  Info,
  ImageIcon,
  ZoomIn,
  AlertTriangle,
  Printer,
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate } from "react-router-dom";
import DataGrid from "../../components/ui/DataGrid";
import Modal from "../../components/ui/Modal";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
function resolveImageUrl(u) {
  if (!u) return null;
  if (u.startsWith("http") || u.startsWith("data:")) return u;
  return `${BASE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const [purchaseId, setPurchaseId] = useState("");
  const [purchase, setPurchase] = useState(null);
  const [returnLines, setReturnLines] = useState({}); // line_id -> quantity
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState("");
  const [settlementType, setSettlementType] = useState("account");
  const [items, setItems] = useState([]);
  
  const [printPreview, setPrintPreview] = useState(false);
  const [warnModalOpen, setWarnModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const inputRef = useRef(null);

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
    api.get("/api/items").then(r => setItems(r.data.data || [])).catch(() => {});
  }, []);

  async function handleSearch() {
    if (!purchaseId.trim()) return;
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const response = await api.get(`/api/purchases/${purchaseId}`);
      setPurchase(response.data.data);
      setReturnLines({});
      setSettlementType("account");
    } catch (e) {
      setMessage({ text: "رقم الفاتورة غير صحيح أو غير موجود", type: "error" });
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }

  function updateQty(lineId, val, max) {
    const q = Math.min(max, Math.max(0, Number(val)));
    setReturnLines(prev => ({ ...prev, [lineId]: q }));
  }

  const totals = useMemo(() => {
    if (!purchase) return 0;
    return (purchase.lines || []).reduce((acc, l) => {
      const q = returnLines[l.id] || 0;
      return acc + (q * l.unit_cost);
    }, 0);
  }, [purchase, returnLines]);

  async function handleSave() {
    const payloadLines = Object.entries(returnLines)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ purchase_line_id: Number(id), quantity: q }));

    if (!payloadLines.length) {
      setMessage({ text: "يرجى تحديد الكميات المراد إرجاعها", type: "error" });
      return;
    }
    if (settlementType === "cash" && !selectedTreasury) {
      setMessage({ text: "اختر الخزنة التي سيدخل فيها النقد المسترد", type: "error" });
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/api/purchases/${purchaseId}/return`, {
        warehouse_id: Number(selectedWarehouse),
        settlement_type: settlementType,
        treasury_id: settlementType === "cash" ? Number(selectedTreasury) : null,
        lines: payloadLines
      });
      setMessage({ text: "تم تسجيل المرتجع بنجاح", type: "success" });
      setTimeout(() => navigate("/purchases/returns"), 1500);
    } catch (e) {
      setMessage({ text: "فشل تسجيل المرتجع", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col bg-slate-50 font-sans overflow-hidden px-4 lg:px-8 pb-6">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (Object.keys(returnLines).some(k => returnLines[k] > 0)) setWarnModalOpen(true);
              else navigate("/purchases/returns");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">إنشاء مرتجع شراء</h1>
            <span className="text-[10px] font-bold text-slate-400">إرجاع أصناف إلى المورد وتسويه الحساب</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {message.text && (
            <div className={`rounded-sm px-3 py-1.5 text-[11px] font-bold ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
              {message.text}
            </div>
          )}
          <button
            onClick={() => setPrintPreview(true)}
            disabled={!purchase}
            className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            <Printer className="h-4 w-4" /> طباعة ومراجعة المستند
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !purchase}
            className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {isSaving ? "جاري الحفظ..." : "تأكيد المرتجع"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        {/* Search Section */}
        <section className="mb-4 rounded-md border border-slate-300 bg-white p-4 shadow-sm">
           <div className="flex items-end gap-4 max-w-2xl">
              <div className="flex-1 flex flex-col gap-1">
                 <label className="text-[11px] font-bold text-slate-600">رقم فاتورة الشراء الأصلية</label>
                 <div className="relative">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input 
                      ref={inputRef}
                      autoFocus
                      type="text" 
                      value={purchaseId}
                      onChange={(e) => setPurchaseId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={e => e.target.select()}
                      placeholder="مثال: 123"
                      className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-10 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                    />
                 </div>
              </div>
              <button 
                onClick={handleSearch}
                disabled={loading}
                className="h-[37px] rounded-sm bg-slate-100 px-8 text-[12px] font-black text-slate-800 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                {loading ? "جاري البحث..." : "بحث وتحميل الفاتورة"}
              </button>
           </div>
        </section>

        {purchase ? (
           <div className="flex flex-1 min-h-0 gap-4">
              {/* Lines Grid area */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-300 bg-white min-h-0">
                <DataGrid
                  data={purchase.lines || []}
                  rowKey="id"
                  emptyMessage="لا يوجد أصناف"
                  className="border-0"
                  containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                  columns={[
                    {
                      id: "index", header: "#", width: 40, sortable: false, headerClass: "text-center", cellClass: "text-center font-mono text-[12px] text-slate-400 border-l border-slate-100",
                      render: (_, i) => i + 1
                    },
                    {
                      id: "code", header: "الكود", width: 100, sortable: true, headerClass: "text-center", cellClass: "font-mono text-[12px] font-black tracking-wider text-slate-500 border-l border-slate-100 text-center",
                      render: (l) => l.barcode || l.code || l.item_code || "-"
                    },
                    {
                      id: "item_name", header: "الصنف", width: 220, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-2", headerClass: "text-right px-2",
                      render: (l) => {
                        const item = items.find(i => i.id === l.item_id);
                        const imgUrl = item?.primary_image_url || item?.image_url || item?.image;
                        return (
                          <div className="flex items-center gap-2 py-1">
                            {imgUrl ? (
                              <button onClick={() => { setImagePreviewUrl(resolveImageUrl(imgUrl)); setImageModalOpen(true); }} className="shrink-0 group relative rounded-md overflow-hidden border border-slate-200">
                                <img src={resolveImageUrl(imgUrl)} alt={l.item_name} className="w-8 h-8 object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ZoomIn className="w-4 h-4 text-white" />
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
                      id: "quantity", header: "المشترى", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-400 border-l border-slate-100",
                      render: (l) => Number(l.quantity)
                    },
                    {
                      id: "unit_cost", header: "السعر", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-500 border-l border-slate-100",
                      render: (l) => formatMoney(l.unit_cost)
                    },
                    {
                      id: "returnQty", header: "الكمية المرتجعة", width: 120, sortable: false, headerClass: "text-center", cellClass: "p-0 border-l border-slate-100 text-center",
                      render: (l) => (
                        <div className="flex w-full h-[40px] items-center justify-center bg-slate-50">
                          <input 
                            type="number" 
                            min="0" 
                            max={l.quantity}
                            value={returnLines[l.id] || ""}
                            onChange={(e) => updateQty(l.id, e.target.value, l.quantity)}
                            onFocus={e => e.target.select()}
                            className="w-full h-full text-center font-mono text-[14px] font-black outline-none border border-transparent focus:border-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-100 transition-all text-slate-900"
                          />
                        </div>
                      )
                    },
                    {
                      id: "total", header: "قيمة المرتجع", width: 140, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-slate-900 bg-slate-50/30 border-l-0",
                      sortValue: (l) => (returnLines[l.id] || 0) * l.unit_cost,
                      render: (l) => formatMoney((returnLines[l.id] || 0) * l.unit_cost)
                    }
                  ]}
                />
                <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-900 px-6 py-4 shadow-lg z-10 text-white">
                   <div className="flex items-center gap-6 opacity-80">
                      <p className="text-[12px] font-black uppercase tracking-widest">إجمالي المرتجع</p>
                   </div>
                   <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-black font-mono">{totals.toLocaleString("ar-EG", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[12px] font-black opacity-50 uppercase">ج.م</span>
                   </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <aside className="w-[320px] flex flex-col gap-4">
                 <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-[12px] font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest">بيانات الفاتورة الأصلية</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400">التاريخ:</span>
                          <span className="text-[11px] font-black text-slate-700">{new Date(purchase.created_at).toLocaleDateString("ar-EG")}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400">المورد:</span>
                          <span className="text-[11px] font-black text-slate-700">مورد #{purchase.supplier_id}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400">إجمالي الفاتورة:</span>
                          <span className="text-[11px] font-black text-slate-700">{formatMoney(purchase.total)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-[12px] font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest">خيارات المرتجع</h3>
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">المخزن المراد الخصم منه</label>
                          <select 
                            size={4}
                            value={selectedWarehouse} 
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="w-full border border-slate-300 rounded-sm bg-slate-50 py-1 px-1 text-[11px] font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 overflow-y-auto custom-scrollbar h-[120px] transition-all shadow-sm focus:shadow-xl"
                          >
                            {warehouses.map(w => <option key={w.id} value={w.id} className="py-1 px-2 border-b border-slate-100 last:border-0 rounded-sm cursor-pointer hover:bg-slate-200">{w.name}</option>)}
                          </select>
                       </div>
                       <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-slate-600">كيف سيتم تسوية المرتجع؟</label>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => setSettlementType("account")}
                              className={`rounded-sm border p-3 text-right transition-all ${settlementType === "account" ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}
                            >
                              <div className="text-[12px] font-black">خصم من حساب المورد</div>
                              <div className={`mt-1 text-[10px] font-bold leading-relaxed ${settlementType === "account" ? "text-slate-200" : "text-slate-500"}`}>
                                يقل دين المورد ولا يدخل نقد إلى الخزنة.
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSettlementType("cash")}
                              className={`rounded-sm border p-3 text-right transition-all ${settlementType === "cash" ? "border-emerald-700 bg-emerald-700 text-white shadow-sm" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"}`}
                            >
                              <div className="text-[12px] font-black">استرداد نقدي من المورد</div>
                              <div className={`mt-1 text-[10px] font-bold leading-relaxed ${settlementType === "cash" ? "text-emerald-50" : "text-slate-500"}`}>
                                يدخل مبلغ المرتجع كاش في الخزنة.
                              </div>
                            </button>
                          </div>
                       </div>
                       {settlementType === "cash" && (
                         <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-slate-600">الخزنة التي سيدخل فيها النقد</label>
                            <select
                              value={selectedTreasury}
                              onChange={(e) => setSelectedTreasury(e.target.value)}
                              className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-[12px] font-bold text-slate-800 outline-none focus:border-emerald-600"
                            >
                              {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col justify-end">
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-4 mb-4">
                       <div className="flex gap-3">
                          <Info className="h-5 w-5 text-amber-600 shrink-0" />
                          <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                            {settlementType === "cash"
                              ? "تنبيه: سيتم إدخال قيمة المرتجع في الخزنة المحددة وتحديث أرصدة الأصناف، ولن يتم خصمها من حساب المورد."
                              : "تنبيه: سيتم خصم إجمالي المرتجع من مديونية المورد وتحديث أرصدة الأصناف، ولن يدخل أي نقد إلى الخزنة."}
                          </p>
                       </div>
                    </div>
                    <button 
                      onClick={handleSave}
                      className="w-full rounded-sm bg-slate-800 py-4 text-[14px] font-black text-white hover:bg-slate-700 shadow-lg"
                    >
                      تنفيذ المرتجع الآن
                    </button>
                 </div>
              </aside>
           </div>
        ) : (
           <div className="flex flex-1 flex-col items-center justify-center text-slate-300">
              <History className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-[16px] font-black">ابحث عن فاتورة للبدء</p>
              <p className="text-[11px] font-bold opacity-60">أدخل رقم فاتورة الشراء لتحميل بيانات الأصناف المتاحة للإرجاع</p>
           </div>
        )}
      </main>
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
              <h3 className="text-[14px] font-black text-slate-900 mb-1">تجاهل المرتجع؟</h3>
              <p className="text-[12px] font-bold text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك في المغادرة؟ سيتم <span className="text-rose-600">إلغاء المرتجع</span> الذي تقوم بإعداده ولن يتم حفظه.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => setWarnModalOpen(false)} className="rounded-sm border border-slate-300 bg-white px-5 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50">
              تراجع وإكمال المرتجع
            </button>
            <button onClick={() => navigate("/purchases/returns")} className="rounded-sm bg-rose-600 px-5 py-2 text-[13px] font-black text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20">
              نعم، تجاهل ومغادرة
            </button>
          </div>
        </div>
      </Modal>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        invoice={{
          invoice_no: purchase?.id ? `PRET-${purchase.id}` : "",
          created_at: new Date().toISOString().split("T")[0],
          supplier_name: purchase?.supplier_name,
          lines: (purchase?.lines || [])
            .filter(l => returnLines[l.id] > 0)
            .map(l => ({
              item_name: l.item_name,
              quantity: returnLines[l.id] || 0,
              unit_price: l.unit_cost,
              discount_amount: 0,
            })),
        }}
        settings={{}}
        operationLabel="إشعار مرتجع مشتريات"
      />

    </div>
  );
}
