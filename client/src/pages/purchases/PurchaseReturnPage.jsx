import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  ArrowRightLeft, Plus, Calendar, User, DollarSign,
  Eye, Search, X, RotateCcw, TrendingDown, ArrowUpRight
} from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "../../components/ui/Modal";
import QuickReturnModal from "../../components/returns/QuickReturnModal";
import DataGrid from "../../components/ui/DataGrid";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import SearchInput from "../../components/ui/SearchInput";
import { adaptForServer } from "../../utils/search";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const REASON_LABELS = {
  defective: "تلف / عيب",
  wrong_qty: "كمية خاطئة",
  supplier_error: "خطأ من المورد",
  wrong_item: "صنف خاطئ",
  other: "أخرى",
};
const REASON_COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#10b981"];

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("ar-EG");
}

export default function PurchaseReturnPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReturn, setActiveReturn] = useState(null);
  const [modalDetailOpen, setModalDetailOpen] = useState(false);
  const [quickReturnOpen, setQuickReturnOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debouncedSearch = useDebounce(searchTerm, 300);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const response = await api.get(`/api/purchases/returns?${params}`);
      setRows(response.data.data || []);
    } catch {
      toast.error("فشل تحميل البيانات");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [debouncedSearch, dateFrom, dateTo]);

  async function handleShowDetail(id) {
    try {
      const response = await api.get(`/api/purchases/returns/${id}`);
      setActiveReturn(response.data.data);
      setModalDetailOpen(true);
    } catch { toast.error("حدث خطأ في تحميل التفاصيل"); }
  }

  function clearFilters() {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
  }

  const hasFilters = searchTerm || dateFrom || dateTo;

  const stats = useMemo(() => {
    const totalValue = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
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
          <h1 className="text-[24px] font-black text-slate-800 tracking-tight">مرتجعات المشتريات</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">متابعة الأصناف المرتجعة للموردين والحركات المالية المرتبطة</p>
        </div>
        <button
          onClick={() => setQuickReturnOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-amber-500 transition-all active:scale-95"
        >
          <Plus className="h-4 w-4" /> إنشاء مرتجع جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-amber-100 bg-white p-5 shadow-sm border-r-4 border-r-amber-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><ArrowRightLeft className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">عدد عمليات المرتجع</span>
            <span className="text-[22px] font-black text-slate-800">{stats.count}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><DollarSign className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">إجمالي المبالغ المستردة</span>
            <span className="text-[22px] font-black text-slate-800">{formatMoney(stats.totalValue)} <span className="text-[12px] text-slate-400">ج.م</span></span>
          </div>
        </div>
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
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="بحث باسم المورد أو رقم المرتجع..."
            className="flex-1 min-w-[180px]"
            size="md"
          />
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
            <span className="text-[11px] text-slate-400 font-bold">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
          <span className="mr-auto text-[11px] font-bold text-slate-400">{rows.length} نتيجة</span>
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
              render: (r) => `PR-${String(r.id).padStart(5, "0")}`
            },
            {
              id: "supplier", header: "المورد", width: 220, sortable: true, cellClass: "font-bold text-slate-700 px-2 border-l border-slate-100", headerClass: "text-right px-2",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-100 shrink-0"><User className="h-3 w-3" /></div>
                  <span className="truncate">{r.supplier_name || `مورد #${r.supplier_id}`}</span>
                </div>
              )
            },
            {
              id: "purchase_id", header: "مرتبط بفاتورة", width: 140, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[12px] font-bold text-slate-600">PUR-{String(r.purchase_id).padStart(5, "0")}</span>
            },
            {
              id: "reason", header: "السبب", width: 140, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => r.reason ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-100">
                  {REASON_LABELS[r.reason] || r.reason}
                </span>
              ) : <span className="text-slate-300 text-[11px]">—</span>
            },
            {
              id: "settlement_type", header: "التسوية", width: 150, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                  r.settlement_type === "cash"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  {r.settlement_type === "cash" ? "استرداد نقدي" : "خصم من حساب المورد"}
                </span>
              )
            },
            {
              id: "date", header: "التاريخ", width: 140, sortable: true, headerClass: "text-center", cellClass: "text-center text-[12px] font-medium text-slate-500 border-l border-slate-100",
              render: (r) => (
                <div className="flex items-center justify-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-40 inline" />
                  {formatDate(r.created_at)}
                </div>
              )
            },
            {
              id: "total", header: "القيمة", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left px-2 font-mono font-black text-[14px] text-slate-900 border-l border-slate-100",
              sortValue: (r) => r.total,
              render: (r) => formatMoney(r.total)
            },
            {
              id: "actions", header: "", width: 60, sortable: false, headerClass: "text-center", cellClass: "text-center p-0 border-l-0",
              render: (row) => (
                <div className="flex h-[40px] items-center justify-center">
                  <button
                    onClick={() => handleShowDetail(row.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
        />
      </div>

      {/* Detail Modal */}
      <Modal open={modalDetailOpen} onClose={() => setModalDetailOpen(false)} title={`تفاصيل مرتجع شراء — PR-${String(activeReturn?.id || 0).padStart(5, "0")}`}>
        {activeReturn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
              <div>
                <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">المورد</span>
                <span className="text-[14px] font-black text-slate-800">{activeReturn.supplier_name || `مورد #${activeReturn.supplier_id}`}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">تاريخ المرتجع</span>
                <span className="text-[13px] font-black text-slate-800">{new Date(activeReturn.created_at).toLocaleString("ar-EG")}</span>
              </div>
              {activeReturn.reason && (
                <div className="col-span-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase block mb-1">السبب</span>
                  <span className="text-[13px] font-bold text-slate-700">{REASON_LABELS[activeReturn.reason] || activeReturn.reason}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col h-64 min-h-0">
              <DataGrid
                data={activeReturn.lines || []}
                rowKey="id"
                emptyMessage="لا يوجد أصناف"
                className="border-0"
                containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                columns={[
                  {
                    id: "code", header: "الكود", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100",
                    render: (l) => l.barcode || l.code || l.item_code || "-"
                  },
                  {
                    id: "name", header: "الصنف", width: 140, sortable: true, cellClass: "font-bold text-slate-700 border-l border-slate-100 px-3", headerClass: "text-right px-3",
                    render: (l) => <span className="truncate">{l.item_name}</span>
                  },
                  {
                    id: "quantity", header: "الكمية", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-black text-amber-700 border-l border-slate-100",
                    render: (l) => l.quantity
                  },
                  {
                    id: "cost", header: "التكلفة", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center text-slate-400 font-mono border-l border-slate-100",
                    sortValue: (l) => l.unit_cost,
                    render: (l) => formatMoney(l.unit_cost)
                  },
                  {
                    id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-3", cellClass: "text-left font-black font-mono border-l-0 px-3",
                    sortValue: (l) => l.line_total,
                    render: (l) => formatMoney(l.line_total)
                  }
                ]}
              />
              <div className="flex shrink-0 items-center justify-between bg-slate-800 px-4 py-3 text-white border-t border-slate-200">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-60">إجمالي قيمة المرتجع</span>
                <span className="text-[18px] font-black font-mono">{formatMoney(activeReturn.total)} ج.م</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setModalDetailOpen(false)} className="rounded-lg bg-slate-800 px-10 py-2.5 text-[13px] font-black text-white hover:bg-slate-700 transition-all active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Return Modal */}
      <QuickReturnModal
        mode="purchase"
        open={quickReturnOpen}
        onClose={() => setQuickReturnOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
