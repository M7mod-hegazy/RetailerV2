import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertCircle, Clock, CheckCircle2, ChevronRight, X, Plus, Printer,
  Calendar, User, FileText, BarChart2, Search, RefreshCw
} from "lucide-react";
import api from "../../services/api";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("ar-EG") : "—";

const STATUS_MAP = {
  open: { label: "مفتوح", cls: "bg-blue-100 text-blue-700" },
  partial: { label: "جزئي", cls: "bg-amber-100 text-amber-700" },
  overdue: { label: "متأخر", cls: "bg-rose-100 text-rose-700" },
  paid: { label: "مسدد", cls: "bg-emerald-100 text-emerald-700" },
};

export default function AjalTrackerPage() {
  const [summary, setSummary] = useState(null);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "all", search: "" });
  const [selected, setSelected] = useState(null);
  const [payMethods, setPayMethods] = useState([]);

  // Pay form
  const [payForm, setPayForm] = useState({ amount: "", method_id: 1, notes: "" });
  const [paying, setPaying] = useState(false);

  // Schedule form
  const [schedForm, setSchedForm] = useState({ installments: 3, frequency: "monthly", start_date: "" });
  const [scheduling, setScheduling] = useState(false);
  const [activePanel, setActivePanel] = useState("pay"); // 'pay' | 'schedule'

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumR, debtR, pmR] = await Promise.all([
        api.get("/api/ajal-debts/summary"),
        api.get(`/api/ajal-debts?status=${filters.status}&search=${filters.search}`),
        api.get("/api/payment-methods"),
      ]);
      setSummary(sumR.data.data);
      setDebts(debtR.data.data || []);
      setPayMethods(pmR.data.data || []);
    } catch { setDebts([]); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadDetail(id) {
    try {
      const r = await api.get(`/api/ajal-debts/${id}`);
      setSelected(r.data.data);
    } catch {}
  }

  async function handlePay() {
    if (!payForm.amount || !selected) return;
    setPaying(true);
    try {
      await api.post(`/api/ajal-debts/${selected.id}/pay`, {
        amount: Number(payForm.amount),
        payment_method_id: payForm.method_id,
        notes: payForm.notes,
      });
      setPayForm({ amount: "", method_id: 1, notes: "" });
      await loadDetail(selected.id);
      loadAll();
    } catch (e) { alert(e.response?.data?.message || "خطأ في السداد"); }
    finally { setPaying(false); }
  }

  async function handleSchedule() {
    if (!selected) return;
    setScheduling(true);
    try {
      await api.post(`/api/ajal-debts/${selected.id}/schedule`, {
        installments: Number(schedForm.installments),
        frequency: schedForm.frequency,
        start_date: schedForm.start_date || undefined,
      });
      await loadDetail(selected.id);
    } catch (e) { alert(e.response?.data?.message || "خطأ في الجدولة"); }
    finally { setScheduling(false); }
  }

  const KPI = ({ label, value, sub, color = "slate" }) => (
    <div className={`rounded-xl bg-white border border-${color}-200 p-4 shadow-sm`}>
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-[22px] font-black font-mono text-${color}-700`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 font-bold mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50" dir="rtl">
      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-200">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-slate-900">متابعة الديون والأجل</h1>
              <p className="text-[11px] font-bold text-slate-400">تتبع ديون العملاء وجدولة الأقساط</p>
            </div>
          </div>
          <button onClick={loadAll} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500">
            <RefreshCw className="h-4 w-4" />
          </button>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 p-4 shrink-0">
          <KPI label="إجمالي الديون المفتوحة" value={`${fmt(summary?.total_owed)} ج.م`} sub={`${summary?.open_count || 0} دين`} color="amber" />
          <KPI label="عملاء مدينون" value={summary?.debtors || 0} color="blue" />
          <KPI label="مستحق اليوم" value={summary?.due_today || 0} color="slate" />
          <KPI label="متأخر السداد" value={`${summary?.overdue_count || 0}`} sub={`${fmt(summary?.overdue_amount)} ج.م`} color="rose" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 px-4 pb-3 shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="بحث بالعميل أو رقم الفاتورة..."
              className="w-full h-9 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] outline-none focus:border-amber-400" />
          </div>
          {["all", "open", "partial", "overdue", "paid"].map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, status: s }))}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-black transition-colors ${filters.status === s ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {s === "all" ? "الكل" : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 font-black animate-pulse">جاري التحميل...</div>
            ) : debts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-300 gap-2">
                <Calendar className="h-10 w-10" /><span className="font-black">لا توجد ديون مطابقة</span>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["العميل", "رقم الفاتورة", "المبلغ الأصلي", "المدفوع", "المتبقي", "الاستحقاق", "الحالة", "إجراءات"].map(h => (
                      <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {debts.map(d => (
                    <tr key={d.id}
                      onClick={() => loadDetail(d.id)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${d.status === "overdue" ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-amber-50/30"}`}
                    >
                      <td className="px-4 py-3 font-black text-slate-800">{d.customer_name}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{d.invoice_no || "—"}</td>
                      <td className="px-4 py-3 font-black font-mono">{fmt(d.original_amount)}</td>
                      <td className="px-4 py-3 font-mono text-emerald-700">{fmt(d.paid_amount)}</td>
                      <td className="px-4 py-3 font-black font-mono text-rose-700">{fmt(d.remaining)}</td>
                      <td className={`px-4 py-3 text-[11px] font-black ${d.status === "overdue" ? "text-rose-600" : "text-slate-500"}`}>{fmtDate(d.due_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_MAP[d.status]?.cls || "bg-slate-100 text-slate-600"}`}>
                          {STATUS_MAP[d.status]?.label || d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); loadDetail(d.id); }}
                          className="flex items-center gap-1 text-[11px] font-black text-amber-700 hover:text-amber-900">
                          سداد <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <div className="w-[380px] shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-amber-50">
            <div>
              <div className="text-[14px] font-black text-slate-900">{selected.customer_name}</div>
              <div className="text-[11px] text-slate-400 font-bold">{selected.customer_phone}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 border-b border-slate-100 shrink-0">
            {[
              { label: "الأصلي", val: fmt(selected.original_amount) },
              { label: "المدفوع", val: fmt(selected.paid_amount) },
              { label: "المتبقي", val: fmt(selected.remaining), bold: true },
            ].map(({ label, val, bold }) => (
              <div key={label} className="text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase">{label}</div>
                <div className={`text-[14px] font-black font-mono ${bold ? "text-rose-700" : "text-slate-700"}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Panel tabs */}
          <div className="flex border-b border-slate-100 shrink-0">
            {[["pay", "سداد دفعة"], ["schedule", "جدولة أقساط"], ["history", "السجل"]].map(([k, label]) => (
              <button key={k} onClick={() => setActivePanel(k)}
                className={`flex-1 py-2.5 text-[12px] font-black transition-colors ${activePanel === k ? "border-b-2 border-amber-600 text-amber-700" : "text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-4">
            {activePanel === "pay" && (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">المبلغ (ج.م) *</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    autoFocus placeholder={`المتبقي: ${fmt(selected.remaining)}`}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[13px] font-black text-center outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">وسيلة الدفع</label>
                  <select value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] font-bold outline-none focus:border-amber-500 bg-white">
                    {payMethods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">ملاحظات</label>
                  <input type="text" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] outline-none focus:border-slate-400" />
                </div>
                <button onClick={handlePay} disabled={!payForm.amount || paying}
                  className="w-full rounded-xl bg-amber-600 py-3 text-[13px] font-black text-white hover:bg-amber-700 disabled:opacity-40 transition-colors">
                  {paying ? "جاري السداد..." : "تسجيل الدفعة"}
                </button>
              </div>
            )}

            {activePanel === "schedule" && (
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">عدد الأقساط</label>
                  <input type="number" min="2" max="60" value={schedForm.installments}
                    onChange={e => setSchedForm(f => ({ ...f, installments: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-center text-[14px] font-black outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">التكرار</label>
                  <select value={schedForm.frequency} onChange={e => setSchedForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] font-bold outline-none bg-white focus:border-amber-500">
                    <option value="weekly">أسبوعي</option>
                    <option value="biweekly">كل أسبوعين</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-600 block mb-1.5">تاريخ البداية</label>
                  <input type="date" value={schedForm.start_date} onChange={e => setSchedForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] outline-none focus:border-amber-500" />
                </div>
                {selected.remaining > 0 && schedForm.installments > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                    <div className="text-[11px] text-amber-700 font-bold">قسط تقريبي</div>
                    <div className="text-[18px] font-black font-mono text-amber-800">
                      {fmt(selected.remaining / schedForm.installments)} ج.م
                    </div>
                  </div>
                )}
                <button onClick={handleSchedule} disabled={scheduling}
                  className="w-full rounded-xl bg-slate-800 py-3 text-[13px] font-black text-white hover:bg-slate-700 disabled:opacity-40">
                  {scheduling ? "جاري الجدولة..." : "إنشاء جدول الأقساط"}
                </button>

                {/* Schedule list */}
                {selected.schedule?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">الجدول الحالي</div>
                    <div className="space-y-1.5">
                      {selected.schedule.map(s => (
                        <div key={s.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-[11px] ${s.status === "paid" ? "bg-emerald-50" : "bg-slate-50"}`}>
                          <span className="font-black text-slate-600">قسط {s.installment_no}</span>
                          <span className="text-slate-500">{fmtDate(s.due_date)}</span>
                          <span className="font-black font-mono">{fmt(s.amount)}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${s.status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {s.status === "paid" ? "مسدد" : "معلق"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activePanel === "history" && (
              <div className="space-y-2">
                {(!selected.payments || selected.payments.length === 0) ? (
                  <div className="text-center text-slate-400 py-8 font-black text-[12px]">لا توجد مدفوعات مسجلة</div>
                ) : selected.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                    <div>
                      <div className="text-[12px] font-black text-emerald-800">{fmt(p.amount)} ج.م</div>
                      <div className="text-[10px] text-emerald-600 font-bold">{p.method_name} — {fmtDate(p.payment_date)}</div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
