import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import ImageUpload from "../../components/ui/ImageUpload";

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

function resolveUrl(u) {
  if (!u) return null;
  return u.startsWith("http") ? u : `${BASE}${u}`;
}

function CatThumb({ url }) {
  const src = resolveUrl(url);
  if (!src) return null;
  return <img src={src} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />;
}

function parseImageUrls(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function nextCode(prefix, items) {
  const next = items.length + 1;
  return `${prefix}.${next}`;
}

// ─── inline add-row at the bottom of each category table ────────────────────

function AddRow({ category, nextNum, onSaved }) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  const previewCode = name.trim() ? `${category.sku_prefix}.${nextNum}` : "";

  async function handleSave(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/items", {
        name: name.trim(),
        barcode: barcode.trim() || null,
        purchase_price: Number(purchasePrice || 0),
        sale_price: 0,
        category_id: category.id,
        code: "",          // trigger server auto-generation
        image_urls: [],
      });
      setName("");
      setBarcode("");
      setPurchasePrice("");
      nameRef.current?.focus();
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر إضافة الصنف.");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSave();
  }

  return (
    <tr className="border-t-2 border-dashed border-emerald-200 bg-emerald-50/40">
      {/* code preview */}
      <td className="w-20 px-2 py-1.5">
        <span className="block rounded bg-emerald-100 px-2 py-1 text-center font-mono text-xs font-black text-emerald-700">
          {previewCode || "—"}
        </span>
      </td>
      {/* name */}
      <td className="px-2 py-1.5">
        <input
          ref={nameRef}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب اسم الصنف…"
          autoComplete="off"
          className="w-full rounded border border-emerald-300 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </td>
      {/* barcode */}
      <td className="w-36 px-2 py-1.5">
        <input
          value={barcode}
          onChange={(ev) => setBarcode(ev.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="باركود"
          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </td>
      {/* purchase price */}
      <td className="w-28 px-2 py-1.5">
        <input
          type="number"
          min="0"
          step="0.01"
          value={purchasePrice}
          onChange={(ev) => setPurchasePrice(ev.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0.00"
          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </td>
      {/* save */}
      <td className="w-16 px-2 py-1.5 text-center">
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow hover:bg-emerald-600 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── editable row (Excel inline edit) ───────────────────────────────────────

function EditableRow({ item, category, onSaved, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", barcode: "", purchase_price: "" });
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft({
      name: item.name || "",
      barcode: item.barcode || "",
      purchase_price: String(item.purchase_price ?? ""),
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/items/${item.id}`, {
        name: draft.name.trim(),
        barcode: draft.barcode.trim() || null,
        purchase_price: Number(draft.purchase_price || 0),
        sale_price: item.sale_price ?? 0,
        category_id: category.id,
        code: item.code || "",
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حفظ التعديلات.");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  }

  async function handleDelete() {
    if (!window.confirm(`حذف الصنف "${item.name}"؟`)) return;
    try {
      await api.delete(`/api/items/${item.id}`);
      toast.success("تم حذف الصنف.");
      onDelete();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حذف الصنف.");
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-slate-100 bg-amber-50/60">
        <td className="w-20 px-2 py-1 text-center font-mono text-xs font-black text-slate-500">{item.code || "—"}</td>
        <td className="px-2 py-1">
          <input
            autoFocus
            value={draft.name}
            onChange={(ev) => setDraft((p) => ({ ...p, name: ev.target.value }))}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
          />
        </td>
        <td className="w-36 px-2 py-1">
          <input
            value={draft.barcode}
            onChange={(ev) => setDraft((p) => ({ ...p, barcode: ev.target.value }))}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
          />
        </td>
        <td className="w-28 px-2 py-1">
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.purchase_price}
            onChange={(ev) => setDraft((p) => ({ ...p, purchase_price: ev.target.value }))}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-amber-300"
          />
        </td>
        <td className="w-16 px-2 py-1">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group border-t border-slate-100 hover:bg-slate-50">
      <td className="w-20 px-3 py-2 font-mono text-xs font-black text-slate-500">{item.code || "—"}</td>
      <td className="px-3 py-2 text-sm font-bold text-slate-800">{item.name}</td>
      <td className="w-36 px-3 py-2 text-xs text-slate-500">{item.barcode || "—"}</td>
      <td className="w-28 px-3 py-2 text-sm font-semibold text-slate-700">
        {Number(item.purchase_price || 0).toFixed(2)}
      </td>
      <td className="w-16 px-2 py-2">
        <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-rose-50 text-rose-500 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catDraft, setCatDraft] = useState({ name: "", image_url: "" });
  const [catModal, setCatModal] = useState(null); // null | {mode:'add'|'edit', data}
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, itemRes] = await Promise.all([
        api.get("/api/categories"),
        api.get("/api/items"),
      ]);
      const cats = Array.isArray(catRes.data?.data) ? catRes.data.data : [];
      const allItems = Array.isArray(itemRes.data?.data) ? itemRes.data.data : [];

      const grouped = {};
      cats.forEach((c) => { grouped[c.id] = []; });
      allItems.forEach((item) => {
        if (item.category_id != null) {
          if (!grouped[item.category_id]) grouped[item.category_id] = [];
          grouped[item.category_id].push(item);
        }
      });

      setCategories(cats);
      setItemsByCategory(grouped);
      setSelectedId((prev) => prev ?? cats[0]?.id ?? null);
    } catch {
      toast.error("تعذر تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function refreshCategory(categoryId) {
    try {
      const res = await api.get("/api/items", { params: { category_id: categoryId } });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setItemsByCategory((prev) => ({ ...prev, [categoryId]: rows }));
    } catch { /* silent */ }
  }

  // ── category CRUD ──
  function openAddCategory() {
    setCatDraft({ name: "", image_url: "" });
    setCatModal({ mode: "add", data: null });
  }

  function openEditCategory(cat) {
    setCatDraft({ name: cat.name, image_url: cat.image_url || "" });
    setCatModal({ mode: "edit", data: cat });
  }

  async function submitCategory(e) {
    e.preventDefault();
    if (!catDraft.name.trim()) return;
    setSaving(true);
    try {
      if (catModal.mode === "add") {
        const res = await api.post("/api/categories", { name: catDraft.name.trim(), image_url: catDraft.image_url || null });
        const newCat = res.data?.data;
        toast.success("تمت إضافة الفئة.");
        setCatModal(null);
        await loadAll();
        if (newCat?.id) setSelectedId(newCat.id);
      } else {
        await api.put(`/api/categories/${catModal.data.id}`, { name: catDraft.name.trim(), image_url: catDraft.image_url || null });
        toast.success("تم تحديث الفئة.");
        setCatModal(null);
        await loadAll();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حفظ الفئة.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(cat) {
    if (!window.confirm(`حذف الفئة "${cat.name}"؟`)) return;
    try {
      await api.delete(`/api/categories/${cat.id}`);
      toast.success("تم حذف الفئة.");
      if (selectedId === cat.id) setSelectedId(null);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "تعذر حذف الفئة.");
    }
  }

  // ── derived ──
  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;
  const selectedItems = selectedId ? (itemsByCategory[selectedId] ?? []) : [];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400" dir="rtl">
        جاري تحميل البيانات…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" dir="rtl">

      {/* ── LEFT PANEL: category list ── */}
      <div className="flex w-56 shrink-0 flex-col border-l border-slate-200">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wide">الفئات</span>
          <button
            type="button"
            onClick={openAddCategory}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow hover:bg-emerald-600"
            title="إضافة فئة"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">لا توجد فئات</p>
          ) : (
            categories.map((cat) => {
              const count = (itemsByCategory[cat.id] ?? []).length;
              const isSelected = cat.id === selectedId;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedId(cat.id)}
                  className={`group flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {/* prefix badge */}
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-black ${
                      isSelected ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {cat.sku_prefix}
                  </span>
                  {/* thumbnail */}
                  {cat.image_url && (
                    <CatThumb url={cat.image_url} />
                  )}
                  {/* name */}
                  <span className="flex-1 truncate text-sm font-bold">{cat.name}</span>
                  {/* count */}
                  <span className="text-xs text-slate-400">{count}</span>
                  {/* edit/delete — visible on hover */}
                  <div
                    className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditCategory(cat)}
                      className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat)}
                      className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: product table ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* panel header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          {selectedCategory ? (
            <>
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-sm font-black text-emerald-700">
                {selectedCategory.sku_prefix}
              </span>
              <h2 className="text-base font-black text-slate-800">{selectedCategory.name}</h2>
              <span className="text-xs text-slate-400">{selectedItems.length} صنف</span>
            </>
          ) : (
            <span className="text-sm text-slate-400">اختر فئة من القائمة لعرض أصنافها</span>
          )}
        </div>

        {/* table */}
        {selectedCategory ? (
          <div className="flex-1 overflow-auto">
            <table className="min-w-full border-collapse text-sm" style={{ direction: "rtl" }}>
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="w-20 border-b border-slate-200 px-3 py-2 text-right text-xs font-black text-slate-500">الكود</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-black text-slate-500">الاسم</th>
                  <th className="w-36 border-b border-slate-200 px-3 py-2 text-right text-xs font-black text-slate-500">الباركود</th>
                  <th className="w-28 border-b border-slate-200 px-3 py-2 text-right text-xs font-black text-slate-500">سعر الشراء</th>
                  <th className="w-16 border-b border-slate-200 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {selectedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      لا توجد أصناف — أضف صنفاً من الصف أدناه
                    </td>
                  </tr>
                )}
                {selectedItems.map((item) => (
                  <EditableRow
                    key={item.id}
                    item={item}
                    category={selectedCategory}
                    onSaved={() => refreshCategory(selectedCategory.id)}
                    onDelete={() => refreshCategory(selectedCategory.id)}
                  />
                ))}

                {/* ── inline add row ── */}
                <AddRow
                  key={`add-${selectedCategory.id}`}
                  category={selectedCategory}
                  nextNum={selectedItems.length + 1}
                  onSaved={() => refreshCategory(selectedCategory.id)}
                />
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            اختر فئة لعرض الأصناف وإضافتها
          </div>
        )}
      </div>

      {/* ── category modal ── */}
      {catModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-black text-slate-800">
              {catModal.mode === "edit" ? "تعديل الفئة" : "إضافة فئة جديدة"}
            </h3>
            <form onSubmit={submitCategory} className="space-y-4">
              {catModal.mode === "edit" && (
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-400">الكود (تلقائي)</label>
                  <input
                    readOnly
                    value={catModal.data.sku_prefix}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-sm font-bold text-slate-500"
                  />
                </div>
              )}
              <div className="flex items-start gap-4">
                <div>
                  <label className="mb-1 block text-xs font-black text-slate-400">صورة الفئة</label>
                  <ImageUpload size="md"
                    url={catDraft.image_url || null}
                    onUpload={(url) => setCatDraft((p) => ({ ...p, image_url: url }))}
                    onRemove={() => setCatDraft((p) => ({ ...p, image_url: "" }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-black text-slate-500">اسم الفئة</label>
                  <input
                    autoFocus
                    value={catDraft.name}
                    onChange={(e) => setCatDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCatModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {saving ? "جاري الحفظ…" : catModal.mode === "edit" ? "حفظ" : "إنشاء"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
