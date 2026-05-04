import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen, RefreshCw, Plus, Printer, Lock, Wallet,
  AlertCircle, CheckCircle2, X, ArrowDownRight, Calculator,
  Calendar, ChevronRight, Flag, ExternalLink, TrendingUp,
  TrendingDown, Search, Clock, ArrowUpDown, Filter,
} from "lucide-react";
import api from "../../services/api";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);
const DENOMS = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25];

const DOC_TYPE_LABEL = {
  pos_invoice: "فاتورة POS",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات",
  customer_payment: "دفعة عميل",
  withdrawal: "مسحوبات",
};

const DOC_TYPE_COLOR = {
  pos_invoice: "text-emerald-700 bg-emerald-50",
  expense: "text-rose-700 bg-rose-50",
  revenue: "text-blue-700 bg-blue-50",
  purchase: "text-orange-700 bg-orange-50",
  customer_payment: "text-purple-700 bg-purple-50",
  withdrawal: "text-slate-700 bg-slate-100",
};

const TABS = [
  { id: "pos", label: "فواتير POS" },
  { id: "expenses", label: "المصروفات" },
  { id: "revenues", label: "الإيرادات" },
  { id: "purchases", label: "المشتريات" },
  { id: "customer_payments", label: "مدفوعات العملاء" },
  { id: "withdrawals", label: "المسحوبات" },
  { id: "all", label: "كل الحركات" },
];

