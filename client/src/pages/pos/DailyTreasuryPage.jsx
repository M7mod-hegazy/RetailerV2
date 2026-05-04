import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen, RefreshCw, Plus, Printer, Lock, Wallet,
  AlertCircle, CheckCircle2, X, ArrowDownRight, Calculator,
  Calendar, ChevronRight, Flag, ExternalLink, TrendingUp,
  TrendingDown, Search, Clock, ArrowUpDown, Filter,
  FileText, Coins, Banknote, History,
  Edit3, RotateCcw, Eye, Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import SmartTooltip from "../../components/ui/SmartTooltip";
import PrintPreviewModal from "../../components/print/PrintPreviewModal";
import ExpenseFormModal from "../expenses/ExpenseFormModal";
import RevenueFormModal from "../expenses/RevenueFormModal";

const fmt = (n) =>
  Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DENOMS = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25];

const DOC_TYPE_LABEL = {
  pos_invoice: "فاتورة POS",
  expense: "مصروف",
  revenue: "إيراد",
  purchase: "مشتريات",
  supplier_payment: "مدفوعات موردين",
  sales_return: "مرتجعات مبيعات",
  purchase_return: "مرتجعات مشتريات",
  ajal_payment: "تحصيل آجل",
  customer_payment: "دفعة عميل",
  withdrawal: "مسحوبات",
};

const DOC_TYPE_COLOR = {
  pos_invoice: "text-emerald-700 bg-emerald-50 border-emerald-200",
  expense: "text-rose-700 bg-rose-50 border-rose-200",
  revenue: "text-blue-700 bg-blue-50 border-blue-200",
  purchase: "text-orange-700 bg-orange-50 border-orange-200",
  supplier_payment: "text-red-700 bg-red-50 border-red-200",
  sales_return: "text-pink-700 bg-pink-50 border-pink-200",
  purchase_return: "text-teal-700 bg-teal-50 border-teal-200",
  ajal_payment: "text-cyan-700 bg-cyan-50 border-cyan-200",
  customer_payment: "text-purple-700 bg-purple-50 border-purple-200",
  withdrawal: "text-slate-700 bg-slate-100 border-slate-200",
};

const TABS = [
  { id: "all", label: "كل الحركات" },
  { id: "pos", label: "فواتير POS" },
  { id: "expenses", label: "المصروفات" },
  { id: "revenues", label: "الإيرادات" },
  { id: "purchases", label: "المشتريات" },
  { id: "supplier_payments", label: "مدفوعات موردين" },
  { id: "sales_returns", label: "مرتجعات المبيعات" },
  { id: "purchase_returns", label: "مرتجعات المشتريات" },
  { id: "customer_payments", label: "مدفوعات العملاء" },
  { id: "ajal_payments", label: "تحصيلات الآجل" },
  { id: "withdrawals", label: "المسحوبات" },
];

