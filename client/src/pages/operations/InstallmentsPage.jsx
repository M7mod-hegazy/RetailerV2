import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { 
  Plus, 
  Calendar, 
  User, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  TrendingUp, 
  Clock, 
  Activity,
  ArrowRight,
  MoreVertical,
  Banknote,
  Eye,
  Trash2,
  DollarSign
} from "lucide-react";
import toast from "react-hot-toast";

function formatMoney(v) {
  return Number(v || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
}

export default function InstallmentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ id: "", amount: "" });
  const [query, setQuery] = useState("");

  async function loadRows() {
    setLoading(true);
    try {
      const response = await api.get("/api/installments");
      setRows(response.data.data || []);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadRows();
  }, []);

  async function submitPayment(event) {
    event.preventDefault();
    if (!payment.id || !payment.amount) {
      toast.error("يرجى إدخال معرف القسط والمبلغ");
      return;
    }
    try {
      await api.post(`/api/installments/${payment.id}/pay`, { amount: Number(payment.amount) });
      toast.success("تم تسجيل سداد القسط بنجاح");
      setPayment({ id: "", amount: "" });
      await loadRows();
    } catch (e) { toast.error("فشل تسجيل السداد"); }
  }

  const stats = useMemo(() => {
    const totalRemaining = rows.reduce((s, r) => s + Number(r.remaining || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = rows.filter(r => r.next_due_date < today && Number(r.remaining) > 0).length;
    const dueToday = rows.filter(r => r.next_due_date === today && Number(r.remaining) > 0).length;
    
    return {
       remaining: formatMoney(totalRemaining),
       overdue,
       dueToday
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => 
      (r.customer_name || "").includes(query) || 
      (r.invoice_no || String(r.invoice_id) || "").includes(query)
    );
  }, [rows, query]);

  return (
    <div className="standard-page-container font-sans flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-black text-slate-800">إدارة الأقساط والتحصيل الدوري</h1>
          <p className="text-[13px] font-bold text-slate-400">متابعة مديونيات العملاء الآجلة، جدولة التحصيل، والتعامل مع حالات التأخير</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-blue-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <DollarSign className="h-3.5 w-3.5" /> إجمالي الأرصدة المستحقة
            </span>
            <div className="mt-1 flex items-baseline gap-1">
               <span className="text-[20px] font-black text-slate-800">{stats.remaining}</span>
               <span className="text-[11px] font-bold text-slate-400">ج.م</span>
            </div>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-rose-600">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> أقساط متأخرة
            </span>
            <span className="mt-1 text-[20px] font-black text-rose-700">{stats.overdue} حالة تأخير</span>
         </div>
         <div className="flex flex-col rounded-md border border-slate-100 bg-white p-5 shadow-sm border-r-4 border-r-emerald-500">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
               <Clock className="h-3.5 w-3.5 text-emerald-500" /> مطلوب تحصيلها اليوم
            </span>
            <span className="mt-1 text-[20px] font-black text-emerald-700">{stats.dueToday} أقساط جاهزة</span>
         </div>
      </div>

      {/* Quick Payment Form */}
      <div className="rounded-md border border-slate-800 bg-slate-900 p-6 text-white shadow-xl">
         <form onSubmit={submitPayment} className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
               <label className="text-[11px] font-black uppercase text-white/40 tracking-widest flex items-center gap-2">
                  <Activity className="h-3 w-3" /> تسجيل سداد قسط (Quick Pay)
               </label>
               <input 
                  type="text" 
                  placeholder="رقم القسط (Installment ID)..."
                  value={payment.id}
                  onChange={(e) => setPayment({ ...payment, id: e.target.value })}
                  className="w-full rounded-sm border border-white/10 bg-white/5 py-2.5 px-4 text-[13px] font-black outline-none focus:bg-white/10 focus:border-white/30"
               />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
               <label className="text-[11px] font-black uppercase text-white/40 tracking-widest">المبلغ المحصل</label>
               <div className="relative">
                  <Banknote className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
                  <input 
                     type="number" 
                     placeholder="0.00"
                     value={payment.amount}
                     onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                     className="w-full rounded-sm border border-white/10 bg-white/5 py-2.5 pl-4 pr-10 text-[18px] font-black outline-none focus:bg-white/10 focus:border-white/30"
                  />
               </div>
            </div>
            <button 
               type="submit"
               className="flex h-[46px] items-center gap-3 rounded-sm bg-emerald-600 px-10 text-[14px] font-black text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95"
            >
               <CheckCircle2 className="h-4 w-4" /> تنفيذ السداد
            </button>
         </form>
      </div>

      {/* Installments Table */}
      <div className="flex flex-col rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
           <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="بحث باسم العميل أو رقم الفاتورة..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-80 rounded-sm border border-slate-200 bg-white py-2 pl-3 pr-10 text-[12px] font-bold outline-none focus:border-slate-800"
              />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500">
                <th className="px-6 py-4">معرف القسط</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">الفاتورة المرتبطة</th>
                <th className="px-6 py-4">تاريخ الاستحقاق</th>
                <th className="px-6 py-4 text-left">الإجمالي</th>
                <th className="px-6 py-4 text-left">المتبقي</th>
                <th className="px-6 py-4 text-center">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
               {loading ? (
                  <tr><td colSpan="7" className="py-20 text-center font-black text-slate-400 animate-pulse">جاري جلب جدول الأقساط...</td></tr>
               ) : filteredRows.length === 0 ? (
                  <tr><td colSpan="7" className="py-20 text-center font-bold text-slate-400">لا توجد أقساط مطابقة للبحث</td></tr>
               ) : (
                 filteredRows.map(row => {
                    const isOverdue = row.next_due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={row.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                           <span className="font-mono text-[13px] font-black text-slate-800">INS-{String(row.id).padStart(5, '0')}</span>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200"><User className="h-3.5 w-3.5" /></div>
                              <span className="text-[13px] font-bold text-slate-700">{row.customer_name || `عميل #${row.customer_id}`}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col">
                              <span className="text-[12px] font-black text-slate-800">#{row.invoice_no || row.invoice_id}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Sale Invoice</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className={`flex items-center gap-2 text-[12px] font-black ${isOverdue ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                              <Calendar className="h-3.5 w-3.5 opacity-50" />
                              {new Date(row.next_due_date).toLocaleDateString("ar-EG")}
                              {isOverdue && <span className="text-[9px] bg-rose-50 px-1 rounded-sm border border-rose-100">متأخر!</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-left font-mono text-[13px] font-bold text-slate-400">
                           {formatMoney(row.total)}
                        </td>
                        <td className="px-6 py-4 text-left">
                           <span className="font-mono text-[15px] font-black text-slate-800">{formatMoney(row.remaining)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="flex h-8 w-8 items-center justify-center rounded-sm bg-slate-800 text-white shadow-md hover:bg-slate-700">
                                 <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-300 hover:text-rose-600 hover:bg-rose-50">
                                 <Trash2 className="h-3.5 w-3.5" />
                              </button>
                           </div>
                        </td>
                      </tr>
                    );
                 })
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
