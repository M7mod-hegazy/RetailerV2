import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  ShoppingCart, Plus, Calendar, User, DollarSign,
  Eye, MoreVertical, Truck, Search, X,
  RotateCcw, FileX, Package
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import QuickReturnModal from "../../components/returns/QuickReturnModal";
import DataGrid from "../../components/ui/DataGrid";
import toast from "react-hot-toast";
import useDebounce from "../../hooks/useDebounce";
import SearchInput from "../../components/ui/SearchInput";
import { adaptForServer } from "../../utils/search";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("ar-EG");
}

const DATE_PRESETS = [
  { label: "عرض الكل", value: "all" },
  { label: "آخر 30 يوم", value: "30d" },
  { label: "هذا الشهر", value: "month" },
];

function getPresetDates(preset) {
  const today = new Date();
  if (preset === "30d") {
    const from = new Date(today); from.setDate(from.getDate() - 30);
    return { date_from: from.toISOString().slice(0, 10), date_to: today.toISOString().slice(0, 10) };
  }
  if (preset === "month") {
    return { date_from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, date_to: today.toISOString().slice(0, 10) };
  }
  return {};
}

export default function PurchasesListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [preset, setPreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [voidId, setVoidId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const [returnModal, setReturnModal] = useState({ open: false, purchaseId: null });

  const debouncedSearch = useDebounce(searchTerm, 300);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handler(e) { if (!menuRef.current?.contains(e.target)) setOpenMenu(null); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadRows() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", adaptForServer(debouncedSearch));
      const dates = preset !== "all" ? getPresetDates(preset) : { date_from: customFrom || undefined, date_to: customTo || undefined };
      if (dates.date_from) params.set("date_from", dates.date_from);
      if (dates.date_to) params.set("date_to", dates.date_to);
      const res = await api.get(`/api/purchases?${params}`);
      setRows(res.data.data || []);
    } catch { toast.error("فشل تحميل البيانات"); }
    setLoading(false);
  }

  useEffect(() => { loadRows(); }, [debouncedSearch, preset, customFrom, customTo]);

  async function openDrawer(id) {
    setDrawerOpen(true);
    setDrawerData(null);
    setDrawerLoading(true);
    try {
      const res = await api.get(`/api/purchases/${id}`);
      setDrawerData(res.data.data);
    } catch { toast.error("فشل تحميل تفاصيل الفاتورة"); }
    setDrawerLoading(false);
  }

  async function handleVoid() {
    try {
      await api.post(`/api/purchases/${voidId}/void`, { reason: "إلغاء يدوي" });
      toast.success("تم إلغاء الفاتورة");
      setVoidId(null);
      loadRows();
      if (drawerData?.id === voidId) setDrawerOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "فشل إلغاء الفاتورة");
      setVoidId(null);
    }
  }

  const stats = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
    const itemsCount = rows.reduce((sum, r) => sum + Number(r.items_count || 0), 0);
    return { total, count: rows.length, itemsCount };
  }, [rows]);

  const hasSearch = !!debouncedSearch || preset !== "all" || customFrom || customTo;

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-black text-slate-800">فواتير المشتريات</h1>
          <p className="text-[13px] font-bold text-slate-400 mt-0.5">تتبع وإدارة كافة فواتير المشتريات الواردة</p>
        </div>
        <Link to="/purchases/new" className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-[13px] font-black text-white shadow-lg hover:bg-slate-700 transition-all active:scale-95">
          <Plus className="h-4 w-4" /> فاتورة شراء جديدة
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><DollarSign className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">إجمالي المشتريات</span>
            <span className="text-[20px] font-black text-slate-800">{formatMoney(stats.total)} <span className="text-[12px] text-slate-400">ج.م</span></span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><ShoppingCart className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">عدد الفواتير</span>
            <span className="text-[20px] font-black text-slate-800">{stats.count}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-r-4 border-r-amber-400">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Truck className="h-5 w-5" /></div>
          <div>
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">إجمالي الأصناف</span>
            <span className="text-[20px] font-black text-slate-800">{stats.itemsCount}</span>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="بحث باسم المورد أو رقم الفاتورة..."
              className="flex-1 min-w-[160px]"
              size="md"
            />
          <select
            value={preset}
            onChange={e => { setPreset(e.target.value); setCustomFrom(""); setCustomTo(""); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none"
          >
            {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {preset === "all" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
              <span className="text-[11px] text-slate-400">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] font-bold text-slate-600 focus:border-slate-400 focus:outline-none" />
            </div>
          )}
          {hasSearch && (
            <button onClick={() => { setSearchTerm(""); setPreset("all"); setCustomFrom(""); setCustomTo(""); }}
              className="flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-700 transition-colors">
              <X className="h-3.5 w-3.5" /> مسح
            </button>
          )}
          <span className="mr-auto text-[11px] font-bold text-slate-400">{rows.length} فاتورة</span>
        </div>

        <DataGrid
          data={rows}
          rowKey="id"
          emptyMessage={hasSearch ? "لا توجد فواتير مطابقة للبحث" : "لا توجد فواتير"}
          emptyIcon={<Package className="h-14 w-14 opacity-30 mb-2" />}
          className="border-0"
          columns={[
            {
              id: "id", header: "رقم الفاتورة", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[13px] font-black text-slate-800 border-l border-slate-100",
              render: (r) => `PUR-${String(r.id).padStart(5, "0")}`
            },
            {
              id: "supplier", header: "المورد", width: 200, sortable: true, cellClass: "font-bold text-slate-700 px-2 border-l border-slate-100", headerClass: "text-right px-2",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 shrink-0"><User className="h-3 w-3" /></div>
                  <span className="truncate">{r.supplier_name || `مورد #${r.supplier_id}`}</span>
                </div>
              )
            },
            {
              id: "date", header: "التاريخ", width: 120, sortable: true, headerClass: "text-center", cellClass: "text-center text-slate-500 text-[12px] font-bold border-l border-slate-100",
              render: (r) => formatDate(r.created_at)
            },
            {
              id: "items_count", header: "الأصناف", width: 100, sortable: true, headerClass: "text-center", cellClass: "text-center border-l border-slate-100",
              render: (r) => <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{r.items_count || 0} صنف</span>
            },
            {
              id: "total", header: "الإجمالي", width: 120, sortable: true, headerClass: "text-left px-2", cellClass: "text-left font-mono font-black text-[14px] text-slate-900 border-l border-slate-100 px-2",
              sortValue: (r) => r.total,
              render: (r) => formatMoney(r.total)
            },
            {
              id: "actions", header: "إجراءات", width: 120, sortable: false, headerClass: "text-center", cellClass: "text-center p-0 border-l-0",
              render: (row) => (
                <div className="flex items-center justify-center gap-1 h-[40px]">
                  <button
                    onClick={() => openDrawer(row.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="عرض التفاصيل"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setReturnModal({ open: true, purchaseId: row.id })}
                    className="flex h-7 items-center gap-1 px-2 rounded-lg text-amber-600 hover:bg-amber-50 text-[11px] font-black transition-colors"
                    title="إنشاء مرتجع"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative" ref={openMenu === row.id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenu === row.id && (
                      <div className="absolute left-0 top-full mt-1 z-20 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                        <button
                          onClick={() => { setVoidId(row.id); setOpenMenu(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <FileX className="h-3.5 w-3.5" /> إلغاء الفاتورة
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
          ]}
        />
      </div>

      {/* Detail Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex" dir="rtl">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative mr-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50">
              <h2 className="text-[15px] font-black text-slate-800">
                {drawerData ? `فاتورة PUR-${String(drawerData.id).padStart(5, "0")}` : "تفاصيل الفاتورة"}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {drawerLoading ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse font-bold text-[13px]">جاري التحميل...</div>
            ) : drawerData ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Summary */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase">المورد</span>
                    <span className="text-[13px] font-black text-slate-800">{drawerData.supplier_name || `مورد #${drawerData.supplier_id}`}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase">التاريخ</span>
                    <span className="text-[13px] font-bold text-slate-600">{formatDate(drawerData.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase">الإجمالي</span>
                    <span className="text-[15px] font-black text-emerald-700">{formatMoney(drawerData.total)} ج.م</span>
                  </div>
                </div>

                {/* Lines */}
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">الأصناف</p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0 h-64">
                    <DataGrid 
                      data={drawerData.lines || []}
                      rowKey="id"
                      emptyMessage="لا يوجد أصناف متصلة"
                      columns={[
                        {
                          id: "code", header: "الكود", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] font-black text-slate-500 border-l border-slate-100",
                          render: (l) => l.barcode || l.code || l.item_code || "-"
                        },
                        {
                          id: "name", header: "الصنف", width: 140, sortable: true, cellClass: "font-bold text-slate-800 border-l border-slate-100 px-2 truncate", headerClass: "text-right px-2",
                          render: (l) => (
                            <div className="flex flex-col">
                              <span className="truncate">{l.item_name}</span>
                              {l.returnable_quantity > 0 && <span className="text-[9px] text-amber-600 font-bold block">متاح إرجاع: {l.returnable_quantity}</span>}
                            </div>
                          )
                        },
                        {
                          id: "qty", header: "الكمية", width: 70, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono font-black text-slate-800 border-l border-slate-100",
                          render: (l) => l.quantity
                        },
                        {
                          id: "cost", header: "التكلفة", width: 80, sortable: true, headerClass: "text-center", cellClass: "text-center font-mono text-[11px] text-slate-500 border-l border-slate-100",
                          render: (l) => formatMoney(l.unit_cost)
                        },
                        {
                          id: "total", header: "الإجمالي", width: 90, sortable: true, headerClass: "text-left px-2", cellClass: "text-left font-black font-mono text-[12px] border-l-0 px-2",
                          render: (l) => formatMoney(l.line_total)
                        }
                      ]}
                      containerClass="flex-1 overflow-x-auto overflow-y-auto bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0"
                    />
                    <div className="flex shrink-0 items-center justify-between bg-slate-800 px-4 py-3 text-white border-t-2 border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">الإجمالي</span>
                      <span className="text-[16px] font-black font-mono">{formatMoney(drawerData.total)} ج.م</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-[13px]">فشل تحميل البيانات</div>
            )}

            {drawerData && (
              <div className="border-t border-slate-100 p-4 flex gap-2">
                <button
                  onClick={() => { setReturnModal({ open: true, purchaseId: drawerData.id }); setDrawerOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-2 text-[12px] font-black text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" /> إنشاء مرتجع
                </button>
                <button
                  onClick={() => { setVoidId(drawerData.id); setDrawerOpen(false); }}
                  className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-black text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <FileX className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Confirm */}
      <ConfirmDialog
        open={!!voidId}
        title="إلغاء الفاتورة"
        message="هل أنت متأكد من إلغاء هذه الفاتورة؟ سيتم عكس التأثير على المخزون والرصيد."
        onConfirm={handleVoid}
        onCancel={() => setVoidId(null)}
      />

      {/* Quick Return Modal */}
      <QuickReturnModal
        mode="purchase"
        open={returnModal.open}
        initialDocId={returnModal.purchaseId}
        onClose={() => setReturnModal({ open: false, purchaseId: null })}
        onSuccess={loadRows}
      />
    </div>
  );
}