export default function DailyTreasuryPage() {
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pos");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState("");
  const [txSort, setTxSort] = useState("time_desc");
  const [globalAmountSearch, setGlobalAmountSearch] = useState("");

  // Close day
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closing, setClosing] = useState(false);

  // Withdrawal state
  const [wdOpen, setWdOpen] = useState(false);
  const [wdAmount, setWdAmount] = useState("");
  const [wdNote, setWdNote] = useState("");
  const [wdList, setWdList] = useState([]);

  // Money count modal
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [counts, setCounts] = useState({});

  // Quick expense/revenue modal
  const [quickModal, setQuickModal] = useState(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickNote, setQuickNote] = useState("");

  // Alerts
  const [yesterdayAlert, setYesterdayAlert] = useState(null);
  const [closingYesterday, setClosingYesterday] = useState(false);

  // Slide-over
  const [slideOver, setSlideOver] = useState(null);

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);

  // Compare yesterday
  const [compareYesterday, setCompareYesterday] = useState(false);

  const isToday = date === todayStr();
  const isClosed = summary?.session?.status === "closed";

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      if (isToday) {
        await api.get("/api/daily-sessions/today");
        const r = await api.get("/api/daily-sessions/today/summary");
        setSummary(r.data.data);
        if (r.data.data?.session?.id) {
          loadWithdrawals(r.data.data.session.id);
        }
      } else {
        const r = await api.get(`/api/daily-sessions/${date}/summary`).catch(() => ({ data: { data: null } }));
        setSummary(r.data.data);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date, isToday]);

  async function loadWithdrawals(sessionId) {
    try {
      const r = await api.get(`/api/daily-sessions/today/transactions?type=withdrawals`);
      setWdList(r.data.data || []);
    } catch {
      setWdList([]);
    }
  }

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const searchParam = globalAmountSearch || txSearch;
      const dateParam = isToday ? "" : `&date=${date}`;
      const r = await api.get(
        `/api/daily-sessions/today/transactions?type=${activeTab}&search=${encodeURIComponent(searchParam)}${dateParam}`
      );
      let rows = r.data.data || [];
      if (txSort === "amount_asc") rows = [...rows].sort((a, b) => a.amount - b.amount);
      else if (txSort === "amount_desc") rows = [...rows].sort((a, b) => b.amount - a.amount);
      else if (txSort === "time_asc") rows = [...rows].sort((a, b) => a.created_at?.localeCompare(b.created_at));
      setTransactions(rows);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [activeTab, txSearch, txSort, globalAmountSearch, date, isToday]);

  async function loadYesterdayAlert() {
    try {
      const r = await api.get("/api/daily-sessions/yesterday/alert");
      setYesterdayAlert(r.data.data);
    } catch {
      setYesterdayAlert(null);
    }
  }

  async function loadPastSessions() {
    try {
      const r = await api.get("/api/daily-sessions/");
      setPastSessions(r.data.data || []);
    } catch {
      setPastSessions([]);
    }
  }

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadYesterdayAlert(); }, []);

  const moneyTotal = DENOMS.reduce((s, d) => s + Number(counts[d] || 0) * d, 0);
  const sess = summary?.session;
  const expected = summary?.expected_cash ?? 0;
  const discrepancy = summary?.discrepancy;

  async function handleClose() {
    if (!actualCash) return;
    setClosing(true);
    try {
      await api.post("/api/daily-sessions/today/close", {
        actual_cash: Number(actualCash),
        notes: closeNotes,
      });
      loadSummary();
    } catch (e) {
      alert(e.response?.data?.message || "خطأ في الإغلاق");
    } finally {
      setClosing(false);
    }
  }

  async function handleWithdrawal() {
    if (!wdAmount) return;
    try {
      await api.post("/api/daily-sessions/today/withdrawals", {
        amount: Number(wdAmount),
        note: wdNote,
      });
      setWdOpen(false);
      setWdAmount("");
      setWdNote("");
      loadSummary();
    } catch (e) {
      alert(e.response?.data?.message || "خطأ");
    }
  }

  async function handleQuickSave() {
    if (!quickAmount) return;
    try {
      if (quickModal === "expense") {
        await api.post("/api/expenses", {
          amount: Number(quickAmount),
          notes: quickNote,
          payment_method: "cash",
        });
      } else {
        await api.post("/api/revenues", {
          amount: Number(quickAmount),
          notes: quickNote,
        });
      }
      setQuickModal(null);
      setQuickAmount("");
      setQuickNote("");
      loadSummary();
      loadTransactions();
    } catch (e) {
      alert(e.response?.data?.message || "خطأ");
    }
  }

  async function handleForceCloseYesterday() {
    setClosingYesterday(true);
    try {
      await api.post("/api/daily-sessions/yesterday/force-close");
      setYesterdayAlert(null);
    } catch (e) {
      alert(e.response?.data?.message || "خطأ");
    } finally {
      setClosingYesterday(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const sortedTransactions = transactions;
  const txTotal = sortedTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl">
      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">الخزينة اليومية</h1>
            <p className="text-[11px] font-bold text-slate-400">تسوية ومراجعة الحركات اليومية</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => { setDate(e.target.value); setActiveTab("pos"); }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 outline-none focus:border-emerald-500"
          />
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-black ${isClosed ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            {isClosed ? <><Lock className="h-3 w-3" /> مغلق</> : <><CheckCircle2 className="h-3 w-3" /> مفتوح</>}
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 select-none">
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={compareYesterday}
              onChange={(e) => setCompareYesterday(e.target.checked)}
            />
            مقارنة بالأمس
          </label>

          <button
            onClick={() => { setHistoryOpen(true); loadPastSessions(); }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-black text-slate-600 hover:bg-slate-50"
          >
            <Calendar className="h-4 w-4" /> أيام سابقة
          </button>
          <button
            onClick={loadSummary}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handlePrint}
            className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-black text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> طباعة تقرير
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Main Content ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto p-4 gap-4 pb-0">

          {/* Smart Alerts Banner */}
          {yesterdayAlert?.unclosed && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-[13px] font-black text-amber-800">
                  يوم أمس ({yesterdayAlert.session?.date}) لم يُغلق بعد
                </span>
              </div>
              <button
                onClick={handleForceCloseYesterday}
                disabled={closingYesterday}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-black text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {closingYesterday ? "جاري الإغلاق..." : "إغلاق يوم أمس"}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black">
              جاري التحميل...
            </div>
          ) : !sess ? (
            <div className="flex items-center justify-center h-40 text-slate-400 font-black">
              لا توجد جلسة لهذا اليوم
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-3 shrink-0">
                {[
                  {
                    label: "إجمالي المبيعات",
                    value: summary?.pos_all_sales,
                    yesterday: summary?.yesterday?.pos_all_sales,
                    icon: TrendingUp,
                    color: "emerald",
                  },
                  {
                    label: "إجمالي المصروفات",
                    value: summary?.expenses_cash,
                    yesterday: summary?.yesterday?.expenses_cash,
                    icon: TrendingDown,
                    color: "rose",
                  },
                  {
                    label: "صافي اليوم",
                    value: (summary?.pos_cash_sales || 0) - (summary?.expenses_cash || 0),
                    icon: Wallet,
                    color: "blue",
                  },
                  {
                    label: "الفرق (عجز/زيادة)",
                    value: discrepancy,
                    icon: Calculator,
                    color: discrepancy == null ? "slate" : discrepancy >= 0 ? "emerald" : "rose",
                  },
                ].map(({ label, value, yesterday, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-${color}-50 shrink-0`}>
                        <Icon className={`h-4 w-4 text-${color}-600`} />
                      </div>
                    </div>
                    <div className={`text-[20px] font-black font-mono tracking-tight ${value != null && value < 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {value != null ? fmt(value) : "—"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold mt-0.5">ج.م</div>
                    {compareYesterday && yesterday != null && (
                      <div className="mt-1.5 text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-1">
                        أمس: {fmt(yesterday)} ج.م
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Read-only notice for historical days */}
              {!isToday && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 shrink-0">
                  <Lock className="h-4 w-4 text-blue-500" />
                  <span className="text-[12px] font-black text-blue-700">عرض للقراءة فقط — يوم {date}</span>
                </div>
              )}

              {/* Quick Actions — today only, open only */}
              {isToday && !isClosed && (
                <div className="grid grid-cols-4 gap-3 shrink-0">
                  <button
                    onClick={() => setQuickModal("expense")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-[13px] font-black text-white hover:bg-rose-700 transition-colors shadow-lg shadow-rose-100"
                  >
                    <Plus className="h-4 w-4" /> مصروف سريع
                  </button>
                  <button
                    onClick={() => setQuickModal("revenue")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-[13px] font-black text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                  >
                    <Plus className="h-4 w-4" /> إيراد سريع
                  </button>
                  <button
                    onClick={() => setMoneyOpen(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-[13px] font-black text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    <Calculator className="h-4 w-4" /> عد العملة
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white py-3 text-[13px] font-black text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" /> طباعة تقرير اليوم
                  </button>
                </div>
              )}

              {/* Equation Card */}
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm shrink-0">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-slate-500" />
                  <h3 className="text-[13px] font-black text-slate-700">معادلة الخزينة</h3>
                </div>
                <div className="p-5 space-y-1.5 font-mono text-[13px]">
                  {[
                    { label: "الرصيد الافتتاحي", value: summary?.opening_balance, tab: null, locked: true },
                    { label: "+ مبيعات POS (نقدي)", value: summary?.pos_cash_sales, tab: "pos" },
                    { label: "- مشتريات", value: summary?.purchases_cash, tab: "purchases", negative: true },
                    { label: "- مصروفات", value: summary?.expenses_cash, tab: "expenses", negative: true },
                    { label: "+ إيرادات", value: summary?.revenues_cash, tab: "revenues" },
                    { label: "+ مدفوعات عملاء (نقدي)", value: summary?.customer_payments, tab: "customer_payments" },
                    { label: "- مسحوبات", value: summary?.withdrawals, tab: "withdrawals", negative: true },
                  ].map(({ label, value, tab, locked, negative }) => (
                    <div
                      key={label}
                      onClick={() => { if (tab) { setActiveTab(tab); } }}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${tab ? "cursor-pointer hover:bg-slate-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {locked && <Lock className="h-3 w-3 text-slate-300" />}
                        <span className="text-slate-600 font-bold">{label}</span>
                        {tab && <ChevronRight className="h-3 w-3 text-slate-300" />}
                      </div>
                      <span className={`font-black ${negative && value > 0 ? "text-rose-700" : "text-slate-800"}`}>
                        {fmt(value)} ج.م
                      </span>
                    </div>
                  ))}
                  <div className="border-t-2 border-slate-200 pt-3 mt-2 flex items-center justify-between">
                    <span className="text-[14px] font-black text-slate-900">= المتوقع في الخزينة</span>
                    <span className="text-[20px] font-black font-mono text-emerald-700">{fmt(expected)} ج.م</span>
                  </div>
                  {sess.actual_cash != null && (
                    <div className={`flex items-center justify-between rounded-lg p-3 mt-1 ${discrepancy >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                      <div>
                        <div className="font-black text-[12px] text-slate-600">الرصيد الفعلي</div>
                        <div className={`font-black text-[11px] mt-0.5 ${discrepancy >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          الفرق: {discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)} ج.م
                        </div>
                      </div>
                      <span className={`font-black text-[18px] font-mono ${discrepancy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {fmt(sess.actual_cash)} ج.م
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Global Amount Search */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
                  <Search className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    value={globalAmountSearch}
                    onChange={(e) => { setGlobalAmountSearch(e.target.value); if (e.target.value) setActiveTab("all"); }}
                    placeholder="بحث بالمبلغ في كل الحركات..."
                    className="flex-1 text-[13px] font-bold outline-none bg-transparent placeholder:text-slate-300"
                  />
                  {globalAmountSearch && (
                    <button onClick={() => setGlobalAmountSearch("")} className="text-slate-300 hover:text-slate-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tabbed Transaction Explorer */}
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col shrink-0" style={{ minHeight: 360 }}>
                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2 overflow-x-auto">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setActiveTab(t.id); setGlobalAmountSearch(""); }}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-black transition-colors ${
                        activeTab === t.id ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 mr-auto shrink-0">
                    <input
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      placeholder="بحث..."
                      className="h-8 w-40 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-400"
                    />
                    <select
                      value={txSort}
                      onChange={(e) => setTxSort(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 px-2 text-[11px] font-black outline-none text-slate-600"
                    >
                      <option value="time_desc">الأحدث أولاً</option>
                      <option value="time_asc">الأقدم أولاً</option>
                      <option value="amount_desc">المبلغ تنازلي</option>
                      <option value="amount_asc">المبلغ تصاعدي</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-y-auto flex-1">
                  {txLoading ? (
                    <div className="flex items-center justify-center h-24 text-slate-400 text-[12px] font-black">
                      جاري التحميل...
                    </div>
                  ) : sortedTransactions.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-slate-300 text-[12px] font-black">
                      لا توجد حركات
                    </div>
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          {["الكود", "النوع", "المبلغ", "الطرف / الوصف", "الوقت", "إجراءات"].map((h) => (
                            <th key={h} className="px-3 py-2 text-right font-black text-slate-500 text-[11px] border-b border-slate-100">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTransactions.map((t, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/70">
                            <td className="px-3 py-2 font-black text-slate-600">{t.doc_no || `#${t.id}`}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${DOC_TYPE_COLOR[t.doc_type] || "text-slate-600 bg-slate-100"}`}>
                                {DOC_TYPE_LABEL[t.doc_type] || t.doc_type}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-black text-slate-900 font-mono">{fmt(t.amount)}</td>
                            <td className="px-3 py-2 text-slate-600 max-w-[180px] truncate">
                              {t.party || t.description || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                              {t.created_at
                                ? new Date(t.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setSlideOver(t)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100"
                                >
                                  <ExternalLink className="h-3 w-3" /> فتح
                                </button>
                                <button
                                  onClick={() => window.print()}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100"
                                >
                                  <Printer className="h-3 w-3" />
                                </button>
                                <button className="flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-[10px] font-black text-amber-600 hover:bg-amber-50">
                                  <Flag className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 sticky bottom-0">
                        <tr>
                          <td className="px-3 py-2 font-black text-slate-700" colSpan={2}>
                            الإجمالي
                          </td>
                          <td className="px-3 py-2 font-black text-slate-900 font-mono">
                            {fmt(txTotal)} ج.م
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>

              {/* Day Close Section — today open only */}
              {isToday && !isClosed && (
                <div className="rounded-xl bg-white border border-slate-200 shadow-sm shrink-0 mb-4">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-500" />
                    <h3 className="text-[13px] font-black text-slate-700">إغلاق اليوم</h3>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-6">
                    {/* Left: actual cash + discrepancy */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-black text-slate-600 block mb-1">
                          الرصيد الفعلي (ج.م)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                            className="flex-1 h-11 rounded-xl border border-slate-300 px-4 text-[15px] font-black outline-none focus:border-emerald-500 text-center"
                            placeholder="0.00"
                          />
                          <button
                            onClick={() => setMoneyOpen(true)}
                            className="h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[11px] font-black text-blue-700 hover:bg-blue-100"
                          >
                            <Calculator className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {actualCash && (
                        <div className={`text-center rounded-xl py-3 text-[13px] font-black ${Number(actualCash) - expected >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                          الفرق: {Number(actualCash) - expected >= 0 ? "+" : ""}{fmt(Number(actualCash) - expected)} ج.م
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] font-black text-slate-600 block mb-1">ملاحظات</label>
                        <textarea
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          className="w-full h-16 rounded-xl border border-slate-300 px-3 py-2 text-[12px] outline-none resize-none focus:border-slate-400"
                          placeholder="ملاحظات اختيارية..."
                        />
                      </div>
                      <button
                        onClick={handleClose}
                        disabled={!actualCash || closing}
                        className="w-full rounded-xl bg-slate-900 py-3 text-[14px] font-black text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      >
                        {closing ? "جاري الإغلاق..." : "إغلاق اليوم"}
                      </button>
                    </div>

                    {/* Right: withdrawals list */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-slate-600">المسحوبات اليومية</span>
                        <button
                          onClick={() => setWdOpen(true)}
                          className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-black text-white hover:bg-slate-700"
                        >
                          <Plus className="h-3 w-3" /> إضافة
                        </button>
                      </div>
                      {wdList.length === 0 ? (
                        <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-slate-200 text-slate-300 text-[12px] font-black">
                          لا توجد مسحوبات
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {wdList.map((w, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                              <span className="text-[11px] text-slate-600">{w.description || "مسحوبات"}</span>
                              <span className="text-[12px] font-black text-rose-700 font-mono">{fmt(w.amount)} ج.م</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2">
                            <span className="text-[11px] font-black text-rose-700">الإجمالي</span>
                            <span className="text-[12px] font-black text-rose-700 font-mono">
                              {fmt(wdList.reduce((s, w) => s + Number(w.amount || 0), 0))} ج.م
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Slide-over Panel ── */}
      {slideOver && (
        <div className="fixed inset-0 z-50 flex justify-start" dir="rtl">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSlideOver(null)} />
          <div className="relative w-[420px] h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[15px] font-black text-slate-900">
                  {DOC_TYPE_LABEL[slideOver.doc_type] || "مستند"}
                </h2>
                <p className="text-[11px] text-slate-400 font-bold">{slideOver.doc_no || `#${slideOver.id}`}</p>
              </div>
              <button onClick={() => setSlideOver(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                {[
                  { label: "المبلغ", value: `${fmt(slideOver.amount)} ج.م` },
                  { label: "الطرف", value: slideOver.party || "—" },
                  { label: "الوصف", value: slideOver.description || slideOver.notes || "—" },
                  { label: "النوع", value: DOC_TYPE_LABEL[slideOver.doc_type] || slideOver.doc_type },
                  {
                    label: "الوقت",
                    value: slideOver.created_at
                      ? new Date(slideOver.created_at).toLocaleString("ar-EG")
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="text-[11px] font-black text-slate-400 shrink-0">{label}</span>
                    <span className="text-[13px] font-bold text-slate-800 text-left">{value}</span>
                  </div>
                ))}
              </div>
              <div className={`rounded-xl px-4 py-3 text-center text-[20px] font-black font-mono ${DOC_TYPE_COLOR[slideOver.doc_type] || ""}`}>
                {fmt(slideOver.amount)} ج.م
              </div>
            </div>
            <div className="border-t border-slate-100 p-4">
              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-[13px] font-black text-white hover:bg-slate-700"
              >
                <Printer className="h-4 w-4" /> طباعة المستند
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Drawer ── */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" dir="rtl">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-[340px] h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-black text-slate-900">أيام سابقة</h2>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pastSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setDate(s.date); setHistoryOpen(false); }}
                  className={`w-full flex items-center justify-between px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50 text-right ${date === s.date ? "bg-emerald-50" : ""}`}
                >
                  <div>
                    <div className="text-[13px] font-black text-slate-800">{s.date}</div>
                    <div className="text-[11px] text-slate-400 font-bold mt-0.5">
                      رصيد ختامي: {fmt(s.closing_balance)} ج.م
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${s.status === "closed" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {s.status === "closed" ? "مغلق" : "مفتوح"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Expense/Revenue Modal ── */}
      {quickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl bg-white shadow-2xl p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-black text-slate-900">
                {quickModal === "expense" ? "➕ مصروف سريع" : "➕ إيراد سريع"}
              </h2>
              <button onClick={() => setQuickModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="number"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                autoFocus
                placeholder="المبلغ (ج.م)"
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-[16px] font-black outline-none focus:border-emerald-500 text-center"
              />
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="الوصف / الملاحظة"
                className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[13px] outline-none focus:border-slate-400"
              />
              <button
                onClick={handleQuickSave}
                disabled={!quickAmount}
                className={`w-full rounded-xl py-3 text-[14px] font-black text-white transition-colors disabled:opacity-40 ${
                  quickModal === "expense" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Withdrawal Modal ── */}
      {wdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl bg-white shadow-2xl p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-black text-slate-900">إضافة مسحوبات</h2>
              <button onClick={() => setWdOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="number"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                autoFocus
                placeholder="المبلغ (ج.م)"
                className="w-full h-12 rounded-xl border border-slate-300 px-4 text-[16px] font-black outline-none focus:border-slate-800 text-center"
              />
              <input
                type="text"
                value={wdNote}
                onChange={(e) => setWdNote(e.target.value)}
                placeholder="السبب / الملاحظة"
                className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[13px] outline-none"
              />
              <button
                onClick={handleWithdrawal}
                disabled={!wdAmount}
                className="w-full rounded-xl bg-slate-800 py-3 text-[14px] font-black text-white hover:bg-slate-700 disabled:opacity-40"
              >
                تسجيل المسحوبات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Money Count Modal ── */}
      {moneyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[440px] rounded-2xl bg-white shadow-2xl p-6 max-h-[90vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-black text-slate-900">🧮 عد العملة</h2>
              <button onClick={() => setMoneyOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 mb-4">
              <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 px-2">
                <span>الفئة</span>
                <span className="text-center">العدد</span>
                <span className="text-left">المجموع</span>
              </div>
              {DENOMS.map((d) => (
                <div key={d} className="grid grid-cols-3 items-center gap-2 mb-2">
                  <span className="text-[13px] font-black text-slate-700">
                    {d >= 1 ? `${d} ج.م` : `${d * 100} قرش`}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={counts[d] || ""}
                    onChange={(e) => setCounts((p) => ({ ...p, [d]: e.target.value }))}
                    className="h-9 rounded-lg border border-slate-300 px-2 text-center text-[13px] font-black outline-none focus:border-emerald-500"
                    placeholder="0"
                  />
                  <span className="text-[13px] font-mono text-slate-600 text-left">
                    {fmt(Number(counts[d] || 0) * d)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-4">
              <span className="font-black text-emerald-800 text-[14px]">الإجمالي</span>
              <span className="text-[22px] font-black font-mono text-emerald-700">{fmt(moneyTotal)} ج.م</span>
            </div>
            <button
              onClick={() => { setActualCash(String(moneyTotal)); setMoneyOpen(false); }}
              className="w-full rounded-xl bg-emerald-600 py-3 text-[14px] font-black text-white hover:bg-emerald-700"
            >
              تأكيد وتعبئة الرصيد الفعلي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
