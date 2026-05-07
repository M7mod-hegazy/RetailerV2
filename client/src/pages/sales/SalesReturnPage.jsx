import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  ArrowRightLeft, Plus, Calendar, User, DollarSign,
  MoreVertical, Download, Eye, Search, X, Filter,
  RotateCcw, TrendingDown, Printer, BadgeCheck, Pencil, FileX, ExternalLink
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import QuickReturnModal from "../../components/returns/QuickReturnModal";
import DataGrid from "../../components/ui/DataGrid";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import SearchInput from "../../components/ui/SearchInput";
import { adaptForServer } from "../../utils/search";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import TodayInvoicesButton from "../../components/pos/TodayInvoicesButton";
import { useNavigate } from "react-router-dom";

const REASON_LABELS = {
  changed_mind: "غيّر رأيه",
  defective: "عيب في المنتج",
  wrong_item: "صنف خاطئ",
  damaged: "تالف",
  other: "أخرى",
};
const REFUND_LABELS = {
  cash_back: "نقدي",
  credit_note: "رصيد",
};
const REASON_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981"];

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(d));
}

export default function SalesReturnPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReturn, setActiveReturn] = useState(null);
  const [modalDetailOpen, setModalDetailOpen] = useState(false);
  const [quickReturnOpen, setQuickReturnOpen] = useState(false);
  const [generalReturnOpen, setGeneralReturnOpen] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const response = await api.get(`/api/invoices/returns?${params}`);
      setRows(response.data.data || []);
    } catch {
      toast.error("فشل تحميل البيانات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo]);

  async function handleShowDetail(id) {
    try {
      const response = await api.get(`/api/invoices/returns/${id}`);
      setActiveReturn(response.data.data);
      setModalDetailOpen(true);
    } catch { toast.error("حدث خطأ في تحميل التفاصيل"); }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    try {
      await api.post(`/api/invoices/returns/${cancelId}/cancel`, { reason: cancelReason });
      toast.success("تم إلغاء المرتجع");
      setCancelId(null);
      setCancelReason("");
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.message || "فشل الإلغاء");
    }
  }

  function clearFilters() {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilters = searchTerm || dateFrom || dateTo;

  const stats = useMemo(() => {
    const totalValue = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    // Reason breakdown for chart
    const reasonMap = {};
    rows.forEach(r => {
      const label = REASON_LABELS[r.reason] || "غير محدد";
      reasonMap[label] = (reasonMap[label] || 0) + 1;
    });
    const reasonData = Object.entries(reasonMap).map(([name, value]) => ({ name, value }));
    return { count: rows.length, totalValue, reasonData };
  }, [rows]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg bg-slate-800 px-3 py-2 text-white text-[11px] font-bold shadow-xl">
        {payload[0].name}: {payload[0].value}
      </div>
    );
  };

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-slate-800 tracking-tight">مرتجعات المبيعات</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">إدارة استرجاع المنتجات من العملاء والتسويات المالية</p>
        </div>
        <div className="flex items-center gap-2">
          <TodayInvoicesButton variant="compact" />
          <button
            onClick={() => navigate("/sales/returns/new")}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-rose-500 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> مرتجع عام
          </button>
          <button
            onClick={() => setQuickReturnOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-blue-600 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> إنشاء مرتجع جديد
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-600">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ArrowRightLeft className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">عدد المرتجعات</span>
            <span className="text-[22px] font-black text-slate-800">{stats.count}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><DollarSign className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">إجمالي القيمة المرتدة</span>
            <span className="text-[22px] font-black text-slate-800">{formatMoney(stats.totalValue)} <span className="text-[12px] text-slate-400">ج.م</span></span>
          </div>
        </div>
        {/* Reason mini-chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
          {stats.reasonData.length > 0 ? (
            <>
              <ResponsiveContainer width={64} height={64}>
                <PieChart>
                  <Pie data={stats.reasonData} dataKey="value" cx="50%" cy="50%" outerRadius={30} innerRadius={16} strokeWidth={0}>
                    {stats.reasonData.map((_, i) => <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-1">أسباب المرتجعات</span>
                {stats.reasonData.slice(0, 3).map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: REASON_COLORS[i] }} />
                    <span className="truncate">{d.name}</span>
                    <span className="text-slate-400 mr-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <TrendingDown className="h-6 w-6 mb-1" />
              <span className="text-[11px] font-bold">لا بيانات</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="بحث باسم العميل أو رقم المرتجع..."
              className="flex-1 min-w-[180px]"
              size="md"
            />
          {/* Date filters */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
            <span className="text-[11px] text-slate-400 font-bold">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-3.5 w-3.5" /> مسح الفلتر
            </button>
          )}
          <div className="mr-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">{rows.length} نتيجة</span>
          </div>
        </div>

        <DataGrid
          data={rows}
          rowKey="id"
          emptyMessage={hasFilters ? "لا توجد مرتجعات مطابقة للبحث" : "لا توجد مرتجعات"}
          emptyIcon={<RotateCcw className="h-10 w-10 opacity-30 mb-2" />}
          className="border-0"
          columns={[
            {
              id: "id", header: "رقم المرتجع", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black text-slate-800 border-l border-slate-100",
              render: (r) => `SR-${String(r.id).padStart(5, "0")}`
            },
            {
              id: "customer", header: "العميل", width: 200, sortable: true, cellClass: "font-bold text-slate-700 px-2 border-l border-slate-100", headerClass: "text-right px-2",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-500 border border-blue-100 shrink-0"><User className="h-3 w-3" /></div>
                  <span className="truncate">{r.customer_name || "عميل نقدي"}</span>
                </div>
              )
            },
            {
              id: "invoice", header: "بناءً على فاتورة", width: 140, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[12px] font-bold text-slate-600">{r.original_invoice_no || `#${r.invoice_id}`}</span>
            },
            {
              id: "reason", header: "السبب", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => r.reason ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                  {REASON_LABELS[r.reason] || r.reason}
                </span>
              ) : <span className="text-slate-300 text-[11px]">—</span>
            },
            {
              id: "refund", header: "طريقة الاسترداد", width: 140, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${r.refund_method === "credit_note" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}>
                  {REFUND_LABELS[r.refund_method] || "نقدي"}
                </span>
              )
            },
            {
              id: "date", header: "التاريخ", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center text-[12px] font-medium text-slate-500 border-l border-slate-100",
              render: (r) => formatDate(r.created_at)
            },
            {
              id: "total", header: "القيمة", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-mono font-black text-[14px] text-blue-800 border-l border-slate-100",
              sortValue: (r) => r.total,
              render: (r) => formatMoney(r.total)
            },
            {
              id: "status", header: "الحالة", width: 100, sortable: false, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => {
                const s = r.status || "active";
                if (r.amended_by) return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">مُستبدل</span>;
                if (s === "cancelled") return <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">ملغي</span>;
                return <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">نشط</span>;
              }
            },
            {
              id: "actions", header: "", width: 120, sortable: false, headerClass: "text-center", cellClass: "text-center p-0 border-l-0",
              render: (row) => {
                const isCancelled = row.status === "cancelled";
                const isAmended = !!row.amended_by;
                return (
                  <div className="flex h-[40px] items-center justify-center gap-1">
                    <button
                      onClick={() => handleShowDetail(row.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all"
                      title="معاينة سريعة"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/pos/sales-returns/${row.id}`)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      title="فتح الصفحة الكاملة"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    {!isCancelled && !isAmended && (
                      <button
                        onClick={() => { setCancelId(row.id); setCancelReason(""); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="إلغاء"
                      >
                        <FileX className="h-4 w-4" />
                      </button>
                    )}
                    {!isCancelled && !isAmended && (
                      <button
                        onClick={() => navigate("/pos/sales-returns/amend", { state: { amend_return_id: row.id, original: row } })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              }
            }
          ]}
        />
      </div>

      {/* Detail Modal */}
      <Modal open={modalDetailOpen} onClose={() => setModalDetailOpen(false)} title={`تفاصيل مرتجع مبيعات — SR-${String(activeReturn?.id || 0).padStart(5, "0")}`}>
        {activeReturn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-4 border border-blue-100">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">العميل</span>
                <span className="text-[14px] font-black text-blue-900">{activeReturn.customer_name || "عميل نقدي"}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">التاريخ</span>
                <span className="text-[13px] font-black text-blue-900">{new Intl.DateTimeFormat("ar-EG", { dateStyle: "full" }).format(new Date(activeReturn.created_at))}</span>
              </div>
              {activeReturn.reason && (
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">السبب</span>
                  <span className="text-[13px] font-bold text-blue-800">{REASON_LABELS[activeReturn.reason] || activeReturn.reason}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase block mb-1">طريقة الاسترداد</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                  activeReturn.refund_method === "credit_note" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                }`}>
                  {REFUND_LABELS[activeReturn.refund_method] || "نقدي"}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col h-64 min-h-0">
              <DataGrid
                data={activeReturn.lines || []}
                rowKey="id"
                emptyMessage="لا يوجد مسترجعات"
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                columns={[
                  {
                    id: "code", header: "الكود", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100",
                    render: (l) => l.barcode || l.code || l.item_code || "-"
                  },
                  {
                    id: "name", header: "الصنف", width: 140, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-3", headerClass: "text-right px-3",
                    render: (l) => <span className="truncate">{l.item_name}</span>
                  },
                  {
                    id: "quantity", header: "الكمية", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-black text-blue-700 border-l border-slate-100",
                    render: (l) => l.quantity
                  },
                  {
                    id: "total", header: "قيمة الاسترداد", width: 120, sortable: true, headerClass: "text-left px-3", cellClass: "text-left font-black font-mono border-l-0 px-3",
                    sortValue: (l) => l.line_total,
                    render: (l) => formatMoney(l.line_total)
                  }
                ]}
              />
              <div className="flex shrink-0 items-center justify-between bg-blue-900 px-4 py-3 text-white border-t border-slate-200">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">إجمالي المرتجع</span>
                <span className="text-[18px] font-black font-mono">{formatMoney(activeReturn.total)} ج.م</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModalDetailOpen(false)} className="rounded-lg bg-slate-900 px-10 py-2.5 text-[13px] font-black text-white hover:bg-slate-800 transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Return Modal */}
      <QuickReturnModal
        mode="sales"
        open={quickReturnOpen}
        onClose={() => setQuickReturnOpen(false)}
        onSuccess={loadData}
      />


      {/* Cancel return modal */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-[16px] font-black text-slate-800 mb-4">سبب إلغاء المرتجع</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {["خطأ في البيانات", "خطأ في الكمية", "طلب العميل", "مرتجع مكرر", "أخرى"].map(p => (
                <button key={p} onClick={() => setCancelReason(p)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${cancelReason === p ? "bg-rose-600 text-white border-rose-600" : "border-slate-200 text-slate-600 hover:border-rose-300"}`}
                >{p}</button>
              ))}
            </div>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="أو اكتب السبب..."
              className="w-full border border-slate-200 rounded-xl p-3 text-[12px] resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-300" />
            <div className="flex gap-2 mt-4">
              <button onClick={handleCancel} disabled={!cancelReason.trim()}
                className="flex-1 bg-rose-600 text-white rounded-xl py-2.5 text-[13px] font-black disabled:opacity-40 hover:bg-rose-700 transition-colors">تأكيد الإلغاء</button>
              <button onClick={() => { setCancelId(null); setCancelReason(""); }}
                className="flex-1 border border-slate-200 rounded-xl py-2.5 text-[13px] font-black text-slate-600 hover:bg-slate-50 transition-colors">رجوع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
