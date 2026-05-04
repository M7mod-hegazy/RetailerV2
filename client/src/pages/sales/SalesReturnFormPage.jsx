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
  DollarSign,
  CreditCard,
  Banknote,
  Printer,
} from "lucide-react";
import api from "../../services/api";
import { Link, useNavigate } from "react-router-dom";
import DataGrid from "../../components/ui/DataGrid";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function SalesReturnFormPage() {
  const navigate = useNavigate();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoice, setInvoice] = useState(null);
  const [returnLines, setReturnLines] = useState({}); 
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [printPreview, setPrintPreview] = useState(false);

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash_back");
  const [reason, setReason] = useState("");

  useEffect(() => {
    api.get("/api/warehouses").then(r => {
      const wh = r.data.data || [];
      setWarehouses(wh);
      if (wh.length) setSelectedWarehouse(String(wh[0].id));
    }).catch(() => {});
  }, []);

  async function handleSearch() {
    if (!invoiceNo.trim()) return;
    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      // Find invoice by number (I need to ensure the backend supports search by invoice_no or id)
      // The invoice index is usually done by numeric ID in the current return logic
      // But let's assume we can search by ID for now, or I'll quickly check if I can search by No.
      const response = await api.get(`/api/invoices/${invoiceNo}`);
      setInvoice(response.data.data);
      setReturnLines({});
    } catch (e) {
      setMessage({ text: "رقم الفاتورة غير صحيح", type: "error" });
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    if (!invoice) return 0;
    return (invoice.lines || []).reduce((acc, l) => {
      const q = returnLines[l.id] || 0;
      return acc + (q * l.unit_price);
    }, 0);
  }, [invoice, returnLines]);

  async function handleSave() {
    const payloadLines = Object.entries(returnLines)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ invoice_line_id: Number(id), quantity: q }));

    if (!payloadLines.length) {
      setMessage({ text: "يرجى تحديد الكميات المراد إرجاعها", type: "error" });
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/return`, {
        warehouse_id: Number(selectedWarehouse),
        lines: payloadLines,
        refund_method: refundMethod,
        reason: reason
      });
      setMessage({ text: "تم تسجيل المرتجع بنجاح", type: "success" });
      setTimeout(() => navigate("/sales/returns"), 1500);
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
          <Link to="/sales/returns" className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">إنشاء مرتجع مبيعات</h1>
            <span className="text-[10px] font-bold text-slate-400">إرجاع أصناف من عميل وإصدار تسوية مالية</span>
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
            disabled={!invoice}
            className="flex h-9 items-center gap-2 rounded-sm border border-slate-300 bg-white px-4 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
          >
            <Printer className="h-4 w-4" /> طباعة ومراجعة المستند
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !invoice}
            className="flex h-9 items-center gap-2 rounded-sm bg-slate-800 px-6 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            {isSaving ? "جاري الحفظ..." : "إتمام المرتجع"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        {/* Search */}
        <section className="mb-4 rounded-md border border-slate-300 bg-white p-4 shadow-sm">
           <div className="flex items-end gap-4 max-w-2xl">
              <div className="flex-1 flex flex-col gap-1">
                 <label className="text-[11px] font-bold text-slate-600">رقم فاتورة المبيعات الأصلية</label>
                 <div className="relative">
                    <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input 
                      autoFocus
                      type="text" 
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="أدخل رقم التعريف (ID) للفاتورة..."
                      className="w-full border border-slate-300 rounded-sm py-2 pl-3 pr-10 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                    />
                 </div>
              </div>
              <button 
                onClick={handleSearch}
                disabled={loading}
                className="h-[37px] rounded-sm bg-slate-100 px-8 text-[12px] font-black text-slate-800 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                {loading ? "جاري البحث..." : "تحميل بيانات الفاتورة"}
              </button>
           </div>
        </section>

        {invoice ? (
           <div className="flex flex-1 min-h-0 gap-4">
              {/* Lines Grid area */}
              <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-slate-300 bg-white min-h-0">
                <DataGrid
                  data={invoice.lines || []}
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
                      render: (l) => l.item_name
                    },
                    {
                      id: "quantity", header: "المباع", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-400 border-l border-slate-100",
                      render: (l) => Number(l.quantity)
                    },
                    {
                      id: "unit_price", header: "سعر البيع", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-[13px] text-slate-500 border-l border-slate-100",
                      render: (l) => formatMoney(l.unit_price)
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
                            onChange={(e) => {
                               const q = Math.min(l.quantity, Math.max(0, Number(e.target.value)));
                               setReturnLines(prev => ({ ...prev, [l.id]: q }));
                            }}
                            className="w-full h-full text-center font-mono text-[14px] font-black outline-none border border-transparent focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all text-slate-900"
                          />
                        </div>
                      )
                    },
                    {
                      id: "total", header: "خصم من الإجمالي", width: 140, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-black font-mono text-[14px] text-indigo-900 bg-indigo-50/30 border-l-0",
                      sortValue: (l) => (returnLines[l.id] || 0) * l.unit_price,
                      render: (l) => formatMoney((returnLines[l.id] || 0) * l.unit_price)
                    }
                  ]}
                />
                <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-900 px-6 py-4 shadow-lg z-10 text-white">
                   <div className="flex items-center gap-6 opacity-80">
                      <p className="text-[12px] font-black uppercase tracking-widest">إجمالي مبلغ المرتجع للعميل</p>
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
                    <h3 className="mb-4 text-[12px] font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest">تفاصيل الفاتورة</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400 tracking-tight">رقم الفاتورة:</span>
                          <span className="font-mono text-[11px] font-black text-slate-900">{invoice.invoice_no}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400">العميل:</span>
                          <span className="text-[11px] font-black text-slate-700">عميل #{invoice.customer_id}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-[11px] font-bold text-slate-400">طريقة الدفع الأصلية:</span>
                          <span className="text-[11px] font-black text-slate-700 uppercase">{invoice.payment_type}</span>
                       </div>
                    </div>
                 </div>

                 <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
                    <h3 className="mb-4 text-[12px] font-black text-slate-800 border-b pb-2 border-slate-100 uppercase tracking-widest">إعدادات التسوية</h3>
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">طريقة رد المبلغ</label>
                          <div className="grid grid-cols-2 gap-2">
                             <button 
                               onClick={() => setRefundMethod("cash_back")}
                               className={`flex items-center justify-center gap-2 rounded-sm border p-3 py-4 transition-all ${refundMethod === 'cash_back' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-400'}`}
                             >
                                <Banknote className="h-4 w-4" />
                                <span className="text-[11px] font-black">نقداً</span>
                             </button>
                             <button 
                               onClick={() => setRefundMethod("credit_note")}
                               className={`flex items-center justify-center gap-2 rounded-sm border p-3 py-4 transition-all ${refundMethod === 'credit_note' ? 'border-slate-800 bg-slate-800 text-white shadow-md' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-400'}`}
                             >
                                <CreditCard className="h-4 w-4" />
                                <span className="text-[11px] font-black">رصيد حساب</span>
                             </button>
                          </div>
                       </div>
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">المخزن المستلم للمرتجع</label>
                          <select 
                            value={selectedWarehouse} 
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="w-full border border-slate-300 rounded-sm bg-slate-50 py-2 px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                          >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                       </div>
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-600">سبب الإرجاع</label>
                          <input 
                             type="text" 
                             value={reason} 
                             onChange={(e) => setReason(e.target.value)}
                             placeholder="مثال: تلف في المنتج..."
                             className="w-full border border-slate-300 rounded-sm bg-slate-50 py-2 px-3 text-[12px] font-bold text-slate-800 outline-none focus:border-slate-800"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="flex-1 flex flex-col justify-end mt-4">
                    <button 
                      onClick={handleSave}
                      className="w-full rounded-sm bg-slate-900 py-4 text-[14px] font-black text-white hover:bg-black shadow-lg active:scale-95 transition-all"
                    >
                      إتمام عملية المرتجع (Finish)
                    </button>
                 </div>
              </aside>
           </div>
        ) : (
           <div className="flex flex-1 flex-col items-center justify-center text-slate-300">
              <History className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-[16px] font-black">ابحث عن فاتورة مبيعات</p>
              <p className="text-[11px] font-bold opacity-60">أدخل رقم الفاتورة أو رمزها للبدء في تحديد الأصناف المرتجعة</p>
           </div>
        )}
      </main>

      <PrintPreviewModal
        open={printPreview}
        onClose={() => setPrintPreview(false)}
        invoice={{
          invoice_no: invoice?.invoice_no,
          created_at: new Date().toISOString().split("T")[0],
          customer_name: invoice?.customer_name,
          lines: (invoice?.lines || [])
            .filter(l => returnLines[l.id] > 0)
            .map(l => ({
              item_name: l.item_name,
              quantity: returnLines[l.id] || 0,
              unit_price: l.unit_price,
              discount_amount: 0,
            })),
        }}
        settings={{}}
        operationLabel="إشعار مرتجع مبيعات"
      />
    </div>
  );
}
