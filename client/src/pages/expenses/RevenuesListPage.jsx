import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TrendingUp, Plus, Pencil, Trash2, Search, Calendar, X, Layers, Activity, RefreshCw, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import { fuzzyFilterRows } from "../../utils/search";

const fmt = (n) => Number(n || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function RevenuesListPage() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [catFilter, setCatFilter] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ amount: "", category_id: "", description: "", notes: "", payment_method: "cash" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rR, cR] = await Promise.all([
        api.get(`/api/revenues?date_from=${dateFrom}&date_to=${dateTo}${catFilter ? `&category_id=${catFilter}` : ""}`),
        api.get("/api/revenues/categories"),
      ]);
      setRows(rR.data.data || []);
      setCategories(cR.data.data || []);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, catFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => fuzzyFilterRows(rows, query, ["description", "notes", "category_name"]), [rows, query]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const todayAmt = rows.filter(r => r.created_at?.slice(0, 10) === today()).reduce((s, r) => s + Number(r.amount || 0), 0);
    const byCat = rows.reduce((acc, r) => { const c = r.category_name || "غير مصنف"; acc[c] = (acc[c] || 0) + Number(r.amount); return acc; }, {});
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
    return { total, todayAmt, topCat: topCat[0], topCatAmt: topCat[1], count: rows.length };
  }, [rows]);

  async function handleSave() {
    if (!form.amount) return;
    setSaving(true);
    try {
      if (editRow) { await api.put(`/api/revenues/${editRow.id}`, form); toast.success("تم التعديل"); }
      else { await api.post("/api/revenues", form); toast.success("تم تسجيل الإيراد"); }
      setForm({ amount: "", category_id: "", description: "", notes: "", payment_method: "cash" });
      setEditRow(null); setQuickOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm("تأكيد الحذف؟")) return;
    try { await api.delete(`/api/revenues/${id}`); toast.success("تم الحذف"); load(); }
    catch { toast.error("فشل الحذف"); }
  }

  function openEdit(row) {
    setEditRow(row);
    setForm({ amount: row.amount, category_id: row.category_id || "", description: row.description || "", notes: row.notes || "", payment_method: row.payment_method || "cash" });
    setQuickOpen(true);
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-200">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">إدارة الإيرادات</h1>
            <p className="text-[11px] font-bold text-slate-400">تسجيل ومتابعة الإيرادات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => { setEditRow(null); setForm({ amount: "", category_id: "", description: "", notes: "", payment_method: "cash" }); setQuickOpen(!quickOpen); }}
            className="flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[12px] font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200">
            <Plus className="h-4 w-4" /> إضافة إيراد
          </button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3 p-4 shrink-0">
        {[
          { label: "اليوم", val: fmt(stats.todayAmt) + " ج.م", icon: Calendar, color: "emerald" },
          { label: "الإجمالي (الفترة)", val: fmt(stats.total) + " ج.م", icon: TrendingUp, color: "slate" },
          { label: "أعلى فئة", val: stats.topCat, sub: fmt(stats.topCatAmt) + " ج.م", icon: Layers, color: "blue" },
          { label: "عدد الحركات", val: stats.count, icon: Activity, color: "violet" },
        ].map(({ label, val, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-${color}-50`}>
                <Icon className={`h-4 w-4 text-${color}-600`} />
              </div>
            </div>
            <div className="text-[18px] font-black text-slate-900 truncate">{val}</div>
            {sub && <div className="text-[10px] text-slate-400 font-bold mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {quickOpen && (
        <div className="mx-4 mb-3 rounded-2xl bg-white border border-emerald-200 shadow-md p-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-black text-slate-800">{editRow ? "تعديل الإيراد" : "إضافة إيراد جديد"}</h3>
            <button onClick={() => { setQuickOpen(false); setEditRow(null); }}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1">
              <label className="text-[11px] font-black text-slate-500 block mb-1">المبلغ *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} autoFocus
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[13px] font-black text-center outline-none focus:border-emerald-500" placeholder="0.00" />
            </div>
            <div className="col-span-1">
              <label className="text-[11px] font-black text-slate-500 block mb-1">الفئة</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] font-bold outline-none bg-white focus:border-emerald-500">
                <option value="">غير مصنف</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-black text-slate-500 block mb-1">الوصف</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] outline-none focus:border-slate-400" placeholder="وصف الإيراد..." />
            </div>
            <div className="col-span-1">
              <label className="text-[11px] font-black text-slate-500 block mb-1">طريقة الدفع</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full h-10 rounded-xl border border-slate-300 px-3 text-[12px] font-bold outline-none bg-white">
                <option value="cash">نقدي</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>
            <div className="col-span-1 flex items-end">
              <button onClick={handleSave} disabled={!form.amount || saving}
                className="w-full h-10 rounded-xl bg-emerald-600 text-[12px] font-black text-white hover:bg-emerald-700 disabled:opacity-40">
                {saving ? "حفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="بحث..."
            className="h-9 w-52 rounded-xl border border-slate-200 pr-9 pl-3 text-[12px] outline-none focus:border-emerald-400" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <span className="text-slate-400 text-[12px]">إلى</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] outline-none" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-bold bg-white outline-none">
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Link to="/definitions/revenue-categories"
          className="flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 px-3 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors">
          <Settings2 className="h-3.5 w-3.5" /> إدارة الفئات
        </Link>
        <span className="text-[11px] text-slate-400 font-bold mr-auto">{filtered.length} نتيجة</span>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["الكود", "التاريخ", "الفئة", "الوصف", "المبلغ", "طريقة الدفع", "إجراءات"].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-black animate-pulse">جاري التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-300 font-black">لا توجد إيرادات</td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="border-b border-slate-50 group hover:bg-emerald-50/20 transition-colors">
                  <td className="px-4 py-3 font-black font-mono text-[11px] text-slate-500">{row.doc_no || `REV-${String(row.id).padStart(5, "0")}`}</td>
                  <td className="px-4 py-3 text-slate-500">{row.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{row.category_name || "عام"}</span></td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="font-bold text-slate-700 truncate">{row.description || "—"}</div>
                    {row.notes && <div className="text-[10px] text-slate-400 truncate">{row.notes}</div>}
                  </td>
                  <td className="px-4 py-3 font-black font-mono text-emerald-700">{fmt(row.amount)} ج.م</td>
                  <td className="px-4 py-3 text-slate-500">{row.payment_method || "نقدي"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(row)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(row.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-black text-slate-700 text-[12px]">الإجمالي</td>
                  <td className="px-4 py-3 font-black font-mono text-emerald-700">{fmt(filtered.reduce((s, r) => s + Number(r.amount || 0), 0))} ج.م</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
