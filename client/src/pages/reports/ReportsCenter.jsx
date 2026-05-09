import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Play, Settings2, Filter, Trash2, CalendarDays, LayoutTemplate } from "lucide-react";
import { reportsApi } from "../../services/reports";
import { useReportsStore } from "../../stores/reportsStore";
import { CATEGORIES, COST_METHODS, SCOPE_OPTIONS, fmtDate, FORMAT_ICONS } from "./reportsCenterConfig";
import { RSelect, RDate, DatePresets, ScopeSelector, ColumnPreviewStrip, GhostPreviewRows, ColumnToggleList, DATE_PRESETS } from "./reportsCenterParts";

export default function ReportsCenter() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const store = useReportsStore();
  const today = useMemo(() => new Date(), []);
  
  // Default dates
  const defaultFrom = useMemo(() => fmtDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
  const defaultTo = useMemo(() => fmtDate(today), [today]);

  const { data: registry } = useQuery({
    queryKey: ["report-registry"],
    queryFn: () => reportsApi.fetchRegistry(),
    staleTime: 5 * 60 * 1000,
  });

  const REPORTS = registry?.reports || [];

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  
  // Local Configurator State
  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const [scope, setScope] = useState({ type: "all", values: [] });
  const [colVisibility, setColVisibility] = useState({});
  const [filterValues, setFilterValues] = useState({});
  const [presetName, setPresetName] = useState("");

  // Sync selected report
  useEffect(() => {
    if (REPORTS.length > 0 && !selectedId) setSelectedId(REPORTS[0].id);
  }, [REPORTS, selectedId]);

  // Sync configurator state when report changes
  useEffect(() => {
    const report = REPORTS.find((r) => r.id === selectedId);
    if (report) {
      setFilterValues(store.getPreference(report.slug, "lastFilters", {}));
      setColVisibility(store.getPreference(report.slug, "columnVisibility", {}));
      setScope({ type: "all", values: [] }); // Reset scope on report change
    }
  }, [selectedId, REPORTS, store]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = REPORTS;
    if (activeCat !== "all") rows = rows.filter((r) => r.cat === activeCat);
    if (onlyFavs) rows = rows.filter((r) => store.favorites.has(r.id));
    if (q) {
      rows = rows.filter((r) => {
        const title = t(r.title_key || r.title || "").toLowerCase();
        const desc = t(r.desc_key || r.desc || "").toLowerCase();
        return title.includes(q) || desc.includes(q) || r.id.toLowerCase().includes(q);
      });
    }
    return rows;
  }, [activeCat, store.favorites, onlyFavs, search, REPORTS, t]);

  const selectedReport = useMemo(() => filtered.find((r) => r.id === selectedId) || null, [filtered, selectedId]);

  function handleRunReport(report) {
    if (!report) return;
    store.setPreference(report.slug, "columnVisibility", colVisibility);
    store.setLastFilters(report.slug, filterValues);
    store.pushRecent(report.id);

    const params = {};
    if (report.supportsDates && dateRange.from && dateRange.to) {
      params.start_date = dateRange.from;
      params.end_date = dateRange.to;
    }
    if (report.filters) {
      report.filters.forEach((f) => {
        const v = filterValues[f.key];
        if (v !== undefined && v !== null && v !== "") params[f.key] = v;
      });
    }
    // Pass scope/entity filter values
    if (scope.type === "category" && scope.values?.length) {
      params.category_id = scope.values[0];
    } else if (scope.type === "product" && scope.values?.length) {
      params.item_id = scope.values[0];
    } else if (scope.type === "customer" && scope.values?.length) {
      params.customer_id = scope.values[0];
    } else if (scope.type === "supplier" && scope.values?.length) {
      params.supplier_id = scope.values[0];
    }

    const costMethod = store.getPreference(report.slug, "costMethod", "wacc");
    if (costMethod && report.hasProfit) params.cost_method = costMethod;

    const qs = new URLSearchParams(params).toString();
    navigate(`/reports/${report.slug}${qs ? `?${qs}` : ""}`);
  }

  function handleSavePreset() {
    if (!presetName.trim() || !selectedReport) return;
    store.savePreset(presetName.trim(), selectedReport.slug, filterValues, "wacc");
    setPresetName("");
  }

  const selectedCategory = CATEGORIES.find((cat) => cat.id === selectedReport?.cat);
  const invalidRange = dateRange.from > dateRange.to;
  const reportPresets = store.presets.filter((p) => p.slug === selectedReport?.slug);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#fafafa] text-zinc-900" dir="rtl" style={{ fontFamily: "Satoshi, sans-serif" }}>
      
      {/* 2. MIDDLE & TOP RAIL (Report Master Grid) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fafafa]">
        
        {/* 1. TOP RAIL (Categories) */}
        <div className="shrink-0 border-b border-zinc-200 bg-white flex items-center px-6 py-3 gap-3 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4 mr-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-zinc-900 text-white">
              <LayoutTemplate size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[14px] font-black text-zinc-900 ml-2">التقارير</span>
          </div>
          <button
            onClick={() => setActiveCat("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all font-bold text-[13px] whitespace-nowrap ${
              activeCat === "all" ? "bg-zinc-100 text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            الكل
          </button>
          {CATEGORIES.map((cat) => {
            const active = activeCat === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all duration-300 font-bold text-[13px] whitespace-nowrap ${
                  active ? "bg-white shadow-sm border border-zinc-200" : "hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700"
                }`}
                style={active ? { color: cat.color } : {}}
              >
                <cat.icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? "" : "group-hover:scale-110 transition-transform"} />
                {cat.label}
                {active && (
                  <motion.div layoutId="activeRailTop" className="absolute bottom-0 left-4 right-4 h-1 rounded-t-full" style={{ backgroundColor: cat.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Header / Search */}
        <div className="shrink-0 px-8 py-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">مركز التقارير</h1>
            <p className="text-sm font-medium text-zinc-500 mt-1">الاستعلامات والتحليلات البيانية الذكية</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 group">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في التقارير (اسم، كود، وصف)..."
                className="w-full h-12 rounded-2xl border border-zinc-200 bg-white pl-4 pr-12 text-[14px] font-bold text-zinc-900 placeholder:text-zinc-400 shadow-sm transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
              />
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-emerald-500" />
            </div>
            <button
              onClick={() => setOnlyFavs(!onlyFavs)}
              className={`flex h-12 items-center gap-2 rounded-2xl border px-5 text-[13px] font-bold transition-all shadow-sm ${
                onlyFavs ? "border-amber-400 bg-amber-50 text-amber-600" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              <Star size={16} fill={onlyFavs ? "currentColor" : "none"} /> المفضلة
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-12 scrollbar-thin scrollbar-thumb-zinc-300">
          <div className="max-w-4xl mx-auto w-full">
            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-4"><Search size={24} /></div>
                <h3 className="text-[16px] font-black text-zinc-900 mb-1">لا توجد تقارير مطابقة</h3>
                <p className="text-[13px] text-zinc-500">جرب البحث بكلمات أخرى أو تغيير الفئة.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-max items-start">
                {filtered.map((report) => {
                  const cat = CATEGORIES.find((c) => c.id === report.cat) || CATEGORIES[0];
                  const sel = selectedId === report.id;
                  const fav = store.favorites.has(report.id);
                  const exportFormats = report.exportFormats || ["pdf", "excel", "print"];
                  const cardVisibility = sel ? colVisibility : store.getPreference(report.slug, "columnVisibility", {});
                  return (
                    <div
                      key={report.id}
                      onClick={() => setSelectedId(report.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-[24px] p-5 transition-all duration-300 cursor-pointer text-right border ${
                        sel 
                          ? "bg-white border-emerald-500 shadow-[0_8px_30px_rgba(5,150,105,0.12)] ring-1 ring-emerald-500" 
                          : "bg-white border-zinc-200 shadow-sm hover:border-emerald-300 hover:shadow-md"
                      }`}
                    >
                      {/* Top Row: Icon + Title + Fav */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 group-hover:bg-white transition-colors" style={{ color: cat.color }}>
                            <cat.icon size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-zinc-500">{cat.label} · {report.id}</div>
                            <h3 className={`text-[15px] font-black leading-tight transition-colors ${sel ? "text-emerald-600" : "text-zinc-900 group-hover:text-emerald-600"}`}>
                              {t(report.title_key || report.title) || report.title}
                            </h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); store.toggleFavorite(report.id); }}
                          className={`shrink-0 p-1.5 rounded-full transition-colors ${fav ? "text-amber-500 bg-amber-50" : "text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100"}`}
                        >
                          <Star size={16} fill={fav ? "currentColor" : "none"} strokeWidth={fav ? 0 : 2} />
                        </button>
                      </div>

                      <p className="text-[13px] leading-relaxed text-zinc-500 line-clamp-2 mb-4">
                        {t(report.desc_key || report.desc) || report.desc}
                      </p>

                      {/* Embedded Preview */}
                      <div className="mt-auto pt-4 border-t border-zinc-100">
                        <div className="text-[10px] font-bold text-zinc-400 mb-2">أعمدة التقرير ومعاينة:</div>
                        <ColumnPreviewStrip catId={report.cat} colVisibility={cardVisibility} report={report} />
                        <GhostPreviewRows catId={report.cat} colVisibility={cardVisibility} report={report} />
                      </div>

                      {/* Export Hints */}
                      <div className="absolute bottom-5 left-5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {exportFormats.map(fmt => {
                          const Cfg = FORMAT_ICONS[fmt];
                          if (!Cfg) return null;
                          return <div key={fmt} className="h-6 w-6 rounded flex items-center justify-center bg-zinc-50" style={{color: Cfg.color}} title={Cfg.label}><Cfg.icon size={12} strokeWidth={2.5}/></div>
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. LEFT (Configurator Inspector) */}
      <AnimatePresence mode="wait">
        {selectedReport && selectedCategory ? (
          <motion.div
            key={selectedReport.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-[420px] shrink-0 border-r border-zinc-200 bg-white flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.04)]"
          >
            {/* Inspector Header */}
            <div className="shrink-0 p-8 border-b border-zinc-100 bg-zinc-50/50">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">إعدادات التقرير</div>
              <h2 className="text-[20px] font-black text-zinc-900 leading-tight">
                {t(selectedReport.title_key || selectedReport.title) || selectedReport.title}
              </h2>
            </div>

            {/* Inspector Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scrollbar-thin scrollbar-thumb-zinc-200">
              
              {/* 1. Scope Selector */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-emerald-500"></span> النطاق التحليلي
                </h3>
                <ScopeSelector
                  scopeOptions={SCOPE_OPTIONS[selectedReport.cat] || SCOPE_OPTIONS.sales}
                  scope={scope}
                  onScopeChange={setScope}
                />
              </div>

              {/* 2. Date Range */}
              {selectedReport.supportsDates && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> الفترة الزمنية
                  </h3>
                  <DatePresets activeFrom={dateRange.from} activeTo={dateRange.to} onApply={setDateRange} />
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">من تاريخ</label>
                      <RDate value={dateRange.from} onChange={(v) => setDateRange({ ...dateRange, from: v })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">إلى تاريخ</label>
                      <RDate value={dateRange.to} onChange={(v) => setDateRange({ ...dateRange, to: v })} />
                    </div>
                  </div>
                  {invalidRange && <div className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg mt-2 border border-red-100">تاريخ البداية يجب أن يكون قبل تاريخ النهاية.</div>}
                </div>
              )}

              {/* 3. Column Toggles */}
              <div className="space-y-3">
                <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-emerald-500"></span> الأعمدة المعروضة
                </h3>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4">
                  <ColumnToggleList catId={selectedReport.cat} colVisibility={colVisibility} onChange={setColVisibility} report={selectedReport} />
                </div>
              </div>

              {/* 4. Cost Method */}
              {selectedReport.hasProfit && (
                <div className="space-y-3">
                  <h3 className="text-[12px] font-black text-zinc-900 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-emerald-500"></span> التقييم المالي
                  </h3>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">طريقة حساب التكلفة للربحية</label>
                  <RSelect
                    value={store.getPreference(selectedReport.slug, "costMethod", "wacc")}
                    onChange={(v) => store.setCostMethod(selectedReport.slug, v)}
                    options={COST_METHODS}
                  />
                </div>
              )}

            </div>

            {/* Inspector Footer Action */}
            <div className="shrink-0 p-6 border-t border-zinc-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
              <button
                onClick={() => handleRunReport(selectedReport)}
                disabled={invalidRange}
                className="w-full relative flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-6 py-4 text-[15px] font-black text-white transition-all hover:bg-emerald-600 hover:shadow-lg disabled:opacity-50 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  <Play size={18} fill="currentColor" className="transition-transform group-hover:scale-110" />
                  تشغيل التقرير
                </span>
              </button>
            </div>

          </motion.div>
        ) : (
          <div className="w-[420px] shrink-0 border-r border-zinc-200 bg-white flex flex-col items-center justify-center text-center p-8">
            <Settings2 size={40} className="text-zinc-200 mb-4" />
            <p className="text-[14px] font-bold text-zinc-400">حدد تقريراً لعرض إعداداته</p>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
