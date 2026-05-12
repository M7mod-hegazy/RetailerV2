import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, X, AlertCircle } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  PAGE_PERMISSIONS,
  DEFAULT_USER_PERMISSIONS,
  ALL_ACTIONS,
} from "../../constants/pagePermissions";

const ACTION_LABELS = {
  view: "رؤية",
  add: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  print: "طباعة",
};

function buildEmptyPermissions() {
  return Object.keys(PAGE_PERMISSIONS).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function applyTemplate(template) {
  const base = buildEmptyPermissions();
  Object.entries(template || {}).forEach(([page, actions]) => {
    if (base[page]) base[page] = [...actions];
  });
  return base;
}

export default function DefaultPermissionsModal({ open, onClose }) {
  const [permissions, setPermissions] = useState(buildEmptyPermissions());
  const [permTemplate, setPermTemplate] = useState("user");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load default permissions on mount
  useEffect(() => {
    if (open) {
      loadDefaultPermissions();
    }
  }, [open]);

  async function loadDefaultPermissions() {
    setLoading(true);
    try {
      const res = await api.get("/api/settings/default-user-permissions");
      const loaded = res.data?.data || {};
      const merged = buildEmptyPermissions();
      Object.entries(loaded).forEach(([k, v]) => {
        if (merged[k] !== undefined && Array.isArray(v)) merged[k] = v;
      });
      setPermissions(merged);
    } catch {
      setPermissions(buildEmptyPermissions());
      toast.error("تعذر تحميل الصلاحيات الافتراضية");
    } finally {
      setLoading(false);
    }
  }

  function toggleAction(pageKey, action) {
    setPermissions((prev) => {
      const current = prev[pageKey] || [];
      const has = current.includes(action);
      const next = has
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [pageKey]: next };
    });
  }

  function handleApplyTemplate() {
    if (permTemplate === "user") {
      setPermissions(applyTemplate(DEFAULT_USER_PERMISSIONS));
      toast.success("تم تطبيق القالب الافتراضي");
    } else if (permTemplate === "admin") {
      const full = buildEmptyPermissions();
      Object.keys(full).forEach((k) => {
        full[k] = [...ALL_ACTIONS];
      });
      setPermissions(full);
      toast.success("تم تطبيق قالب المدير");
    } else if (permTemplate === "none") {
      setPermissions(buildEmptyPermissions());
      toast.success("تم مسح جميع الصلاحيات");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Strip pages with no actions to keep payload compact
      const compact = {};
      Object.entries(permissions).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) compact[k] = v;
      });
      await api.put("/api/settings/default-user-permissions", {
        permissions: compact,
      });
      toast.success("تم حفظ الصلاحيات الافتراضية");
      onClose();
    } catch {
      toast.error("فشل حفظ الصلاحيات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col w-full max-w-6xl" dir="rtl">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-black text-zinc-900">
                    إعدادات الصلاحيات الافتراضية
                  </h2>
                  <p className="text-[11px] font-bold text-slate-500">
                    تطبق على جميع المستخدمين الجدد فقط
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-8 flex flex-col gap-6">
                  {/* Warning note */}
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
                    <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <div className="text-[12px] font-black uppercase tracking-widest text-blue-900">
                        تنبيه مهم
                      </div>
                      <div className="text-[11px] font-bold text-blue-800">
                        يؤثر على المستخدمين الجدد فقط. لن يتأثر المستخدمون الحاليون بهذه التغييرات.
                      </div>
                    </div>
                  </div>

                  {/* Template selector */}
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">
                      قالب مسبق
                    </label>
                    <select
                      value={permTemplate}
                      onChange={(e) => setPermTemplate(e.target.value)}
                      className="flex-1 h-9 bg-white rounded-lg px-2 text-xs font-bold text-zinc-900 outline-none border border-slate-200 focus:border-zinc-400"
                    >
                      <option value="user">مستخدم (افتراضي)</option>
                      <option value="admin">مدير (الكل)</option>
                      <option value="none">بدون صلاحيات</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleApplyTemplate}
                      className="h-9 px-3 rounded-lg bg-zinc-950 text-white text-[11px] font-black hover:bg-zinc-800 transition"
                    >
                      تطبيق
                    </button>
                  </div>

                  {/* Matrix */}
                  {loading ? (
                    <div className="text-center py-16 text-sm font-bold text-slate-400">
                      جاري التحميل...
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-right p-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                              الصفحة
                            </th>
                            {ALL_ACTIONS.map((a) => (
                              <th
                                key={a}
                                className="text-center p-2 text-[10px] font-black uppercase tracking-widest text-slate-600 w-14"
                              >
                                {ACTION_LABELS[a]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(PAGE_PERMISSIONS).map(
                            ([pageKey, meta]) => (
                              <tr
                                key={pageKey}
                                className="border-t border-slate-100 hover:bg-slate-50/60"
                              >
                                <td className="text-right p-2 text-[12px] font-bold text-slate-800">
                                  {meta.label}
                                </td>
                                {ALL_ACTIONS.map((a) => {
                                  const enabled = meta.actions.includes(a);
                                  const checked =
                                    (permissions[pageKey] || []).includes(a);
                                  return (
                                    <td
                                      key={a}
                                      className="text-center p-2"
                                    >
                                      {enabled ? (
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() =>
                                            toggleAction(pageKey, a)
                                          }
                                          className="h-4 w-4 accent-zinc-900 cursor-pointer"
                                        />
                                      ) : (
                                        <span className="text-slate-200">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50 px-8 py-4 flex items-center justify-end gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="h-10 px-6 rounded-xl border border-slate-300 text-[12px] font-black text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  إلغاء
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="h-10 px-6 rounded-xl bg-zinc-950 text-white text-[12px] font-black flex items-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