export default function DailyTreasuryPage() {
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
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
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);

  // Alerts
  const [yesterdayAlert, setYesterdayAlert] = useState(null);
  const [closingYesterday, setClosingYesterday] = useState(false);

  // Slide-over
  const [slideOver, setSlideOver] = useState(null);

  // History drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");

  // Compare yesterday
  const [compareYesterday, setCompareYesterday] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [openingEditOpen, setOpeningEditOpen] = useState(false);
  const [openingDraft, setOpeningDraft] = useState("");
  const [openingReason, setOpeningReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

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
      const typeParam = activeTab === "all" ? "" : activeTab;
      const r = await api.get(
        `/api/daily-sessions/today/transactions?type=${typeParam}&search=${encodeURIComponent(searchParam)}${dateParam}`
      );
      let rows = r.data.data || [];
      if (txSort === "amount_asc") rows = [...rows].sort((a, b) => a.amount - b.amount);
      else if (txSort === "amount_desc") rows = [...rows].sort((a, b) => b.amount - a.amount);
      else if (txSort === "time_asc") rows = [...rows].sort((a, b) => a.created_at?.localeCompare(b.created_at));
      else if (txSort === "time_desc") rows = [...rows].sort((a, b) => b.created_at?.localeCompare(a.created_at));
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
      const params = new URLSearchParams();
      if (historySearch) params.set("search", historySearch);
      if (historyStatus) params.set("status", historyStatus);
      const r = await api.get(`/api/daily-sessions/?${params.toString()}`);
      setPastSessions(r.data.data || []);
    } catch {
      setPastSessions([]);
    }
  }

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadYesterdayAlert(); }, []);
  useEffect(() => { if (historyOpen) loadPastSessions(); }, [historyOpen, historySearch, historyStatus]);

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
      toast.success("تم إغلاق اليومية بنجاح");
      loadSummary();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الإغلاق");
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
      toast.success("تم تسجيل المسحوبات بنجاح");
      setWdOpen(false);
      setWdAmount("");
      setWdNote("");
      loadSummary();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
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
      toast.success(quickModal === "expense" ? "تم تسجيل المصروف بنجاح" : "تم تسجيل الإيراد بنجاح");
      setQuickModal(null);
      setQuickAmount("");
      setQuickNote("");
      loadSummary();
      loadTransactions();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    }
  }

  async function handleForceCloseYesterday() {
    setClosingYesterday(true);
    try {
      await api.post("/api/daily-sessions/yesterday/force-close");
      toast.success("تم إغلاق يوم أمس بالقوة");
      setYesterdayAlert(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ");
    } finally {
      setClosingYesterday(false);
    }
  }

  function handlePrint() {
    setPrintOpen(true);
  }

  const sortedTransactions = transactions;
  const txTotal = sortedTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const draftDiscrepancy = actualCash !== "" ? Number(actualCash || 0) - Number(expected || 0) : null;
  const cashIn = Number(summary?.cash_in || 0);
  const cashOut = Number(summary?.cash_out || 0);
  const discrepancySuggestions = (() => {
    const diff = draftDiscrepancy ?? discrepancy;
    if (diff == null || Math.abs(diff) < 0.01) {
      return ["الرصيد متطابق. أغلق اليومية بعد مراجعة آخر حركة فقط."];
    }
    const abs = fmt(Math.abs(diff));
    if (diff < 0) {
      return [
        `يوجد عجز ${abs} ج.م. راجع المصروفات والمسحوبات ومدفوعات الموردين المسجلة اليوم.`,
        "قارن آخر فواتير POS النقدية مع درج النقد، وتأكد من عدم تسجيل تحصيل كاش كبنك أو العكس.",
        "إذا كان العجز حقيقياً، اكتب سبب واضح في ملاحظات الإغلاق قبل الاعتماد.",
      ];
    }
    return [
      `يوجد زيادة ${abs} ج.م. ابحث عن إيراد أو تحصيل عميل غير مسجل.`,
      "راجع مرتجعات المبيعات لأن أي رد نقدي ناقص التسجيل يظهر كزيادة في الدرج.",
      "استخدم بحث المبلغ بنفس قيمة الفرق للوصول السريع لحركة محتملة.",
    ];
  })();

  async function confirmCloseDay() {
    if (!actualCash) return;
    setClosing(true);
    try {
      await api.post(isToday ? "/api/daily-sessions/today/close" : `/api/daily-sessions/${date}/close`, {
        actual_cash: Number(actualCash),
        notes: closeNotes,
      });
      toast.success("تم إغلاق اليومية بنجاح");
      setCloseConfirmOpen(false);
      loadSummary();
      loadPastSessions();
    } catch (e) {
      toast.error(e.response?.data?.message || "خطأ في الإغلاق");
    } finally {
      setClosing(false);
    }
  }

  async function saveOpeningBalance() {
    if (openingDraft === "") return;
    try {
      await api.patch(`/api/daily-sessions/${date}/opening-balance`, {
        opening_balance: Number(openingDraft),
        reason: openingReason,
      });
      toast.success("تم تعديل الرصيد الافتتاحي");
      setOpeningEditOpen(false);
      setOpeningReason("");
      loadSummary();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذر تعديل الرصيد الافتتاحي");
    }
  }

  async function reopenDay() {
    setReopening(true);
    try {
      await api.post(`/api/daily-sessions/${date}/reopen`, { reason: reopenReason });
      toast.success("تمت إعادة فتح اليومية");
      setReopenReason("");
      loadSummary();
      loadPastSessions();
    } catch (e) {
      toast.error(e.response?.data?.message || "تعذر إعادة فتح اليومية");
    } finally {
      setReopening(false);
    }
  }

  function refreshAfterFinanceModal() {
    loadSummary();
    loadTransactions();
    loadYesterdayAlert();
  }

  // Animation variants
  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans overflow-x-hidden w-full max-w-full relative" dir="rtl">
      {/* Impeccable Animated Architectural Background */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Base Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        {/* Cinematic Shimmer Sweep */}
        <motion.div 
          animate={{ x: ["-150%", "200%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-[40%] h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 mix-blend-overlay"
        />
        {/* Center Spotlight / Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_30%,transparent_0%,rgba(248,250,252,0.95)_100%)]" />
      </div>

      {/* Cinematic Hero Header */}
      <header className="relative z-10 w-full pt-12 pb-8 px-6 shrink-0">
        <motion.div 
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div className="flex flex-col items-start justify-center">
            <motion.div variants={fadeInUp} className="flex items-center gap-3 text-slate-400 mb-6">
              <div className="h-px w-8 bg-slate-300"></div>
              <Wallet className="h-4 w-4" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] font-mono">المالية // تسوية ومراجعة الحركات</span>
            </motion.div>
            
            <motion.h1 variants={fadeInUp} className="max-w-4xl text-5xl md:text-6xl font-black text-zinc-950 tracking-tighter leading-[1.1]">
              الخزينة اليومية
            </motion.h1>
          </div>

          <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-3 bg-white/80 backdrop-blur-md p-3 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50">
            <div className="relative">
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => { setDate(e.target.value); setActiveTab("all"); }}
                className="h-12 rounded-2xl border border-slate-200 bg-white/50 px-4 text-[13px] font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
              />
            </div>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setDate(todayStr()); setActiveTab("all"); setGlobalAmountSearch(""); }}
              className={`flex h-12 items-center gap-2 rounded-2xl px-4 text-[13px] font-black transition-colors ${
                isToday ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Calendar className="h-4 w-4" /> اليوم
            </motion.button>
            
            <div className={`flex items-center gap-2 h-12 px-4 rounded-2xl border ${isClosed ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"}`}>
              {isClosed ? <Lock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="text-[13px] font-black">{isClosed ? "مغلق" : "مفتوح"}</span>
            </div>

            <label className="flex items-center gap-2 h-12 cursor-pointer rounded-2xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 transition-colors select-none">
              <input
                type="checkbox"
                className="accent-emerald-600 h-4 w-4 rounded"
                checked={compareYesterday}
                onChange={(e) => setCompareYesterday(e.target.checked)}
              />
              مقارنة بالأمس
            </label>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setHistoryOpen(true); loadPastSessions(); }}
              className="flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-[13px] font-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
            >
              <History className="h-4 w-4 text-emerald-400" /> الأيام السابقة
            </motion.button>
            
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadSummary}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>
            
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePrint}
              className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-[13px] font-black text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer className="h-4 w-4" /> طباعة تقرير
            </motion.button>
          </motion.div>
        </motion.div>
      </header>

      {/* Main Grid Layout (AIDA: Interest & Action) */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-8 pb-8">
        <motion.div 
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="flex flex-col gap-4"
        >
          {/* Smart Alerts Banner */}
          <AnimatePresence>
            {yesterdayAlert?.unclosed && (
              <motion.div 
                initial={{ opacity: 0, height: 0, mb: 0 }}
                animate={{ opacity: 1, height: 'auto', mb: 24 }}
                exit={{ opacity: 0, height: 0, mb: 0 }}
                className="flex items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50/80 backdrop-blur-md px-6 py-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-2xl bg-amber-100 text-amber-600 shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-black text-amber-900">تنبيه إغلاق جلسة سابقة</h3>
                    <span className="text-[12px] font-bold text-amber-700">
                      يوم أمس ({yesterdayAlert.session?.date}) لم يُغلق بعد. يجب إغلاق الجلسة السابقة لضمان صحة الأرصدة.
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleForceCloseYesterday}
                  disabled={closingYesterday}
                  className="rounded-2xl bg-amber-600 px-6 py-3 text-[13px] font-black text-white hover:bg-amber-700 disabled:opacity-50 shadow-lg shadow-amber-600/20 transition-all shrink-0"
                >
                  {closingYesterday ? "جاري الإغلاق..." : "إغلاق يوم أمس"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
                <span className="text-[14px] font-black text-slate-400">جاري تحميل بيانات الخزينة...</span>
              </div>
            </div>
          ) : !sess ? (
            <div className="flex items-center justify-center h-64 rounded-3xl border border-dashed border-slate-300 bg-white/50 backdrop-blur-md">
              <span className="text-[15px] font-black text-slate-400">لا توجد جلسة مفتوحة لهذا اليوم.</span>
            </div>
          ) : (
            <>
              {/* Read-only notice for historical days */}
              {!isToday && (
                <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-blue-500" />
                    <span className="text-[13px] font-black text-blue-800">عرض يوم {date} للقراءة والمراجعة. لا يتم السماح بإدخال حركات على يوم مغلق.</span>
                  </div>
                  {isClosed && (
                    <div className="flex items-center gap-2">
                      <input
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="سبب إعادة الفتح"
                        className="h-9 w-48 rounded-xl border border-blue-200 bg-white px-3 text-[11px] font-bold outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={reopenDay}
                        disabled={reopening || !reopenReason.trim()}
                        className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-700 px-3 text-[11px] font-black text-white hover:bg-blue-800 disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> إعادة فتح آخر يوم
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Quick Actions (If open and today) */}
              {isToday && !isClosed && (
                <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setExpenseOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-rose-600 py-4 text-[14px] font-black text-white hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 border border-rose-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><TrendingDown className="h-4 w-4" /></div>
                    تسجيل مصروف سريع
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRevenueOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-emerald-600 py-4 text-[14px] font-black text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 border border-emerald-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><TrendingUp className="h-4 w-4" /></div>
                    تسجيل إيراد سريع
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMoneyOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-blue-600 py-4 text-[14px] font-black text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 border border-blue-500"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Coins className="h-4 w-4" /></div>
                    عد العملة (جرد الخزينة)
                  </motion.button>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setWdOpen(true)}
                    className="flex items-center justify-center gap-3 rounded-3xl bg-slate-900 py-4 text-[14px] font-black text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 border border-slate-800"
                  >
                    <div className="bg-white/20 p-1.5 rounded-xl"><Banknote className="h-4 w-4" /></div>
                    تسجيل مسحوبات
                  </motion.button>
                </motion.div>
              )}

              {/* KPI Cards */}
              <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <div key={label} className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                    <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-${color}-50/50 blur-xl group-hover:bg-${color}-100/50 transition-colors`}></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">{label}</span>
                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-${color}-50 text-${color}-600 ring-1 ring-inset ring-${color}-100 shadow-sm shrink-0`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div>
                        <div className={`text-[22px] font-black font-mono tracking-tighter ${value != null && value < 0 ? "text-rose-600" : "text-zinc-900"}`}>
                          {value != null ? fmt(value) : "—"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">جنيه مصري</div>
                        {compareYesterday && yesterday != null && (
                          <div className="mt-2 text-[10px] text-slate-500 font-bold border-t border-slate-100/80 pt-2 flex items-center justify-between">
                            <span>بالأمس:</span>
                            <span className="font-mono">{fmt(yesterday)} ج.م</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Right Area: Transactions (8 columns) */}
                <motion.div variants={fadeInUp} className="xl:col-span-8 flex flex-col gap-4">
                  
                  {/* Search Bar */}
                  <div className="relative group w-full">
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-zinc-900 transition-colors" />
                    <input
                      value={globalAmountSearch}
                      onChange={(e) => { setGlobalAmountSearch(e.target.value); if (e.target.value) setActiveTab("all"); }}
                      placeholder="البحث الشامل برقم الفاتورة، المبلغ، أو اسم العميل..."
                      className="w-full h-12 bg-white/80 backdrop-blur-xl rounded-2xl pr-12 pl-4 text-[13px] font-bold text-zinc-800 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-zinc-900/5 shadow-sm border border-slate-200/60 placeholder:text-slate-400"
                    />
                    {globalAmountSearch && (
                      <button onClick={() => setGlobalAmountSearch("")} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 bg-slate-100 rounded-full p-1 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Transaction Explorer */}
                  <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden" style={{ minHeight: 350 }}>
                    {/* Tab bar */}
                    <div className="flex items-center gap-1.5 border-b border-slate-100/80 px-3 py-2 overflow-x-auto scrollbar-hide">
                      {TABS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setActiveTab(t.id); setGlobalAmountSearch(""); }}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                            activeTab === t.id ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20" : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 mr-auto shrink-0 pr-3">
                        <div className="relative">
                          <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                          <select
                            value={txSort}
                            onChange={(e) => setTxSort(e.target.value)}
                            className="h-8 rounded-lg bg-slate-50 border border-slate-200 pl-3 pr-8 text-[11px] font-black outline-none text-slate-600 focus:border-zinc-400 appearance-none cursor-pointer"
                          >
                            <option value="time_desc">الأحدث أولاً</option>
                            <option value="time_asc">الأقدم أولاً</option>
                            <option value="amount_desc">المبلغ (تنازلي)</option>
                            <option value="amount_asc">المبلغ (تصاعدي)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto relative p-2">
                      {txLoading ? (
                        <div className="flex items-center justify-center h-full min-h-[300px]">
                          <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
                        </div>
                      ) : sortedTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3">
                          <FileText className="h-10 w-10 text-slate-200" />
                          <span className="text-[13px] font-black">لا توجد حركات مسجلة في هذا التبويب</span>
                        </div>
                      ) : (
                        <table className="w-full text-right border-collapse">
                          <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl shadow-[0_1px_0_0_#f1f5f9]">
                            <tr>
                              {["الكود", "النوع", "المبلغ", "الطرف / الوصف", "الوقت", "إجراءات"].map((h, i) => (
                                <th key={h} className={`px-3 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest select-none ${i===0?'rounded-tr-xl':''} ${i===5?'rounded-tl-xl':''}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            <AnimatePresence>
                              {sortedTransactions.map((t) => (
                                <motion.tr 
                                  key={t.id}
                                  layout
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  whileHover={{ x: -2, backgroundColor: "rgba(248,250,252,0.8)" }}
                                  className="group transition-colors relative"
                                >
                                  <td className="px-3 py-3 font-black text-slate-500 text-[11px] tracking-wider">{t.doc_no || `#${t.id}`}</td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex items-center justify-center rounded-lg border px-2 py-0.5 text-[9px] font-black ${DOC_TYPE_COLOR[t.doc_type] || "text-slate-600 bg-slate-100 border-slate-200"}`}>
                                      {DOC_TYPE_LABEL[t.doc_type] || t.doc_type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-col">
                                      <span className={`font-black font-mono text-[12px] ${Number(t.cash_effect ?? t.amount) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                        {Number(t.cash_effect ?? t.amount) > 0 ? "+" : ""}{fmt(t.cash_effect ?? t.amount)}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400">أصل الحركة: {fmt(t.amount)}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-slate-600 text-[11px] font-bold max-w-[180px] truncate">
                                    {t.party || t.description || "—"}
                                  </td>
                                  <td className="px-3 py-3 text-slate-400 text-[10px] whitespace-nowrap font-medium">
                                    {t.created_at
                                      ? new Date(t.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1.5 opacity-100 transition-opacity">
                                      <button
                                        onClick={() => setSlideOver(t)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-zinc-900 hover:bg-slate-50 shadow-sm transition-all"
                                        title="عرض التفاصيل"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={handlePrint}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all"
                                        title="طباعة"
                                      >
                                        <Printer className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                          <tfoot className="sticky bottom-0 bg-white/95 backdrop-blur-xl shadow-[0_-1px_0_0_#f1f5f9]">
                            <tr>
                              <td className="px-3 py-3 font-black text-slate-500 uppercase tracking-widest text-[10px]" colSpan={2}>
                                الإجمالي للتبويب الحالي
                              </td>
                              <td className="px-3 py-3 font-black text-zinc-950 font-mono text-[13px]">
                                {fmt(txTotal)} ج.م
                              </td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Left Area: Equation & Close Day (4 columns) */}
                <motion.div variants={fadeInUp} className="xl:col-span-4 flex flex-col gap-6 sticky top-6">
                  
                  {/* Equation Card */}
                  <div className="rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                    <div className="px-8 py-5 border-b border-slate-100/80 flex items-center gap-3 bg-slate-50/50">
                      <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-inset ring-indigo-100">
                        <Calculator className="h-4 w-4" />
                      </div>
                      <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">معادلة الخزينة</h3>
                    </div>
                    <div className="p-8 space-y-2">
                      {[
                        { label: "الرصيد الافتتاحي", value: summary?.opening_balance, tab: null, locked: true },
                        { label: "+ مبيعات POS (نقدي)", value: summary?.pos_cash_sales, tab: "pos" },
                        { label: "- مشتريات", value: summary?.purchases_cash, tab: "purchases", negative: true },
                        { label: "- مدفوعات موردين", value: summary?.supplier_payments, tab: "supplier_payments", negative: true },
                        { label: "- مرتجعات مبيعات", value: summary?.sales_returns_cash, tab: "sales_returns", negative: true },
                        { label: "- مصروفات", value: summary?.expenses_cash, tab: "expenses", negative: true },
                        { label: "+ إيرادات", value: summary?.revenues_cash, tab: "revenues" },
                        { label: "+ مرتجعات مشتريات", value: summary?.purchase_returns_cash, tab: "purchase_returns" },
                        { label: "+ مدفوعات عملاء (نقدي)", value: summary?.customer_payments, tab: "customer_payments" },
                        { label: "+ تحصيلات آجل", value: summary?.ajal_payments, tab: "ajal_payments" },
                        { label: "- مسحوبات", value: summary?.withdrawals, tab: "withdrawals", negative: true },
                      ].map(({ label, value, tab, locked, negative }) => (
                        <div
                          key={label}
                          onClick={() => { if (tab) { setActiveTab(tab); setGlobalAmountSearch(""); } }}
                          className={`flex items-center justify-between py-2.5 px-3 rounded-2xl transition-colors ${tab ? "cursor-pointer hover:bg-slate-50" : ""}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {locked ? <Lock className="h-3.5 w-3.5 text-slate-300" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                            <span className="text-[13px] text-slate-600 font-bold">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-[13px] font-mono ${negative && value > 0 ? "text-rose-600" : "text-zinc-800"}`}>
                              {fmt(value)}
                            </span>
                            {locked && !isClosed && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpeningDraft(String(summary?.opening_balance || 0)); setOpeningEditOpen(true); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="تعديل الرصيد الافتتاحي"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 mt-3">
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
                          <div className="text-[10px] font-black text-emerald-600">إجمالي الداخل النقدي</div>
                          <div className="mt-1 text-[15px] font-black font-mono text-emerald-800">{fmt(cashIn)}</div>
                        </div>
                        <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
                          <div className="text-[10px] font-black text-rose-600">إجمالي الخارج النقدي</div>
                          <div className="mt-1 text-[15px] font-black font-mono text-rose-800">{fmt(cashOut)}</div>
                        </div>
                      </div>
                      <div className="border-t border-slate-200/80 pt-4 mt-4 flex items-center justify-between px-2">
                        <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">المتوقع في الخزينة</span>
                        <span className="text-[22px] font-black font-mono text-emerald-600">{fmt(expected)} <span className="text-[12px] text-slate-400">ج.م</span></span>
                      </div>
                      
                      {sess.actual_cash != null && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`flex flex-col rounded-2xl p-4 mt-4 border ${discrepancy >= 0 ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-[12px] text-slate-600">الرصيد الفعلي المدخل</span>
                            <span className={`font-black text-[18px] font-mono ${discrepancy >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                              {fmt(sess.actual_cash)}
                            </span>
                          </div>
                          <div className={`font-black text-[11px] ${discrepancy >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            الفرق الجردي: {discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)} ج.م
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Day Close Section */}
                  {isToday && !isClosed && (
                    <div className="rounded-[2.5rem] bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
                      <div className="px-8 py-5 border-b border-slate-100/80 flex items-center gap-3 bg-slate-50/50">
                        <div className="h-8 w-8 rounded-xl bg-slate-800 text-white flex items-center justify-center">
                          <Lock className="h-4 w-4" />
                        </div>
                        <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">إغلاق الجلسة</h3>
                      </div>
                      <div className="p-8 flex flex-col gap-6">
                        <div className="space-y-4">
                          <div className="flex flex-col gap-2 relative group">
                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                              الرصيد الفعلي (ج.م)
                            </label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  value={actualCash}
                                  onChange={(e) => setActualCash(e.target.value)}
                                  className="w-full h-14 bg-white rounded-2xl px-4 text-[18px] font-black text-zinc-900 outline-none transition-all placeholder:text-slate-300 border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-center font-mono"
                                  placeholder="0.00"
                                />
                              </div>
                              <SmartTooltip content="فتح آلة عد العملات النقدية">
                                <motion.button
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setMoneyOpen(true)}
                                  className="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"
                                >
                                  <Coins className="h-5 w-5" />
                                </motion.button>
                              </SmartTooltip>
                            </div>
                          </div>
                          
                          {actualCash && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`text-center rounded-2xl py-3 px-4 text-[13px] font-black border ${Number(actualCash) - expected >= 0 ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"}`}
                            >
                              الفرق: {Number(actualCash) - expected >= 0 ? "+" : ""}{fmt(Number(actualCash) - expected)} ج.م
                            </motion.div>
                          )}

                          {actualCash && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-700">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> مساعد العجز والزيادة
                              </div>
                              <div className="space-y-1">
                                {discrepancySuggestions.map((tip, idx) => (
                                  <div key={idx} className="text-[11px] font-bold text-slate-500 leading-5">• {tip}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">ملاحظات الإغلاق</label>
                            <textarea
                              value={closeNotes}
                              onChange={(e) => setCloseNotes(e.target.value)}
                              className="w-full h-20 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-[13px] font-bold text-zinc-800 outline-none resize-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 placeholder:text-slate-300 transition-all"
                              placeholder="أضف أي ملاحظات تبرر العجز أو الزيادة..."
                            />
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCloseConfirmOpen(true)}
                          disabled={!actualCash || closing}
                          className="w-full rounded-2xl bg-zinc-950 py-4 text-[15px] font-black text-white hover:bg-zinc-800 disabled:opacity-40 transition-all shadow-xl shadow-zinc-950/20"
                        >
                          {closing ? "جاري الإغلاق والتشفير..." : "إغلاق اليومية واعتماد الأرصدة"}
                        </motion.button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* ── Modals & Drawers ── */}

      {/* Detail Modal */}
      <AnimatePresence>
        {slideOver && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 p-4 overflow-y-auto" dir="rtl"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-xl bg-white shadow-2xl rounded-[2rem] flex flex-col overflow-hidden my-20 mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
                <div>
                  <h2 className="text-[16px] font-black text-zinc-900">
                    {DOC_TYPE_LABEL[slideOver.doc_type] || "مستند مالية"}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold font-mono tracking-wider mt-0.5">{slideOver.doc_no || `#${slideOver.id}`}</p>
                </div>
                <button onClick={() => setSlideOver(null)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-[#fafafa]">
                <div className="rounded-2xl bg-white border border-slate-200/60 shadow-sm overflow-hidden">
                  <div className={`p-4 text-center border-b border-slate-100 ${DOC_TYPE_COLOR[slideOver.doc_type] || "bg-white"}`}>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">القيمة</div>
                    <div className="text-[28px] font-black font-mono leading-none tracking-tighter">
                      {fmt(slideOver.amount)}
                    </div>
                    <div className="text-[10px] font-bold mt-1 opacity-70">جنيه مصري</div>
                  </div>
                  <div className="p-2">
                    {[
                      { label: "الطرف ذو الصلة", value: slideOver.party || "—" },
                      { label: "الوصف / البيان", value: slideOver.description || slideOver.notes || "—" },
                      { label: "التصنيف", value: DOC_TYPE_LABEL[slideOver.doc_type] || slideOver.doc_type },
                      {
                        label: "تاريخ ووقت التسجيل",
                        value: slideOver.created_at
                          ? new Date(slideOver.created_at).toLocaleString("ar-EG")
                          : "—",
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
                        <span className="text-[12px] font-bold text-zinc-900 text-right truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 p-3 bg-white">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-950 py-2.5 text-[12px] font-black text-white hover:bg-zinc-800 shadow-lg shadow-zinc-950/20"
                >
                  <Printer className="h-3.5 w-3.5" /> طباعة إيصال المستند
                </motion.button>
              </div>
            </motion.div>
            <div 
              className="fixed inset-0 -z-10 bg-slate-900/50 backdrop-blur-md" 
              onClick={() => setSlideOver(null)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* History Modal */}
      <AnimatePresence>
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
            <motion.div variants={modalVariants} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-5xl max-h-[86vh] overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-100 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><History className="h-5 w-5" /></div>
                  <div><h2 className="text-[18px] font-black text-zinc-900">سجل اليوميات السابقة</h2><p className="text-[11px] font-bold text-slate-400">بحث، فلترة، ومعاينة مركزية بدون درج جانبي</p></div>
                </div>
                <button onClick={() => setHistoryOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3">
                <div className="relative flex-1 min-w-[240px]"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="بحث بتاريخ اليوم أو ملاحظات الإغلاق" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 text-[12px] font-bold outline-none focus:border-indigo-500 focus:bg-white" /></div>
                <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-black text-slate-600 outline-none focus:border-indigo-500"><option value="">كل الحالات</option><option value="open">مفتوح</option><option value="closed">مغلق</option></select>
                <button onClick={() => { setHistorySearch(""); setHistoryStatus(""); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-500 hover:bg-slate-50">مسح الفلاتر</button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-[#fafafa]">
                <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-right">
                  <thead><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">افتتاحي</th><th className="px-3 py-2">فعلي</th><th className="px-3 py-2">ختامي</th><th className="px-3 py-2">عجز / زيادة</th><th className="px-3 py-2">إجراءات</th></tr></thead>
                  <tbody>
                    {pastSessions.map((s) => (
                      <tr key={s.id} className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
                        <td className="rounded-r-2xl px-3 py-3 font-black text-zinc-900">{s.date}</td>
                        <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-black ${s.status === "closed" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{s.status === "closed" ? <Lock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{s.status === "closed" ? "مغلق" : "مفتوح"}</span></td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{fmt(s.opening_balance)}</td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{s.actual_cash == null ? "—" : fmt(s.actual_cash)}</td>
                        <td className="px-3 py-3 font-mono text-[12px] font-black text-slate-600">{s.closing_balance == null ? "—" : fmt(s.closing_balance)}</td>
                        <td className={`px-3 py-3 font-mono text-[12px] font-black ${Number(s.discrepancy || 0) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{s.discrepancy == null ? "—" : fmt(s.discrepancy)}</td>
                        <td className="rounded-l-2xl px-3 py-3"><button onClick={() => { setDate(s.date); setHistoryOpen(false); setActiveTab("all"); }} className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-[11px] font-black text-white hover:bg-slate-800"><Eye className="h-3.5 w-3.5" /> معاينة</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pastSessions.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3"><History className="h-8 w-8 text-slate-200" /><span className="text-[13px] font-black">لا توجد يوميات مطابقة</span></div>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Modal (Expense/Revenue) */}
      <AnimatePresence>
        {quickModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setQuickModal(null)} 
            />
            <motion.div 
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-white shadow-2xl p-8 border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${quickModal === "expense" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
                    {quickModal === "expense" ? <TrendingDown className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-zinc-900 leading-tight">
                      {quickModal === "expense" ? "تسجيل مصروف" : "تسجيل إيراد"}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Quick Entry</p>
                  </div>
                </div>
                <button onClick={() => setQuickModal(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900 hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">القيمة (ج.م)</label>
                  <input
                    type="number"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 px-4 text-[20px] font-black font-mono outline-none focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">البيان / الوصف</label>
                  <input
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="سبب المعاملة..."
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 px-4 text-[14px] font-bold text-zinc-800 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="pt-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleQuickSave}
                    disabled={!quickAmount}
                    className={`w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-black text-white transition-all shadow-xl disabled:opacity-40 ${
                      quickModal === "expense" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    }`}
                  >
                    <CheckCircle2 className="h-5 w-5" /> حفظ واعتماد
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {wdOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setWdOpen(false)} 
            />
            <motion.div 
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[420px] rounded-[2.5rem] bg-white shadow-2xl p-8 border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-black text-zinc-900 leading-tight">تسجيل مسحوبات</h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Withdrawal</p>
                  </div>
                </div>
                <button onClick={() => setWdOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900 hover:bg-slate-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">مبلغ السحب (ج.م)</label>
                  <input
                    type="number"
                    value={wdAmount}
                    onChange={(e) => setWdAmount(e.target.value)}
                    autoFocus
                    placeholder="0.00"
                    className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 px-4 text-[20px] font-black font-mono outline-none focus:border-zinc-400 focus:bg-white focus:ring-4 focus:ring-zinc-900/5 text-center transition-all shadow-inner"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">البيان / المسحوب له</label>
                  <input
                    type="text"
                    value={wdNote}
                    onChange={(e) => setWdNote(e.target.value)}
                    placeholder="توضيح السبب..."
                    className="w-full h-12 rounded-2xl bg-white border border-slate-200 px-4 text-[14px] font-bold text-zinc-800 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition-all"
                  />
                </div>
                <div className="pt-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleWithdrawal}
                    disabled={!wdAmount}
                    className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-[15px] font-black text-white transition-all shadow-xl shadow-zinc-950/20 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-5 w-5" /> اعتماد السحب
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Money Count Modal */}
      <AnimatePresence>
        {moneyOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={() => setMoneyOpen(false)} 
            />
            <motion.div 
              variants={modalVariants} initial="hidden" animate="show" exit="exit"
              className="relative w-full max-w-[480px] max-h-[90vh] overflow-hidden flex flex-col rounded-[2.5rem] bg-white shadow-2xl border border-slate-100" dir="rtl"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100/80 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Coins className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-black text-zinc-900 leading-tight">آلة الجرد الفعلي</h2>
                    <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Cash Register</p>
                  </div>
                </div>
                <button onClick={() => setMoneyOpen(false)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-zinc-900 hover:bg-slate-50 transition-colors shadow-sm">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="rounded-3xl bg-slate-50 border border-slate-200/60 p-4">
                  <div className="grid grid-cols-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
                    <span>الفئة النقدية</span>
                    <span className="text-center">العدد</span>
                    <span className="text-left">الإجمالي الفرعي</span>
                  </div>
                  <div className="space-y-2">
                    {DENOMS.map((d) => (
                      <div key={d} className="grid grid-cols-3 items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm transition-colors hover:border-blue-200">
                        <span className="text-[14px] font-black text-slate-800 px-2 flex items-center gap-2">
                          <Banknote className="h-4 w-4 text-emerald-500 opacity-50" />
                          {d >= 1 ? `${d} ج` : `${d * 100} قرش`}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={counts[d] || ""}
                          onChange={(e) => setCounts((p) => ({ ...p, [d]: e.target.value }))}
                          className="h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-center text-[15px] font-black font-mono outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                          placeholder="0"
                        />
                        <span className="text-[15px] font-black font-mono text-slate-500 text-left px-2">
                          {fmt(Number(counts[d] || 0) * d)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white shrink-0 space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-100 p-5 shadow-inner">
                  <span className="font-black text-emerald-800 text-[14px] uppercase tracking-widest">مجموع الجرد الفعلي</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[28px] font-black font-mono text-emerald-700 tracking-tighter leading-none">{fmt(moneyTotal)}</span>
                    <span className="text-[12px] font-bold text-emerald-600">ج.م</span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setActualCash(String(moneyTotal)); setMoneyOpen(false); }}
                  className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[15px] font-black text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle2 className="h-5 w-5" /> ترحيل الرصيد للإغلاق
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ExpenseFormModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        onSuccess={refreshAfterFinanceModal}
      />
      <RevenueFormModal
        open={revenueOpen}
        onClose={() => setRevenueOpen(false)}
        onSuccess={refreshAfterFinanceModal}
      />

      <AnimatePresence>
        {openingEditOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setOpeningEditOpen(false)} />
            <motion.div variants={modalVariants} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl border border-slate-100">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-black text-zinc-900">تعديل الرصيد الافتتاحي</h3>
                  <p className="text-[11px] font-bold text-slate-400">مسموح فقط قبل إغلاق اليومية، ويحتاج سبب واضح للمراجعة.</p>
                </div>
                <button onClick={() => setOpeningEditOpen(false)} className="h-9 w-9 rounded-xl bg-slate-50 text-slate-400 hover:text-zinc-900"><X className="mx-auto h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <input
                  type="number"
                  value={openingDraft}
                  onChange={(e) => setOpeningDraft(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-[18px] font-black font-mono outline-none focus:border-indigo-500"
                  placeholder="0.00"
                />
                <textarea
                  value={openingReason}
                  onChange={(e) => setOpeningReason(e.target.value)}
                  className="h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-[12px] font-bold outline-none focus:border-indigo-500"
                  placeholder="سبب التعديل: مثال، تم نقل رصيد إغلاق أمس يدوياً..."
                />
                <button
                  onClick={saveOpeningBalance}
                  disabled={!openingDraft || openingReason.trim().length < 4}
                  className="w-full rounded-xl bg-indigo-700 py-3 text-[13px] font-black text-white hover:bg-indigo-800 disabled:opacity-40"
                >
                  حفظ الرصيد الافتتاحي
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {closeConfirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir="rtl">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setCloseConfirmOpen(false)} />
            <motion.div variants={modalVariants} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl border border-slate-100">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
                <h3 className="text-[18px] font-black text-zinc-900">مراجعة إغلاق اليومية</h3>
                <p className="mt-1 text-[12px] font-bold text-slate-500">راجع النتيجة قبل الاعتماد. بعد الإغلاق سيتم منع إدخال حركات على هذا اليوم حتى تعيد فتحه.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-6">
                {[
                  ["الرصيد الافتتاحي", summary?.opening_balance],
                  ["إجمالي الداخل النقدي", cashIn],
                  ["إجمالي الخارج النقدي", cashOut],
                  ["المتوقع في الخزينة", expected],
                  ["الرصيد الفعلي", actualCash],
                  ["العجز / الزيادة", draftDiscrepancy],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-black text-slate-400">{label}</div>
                    <div className={`mt-1 font-mono text-[18px] font-black ${label === "العجز / الزيادة" && Number(value) < 0 ? "text-rose-700" : "text-zinc-900"}`}>
                      {label === "العجز / الزيادة" && Number(value) > 0 ? "+" : ""}{fmt(value)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mx-6 mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-black text-amber-800"><AlertCircle className="h-4 w-4" /> اقتراحات قبل الإغلاق</div>
                {discrepancySuggestions.map((tip, idx) => <div key={idx} className="text-[11px] font-bold text-amber-700 leading-5">• {tip}</div>)}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <button onClick={() => setCloseConfirmOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-black text-slate-600 hover:bg-slate-50">رجوع للمراجعة</button>
                <button onClick={confirmCloseDay} disabled={closing} className="rounded-xl bg-zinc-950 px-6 py-2 text-[12px] font-black text-white hover:bg-zinc-800 disabled:opacity-40">
                  {closing ? "جاري الإغلاق..." : "اعتماد الإغلاق النهائي"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {printOpen && (
        <PrintPreviewModal
          open={printOpen}
          onClose={() => setPrintOpen(false)}
          docType="daily_treasury"
          renderContent={(settings) => (
            <div style={{ fontFamily: settings.print_font || "Cairo", direction: "rtl", padding: 24, fontSize: 12, color: "#1e293b" }}>
              <div style={{ borderBottom: `3px solid ${settings.accent_color || "#0f172a"}`, paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>تقرير الخزينة اليومية</div>
                <div style={{ color: "#64748b" }}>التاريخ: {date}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>المتوقع</strong><br />{fmt(expected)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>الفعلية</strong><br />{fmt(actualCash || moneyTotal)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>الفروقات</strong><br />{fmt(discrepancy)} ج.م</div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12 }}><strong>عدد الحركات</strong><br />{sortedTransactions.length}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ background: settings.accent_color || "#0f172a", color: "white" }}>{["التاريخ", "النوع", "المرجع", "الطرف", "المبلغ"].map((h) => <th key={h} style={{ padding: 8, textAlign: "right" }}>{h}</th>)}</tr></thead>
                <tbody>{sortedTransactions.map((tx, i) => (
                  <tr key={`${tx.doc_type}-${tx.id}-${i}`} style={{ background: i % 2 ? "white" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: 8 }}>{tx.created_at?.slice(0, 10) || date}</td>
                    <td style={{ padding: 8 }}>{DOC_TYPE_LABEL[tx.doc_type] || tx.doc_type}</td>
                    <td style={{ padding: 8 }}>{tx.doc_no || `#${tx.id}`}</td>
                    <td style={{ padding: 8 }}>{tx.party || tx.description || "—"}</td>
                    <td style={{ padding: 8, fontWeight: 900 }}>{fmt(tx.amount)} ج.م</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        />
      )}
    </div>
  );
}
