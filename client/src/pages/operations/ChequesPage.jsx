import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { 
  Plus, 
  Receipt, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Clock, 
  MoreVertical,
  Banknote,
  Search,
  Filter,
  ArrowRightLeft,
  DollarSign
} from "lucide-react";
import toast from "react-hot-toast";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const configs = {
    pending: { label: "قيد الانتظار", class: "bg-amber-50 text-amber-600 border-amber-100" },
    deposited: { label: "تم الإيداع", class: "bg-blue-50 text-blue-600 border-blue-100" },
    cleared: { label: "تم التحصيل", class: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    bounced: { label: "مرتد / مرفوض", class: "bg-rose-50 text-rose-600 border-rose-100" },
  };
  const config = configs[status] || { label: status, class: "bg-slate-50 text-slate-400 border-slate-100" };
  return (
    <span className={`rounded-sm border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest shadow-sm ${config.class}`}>
      {config.label}
    </span>
  );
}

export default function ChequesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadRows() {
    setLoading(true);
    try {
      const response = await api.get("/api/cheques");
      setRows(response.data.data || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function updateStatus(id, status) {
    try {
      await api.patch(`/api/cheques/${id}/status`, { status });
      toast.success(`تم تحديث حالة الشيك إلى: ${status === 'cleared' ? 'تم التحصيل' : status === 'bounced' ? 'مرتد' : 'مودع'}`);
      await loadRows();
    } catch (e) { toast.error("فشل تحديث الحالة"); }
  }

  const stats = useMemo(() => {
    const totalValue = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const bouncedValue = rows.filter(r => r.status === 'bounced').reduce((s, r) => s + Number(r.amount || 0), 0);
    return {
       total: formatMoney(totalValue),
       pending: pendingCount,
       bounced: formatMoney(bouncedValue)
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      (r.cheque_no || "").includes(query) || 
      (r.bank_name || "").includes(query)
    );
  }, [rows, query]);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-800">إدارة أوراق القبض (الشيكات)</h1>
          <p className="text-[13px] font-bold text-slate-400">متابعة حصيلة الشيكات، تواريخ الاستحقاق، وحالات التحصيل والإرجاع البنكي</p>
        </div>
        <button className="flex items-center gap-2 rounded-sm bg-slate-800 px-6 py-2.5 text-[14px] font-black text-white shadow-lg transition-all hover:bg-slate-700 active:scale-95">
          <Plus className="h-4 w-4" /> إضافة شيك يدوي
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <ArrowUpRight className="h-3.5 w-3.5" /> إجمالي المحفظة
            </span>
            <div className="mt-1 flex items-baseline gap-1">
               <span className="text-[20px] font-black text-slate-800">{stats.total}</span>
               <span className="text-[11px] font-bold text-slate-400">ج.م</span>
            </div>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-amber-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <Clock className="h-3.5 w-3.5" /> قيد انتظار التحصيل
            </span>
            <span className="mt-1 text-[20px] font-black text-slate-800">{stats.pending} شيكات</span>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-rose-600 font-black">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <AlertCircle className="h-3.5 w-3.5" /> قيمة الشيكات المرتدة
            </span>
            <div className="mt-1 flex items-baseline gap-1 text-rose-600">
               <span className="text-[20px]">{stats.bounced}</span>
               <span className="text-[11px] font-bold">ج.م</span>
            </div>
         </div>
      </div>

      <div className="flex flex-col rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
           <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="بحث برقم الشيك أو البنك..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-80 rounded-sm border border-slate-200 bg-white py-2 pl-3 pr-10 text-[12px] font-bold outline-none focus:border-slate-800"
              />
           </div>
           <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase hover:text-slate-800">
                 <Filter className="h-3.5 w-3.5" /> تصفية النتائج
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
             <div className="col-span-full py-20 text-center font-black text-slate-400 animate-pulse uppercase tracking-widest">تحميل محفظة الشيكات...</div>
          ) : filteredRows.length === 0 ? (
             <div className="col-span-full py-20 text-center font-bold text-slate-400">لا توجد أوراق قبض مسجلة حالياً</div>
          ) : (
            filteredRows.map(row => (
              <div key={row.id} className="group relative rounded-md border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-800 hover:shadow-lg">
                <div className="flex items-start justify-between">
                   <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                         <Receipt className="h-4 w-4 text-slate-400" />
                         <span className="font-mono text-[11px] font-black text-slate-400 uppercase tracking-tighter">CHK-{String(row.id).padStart(5, '0')}</span>
                      </div>
                      <h3 className="mt-2 text-[20px] font-black text-slate-800">{formatMoney(row.amount)} <span className="text-[12px] text-slate-400">ج.م</span></h3>
                   </div>
                   <StatusBadge status={row.status} />
                </div>

                <div className="mt-6 space-y-3">
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><CreditCard className="h-3.5 w-3.5" /> بنك الشيك</span>
                      <span className="text-[12px] font-black text-slate-700">{row.bank_name || "غير محدد"}</span>
                   </div>
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><Calendar className="h-3.5 w-3.5" /> تاريخ الاستحقاق</span>
                      <span className="text-[12px] font-black text-slate-700">{new Date(row.due_date).toLocaleDateString("ar-EG")}</span>
                   </div>
                   <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <span className="flex items-center gap-2 text-[11px] font-black uppercase text-slate-400 tracking-widest"><Search className="h-3.5 w-3.5" /> رقم الشيك</span>
                      <span className="font-mono text-[12px] font-black text-slate-800">{row.cheque_no}</span>
                   </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                   <button 
                    onClick={() => updateStatus(row.id, 'cleared')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-emerald-50 py-3 text-[10px] font-black text-emerald-700 transition-all hover:bg-emerald-100"
                   >
                     <CheckCircle2 className="h-4 w-4" /> تحصيل
                   </button>
                   <button 
                    onClick={() => updateStatus(row.id, 'deposited')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-blue-50 py-3 text-[10px] font-black text-blue-700 transition-all hover:bg-blue-100"
                   >
                     <ArrowRightLeft className="h-4 w-4" /> إيداع
                   </button>
                   <button 
                    onClick={() => updateStatus(row.id, 'bounced')}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-sm bg-rose-50 py-3 text-[10px] font-black text-rose-700 transition-all hover:bg-rose-100"
                   >
                     <AlertCircle className="h-4 w-4" /> مرتد
                   </button>
                </div>
                
                <button className="absolute left-2 bottom-2 p-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-800">
                   <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
