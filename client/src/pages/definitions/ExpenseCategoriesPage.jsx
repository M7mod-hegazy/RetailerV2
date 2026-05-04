import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, TrendingDown } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function ExpenseCategoriesPage() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", parent_id: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setCats((await api.get("/api/expenses/categories")).data.data || []); }
    catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm({ name: "", parent_id: "" }); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, parent_id: c.parent_id || "" }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.put(`/api/expenses/categories/${editing.id}`, form);
      else await api.post("/api/expenses/categories", form);
      setModalOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.message || "خطأ"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm("تأكيد الحذف؟")) return;
    try { await api.delete(`/api/expenses/categories/${id}`); load(); }
    catch { toast.error("فشل الحذف"); }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 shadow-lg shadow-rose-200">
            <TrendingDown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900">أقسام المصروفات</h1>
            <p className="text-[11px] font-bold text-slate-400">تصنيف المصروفات التشغيلية</p>
          </div>
        </div>
        <button onClick={openCreate} className="flex h-9 items-center gap-2 rounded-xl bg-rose-600 px-4 text-[12px] font-black text-white hover:bg-rose-700 shadow-lg shadow-rose-200">
          <Plus className="h-4 w-4" /> إضافة قسم
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{["#", "اسم القسم", "القسم الأب", "إجراءات"].map(h => <th key={h} className="px-4 py-3 text-right font-black text-slate-500 text-[11px] uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="py-16 text-center text-slate-400 font-black animate-pulse">جاري التحميل...</td></tr>
              : cats.length === 0 ? <tr><td colSpan={4} className="py-16 text-center text-slate-300 font-black">لا توجد أقسام</td></tr>
              : cats.map(c => (
                <tr key={c.id} className="border-b border-slate-50 group hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-black text-[11px]">{c.id}</td>
                  <td className="px-4 py-3 font-black text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-400">{cats.find(p => p.id === c.parent_id)?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => openEdit(c)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(c.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[360px] rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-black text-slate-900">{editing ? "تعديل القسم" : "إضافة قسم"}</h2>
              <button onClick={() => setModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">اسم القسم *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[13px] font-bold outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-600 block mb-1.5">القسم الأب (اختياري)</label>
                <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-slate-300 px-4 text-[12px] font-bold outline-none bg-white focus:border-rose-500">
                  <option value="">لا يوجد (رئيسي)</option>
                  {cats.filter(c => c.id !== editing?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button onClick={handleSave} disabled={!form.name.trim() || saving}
                className="w-full rounded-xl bg-rose-600 py-3 text-[13px] font-black text-white hover:bg-rose-700 disabled:opacity-40">
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
