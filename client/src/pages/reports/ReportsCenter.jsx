import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, BarChart3, CalendarDays, Play, Search, Sparkles, Star, FileText, FileSpreadsheet, FileImage, Printer, TrendingUp, Package, Wallet, Receipt, Shield, ClipboardList } from "lucide-react";
import PageWrapper from "../../components/ui/PageWrapper";
import { REPORT_CATALOG, REPORT_CATEGORIES } from "./reportCatalog";

const STORAGE_KEYS = {
  favorites: "reports-center-favorites",
  recents: "reports-center-recents",
};

const CATEGORIES = REPORT_CATEGORIES.map((c) => {
  // Keep existing per-category color semantics but avoid hard-coding labels twice.
  const byId = {
    sales: { color: "#059669", bg: "rgba(5,150,105,0.10)", icon: TrendingUp },
    purchases: { color: "#2563EB", bg: "rgba(37,99,235,0.10)", icon: Package },
    inventory: { color: "#7C3AED", bg: "rgba(124,58,237,0.10)", icon: Package },
    accounts: { color: "#D97706", bg: "rgba(217,119,6,0.10)", icon: Wallet },
    treasury: { color: "#0891B2", bg: "rgba(8,145,178,0.10)", icon: Receipt },
    tax: { color: "#DC2626", bg: "rgba(220,38,38,0.10)", icon: FileText },
    audit: { color: "#475569", bg: "rgba(71,85,105,0.10)", icon: Shield },
  };
  return { ...c, ...(byId[c.id] || { color: "var(--text-secondary)", bg: "var(--bg-overlay)", icon: ClipboardList }) };
});

// Export format icons
const FORMAT_ICONS = {
  pdf: { icon: FileImage, color: "#DC2626", label: "PDF" },
  excel: { icon: FileSpreadsheet, color: "#16A34A", label: "Excel" },
  word: { icon: FileText, color: "#2563EB", label: "Word" },
  print: { icon: Printer, color: "#475569", label: "طباعة" },
};

const REPORTS = REPORT_CATALOG;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function ReportCard({ report, category, selected, favorited, onSelect, onToggleFav, onQuickRun }) {
  const exportFormats = report.exportFormats || ["pdf", "excel", "print"];
  const CategoryIcon = category.icon || ClipboardList;
  
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(report.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(report.id);
        }
      }}
      style={{
        width: "100%",
        textAlign: "start",
        background: selected ? "color-mix(in srgb, var(--bg-surface) 78%, var(--primary-50) 22%)" : "var(--bg-surface)",
        border: `1px solid ${selected ? "var(--primary)" : "var(--border-subtle)"}`,
        borderRadius: "14px",
        borderInlineStart: `4px solid ${category.color}`,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "9px",
        boxShadow: selected ? "var(--shadow-elevated)" : "var(--shadow-card)",
        transition: "180ms ease",
        cursor: "pointer",
      }}
      className="group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div 
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
            style={{ backgroundColor: category.bg, color: category.color }}
          >
            <CategoryIcon size={14} />
          </div>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: category.color, background: category.bg, borderRadius: "999px", padding: "3px 8px" }}>
            {report.id}
          </span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFav(report.id);
          }}
          style={{ background: "none", border: "none", cursor: "pointer", color: favorited ? "#F59E0B" : "var(--border-strong)", transition: "transform 150ms" }}
          className="hover:scale-110"
          aria-label={favorited ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        >
          <Star size={15} fill={favorited ? "currentColor" : "none"} />
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{report.title}</h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>{report.desc}</p>
      </div>

      {/* Export formats row */}
      <div className="flex items-center gap-1.5">
        {exportFormats.map((fmt) => {
          const fmtConfig = FORMAT_ICONS[fmt];
          if (!fmtConfig) return null;
          const FmtIcon = fmtConfig.icon;
          return (
            <div
              key={fmt}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-all hover:scale-105"
              style={{ background: `${fmtConfig.color}10`, color: fmtConfig.color }}
              title={fmtConfig.label}
            >
              <FmtIcon size={10} />
              <span className="text-[9px] font-bold">{fmtConfig.label}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span style={{ width: "fit-content", borderRadius: "999px", padding: "3px 8px", fontSize: "10px", fontWeight: 700, background: report.supportsDates ? "rgba(5,150,105,0.10)" : "rgba(71,85,105,0.10)", color: report.supportsDates ? "#059669" : "#475569" }}>
          {report.supportsDates ? "يدعم فترة زمنية" : "تشغيل مباشر"}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onQuickRun(report);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: category.color, background: category.bg, border: `1px solid ${category.color}30`, borderRadius: "8px", padding: "5px 10px", cursor: "pointer", transition: "all 150ms" }}
          className="hover:scale-105 active:scale-95"
        >
          <Play size={11} />
          تشغيل سريع
        </button>
      </div>
    </div>
  );
}

export default function ReportsCenter() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const defaultFrom = useMemo(() => formatDate(monthStart), [monthStart]);
  const defaultTo = useMemo(() => formatDate(today), [today]);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [favorites, setFavorites] = useState(new Set());
  const [recents, setRecents] = useState({});
  const [selectedId, setSelectedId] = useState(REPORTS[0]?.id || "");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.favorites);
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) setFavorites(new Set(ids));
      }
      const savedRecents = localStorage.getItem(STORAGE_KEYS.recents);
      if (savedRecents) {
        const parsed = JSON.parse(savedRecents);
        if (parsed && typeof parsed === "object") setRecents(parsed);
      }
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.recents, JSON.stringify(recents));
  }, [recents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = REPORTS;
    if (activeCategory !== "all") rows = rows.filter((report) => report.cat === activeCategory);
    if (onlyFavorites) rows = rows.filter((report) => favorites.has(report.id));
    if (q) rows = rows.filter((report) => report.title.toLowerCase().includes(q) || report.desc.toLowerCase().includes(q) || report.id.toLowerCase().includes(q));

    const sorted = [...rows].sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title, "ar");
      if (sortBy === "code") return a.id.localeCompare(b.id);
      if (sortBy === "recent") return (recents[b.id] || 0) - (recents[a.id] || 0);
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return (recents[b.id] || 0) - (recents[a.id] || 0);
    });
    return sorted;
  }, [activeCategory, favorites, onlyFavorites, recents, search, sortBy]);

  const selectedReport = useMemo(() => filtered.find((report) => report.id === selectedId) || filtered[0] || null, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedReport && filtered[0]) setSelectedId(filtered[0].id);
    if (selectedReport && selectedReport.id !== selectedId) setSelectedId(selectedReport.id);
  }, [filtered, selectedId, selectedReport]);

  function markRecent(reportId) {
    setRecents((current) => ({ ...current, [reportId]: Date.now() }));
  }

  function openReport(report, dates) {
    markRecent(report.id);
    if (report.supportsDates && dates?.from && dates?.to) {
      const params = new URLSearchParams({ start_date: dates.from, end_date: dates.to });
      navigate(`/reports/${report.slug}?${params.toString()}`);
      return;
    }
    navigate(`/reports/${report.slug}`);
  }

  function toggleFavorite(id) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCategory = CATEGORIES.find((category) => category.id === selectedReport?.cat) || CATEGORIES[0];
  const invalidRange = from > to;

  return (
    <div className="standard-page-container h-screen w-full flex flex-col overflow-hidden bg-bg-base">
      {/* Sticky Action Bar */}
      <div className="shrink-0 border-b border-border-subtle bg-bg-surface px-6 py-4 shadow-sm z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-info-DEFAULT/10 text-info-DEFAULT">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[13px] font-black uppercase tracking-[0.05em] text-text-primary">
                مركز التقارير
              </h1>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                اختر التقرير أولاً، ثم حدد طريقة التشغيل المناسبة.
              </p>
            </div>
          </div>
          
            <div className="flex items-center gap-4 text-[11px] font-semibold text-text-secondary tracking-[0.05em] uppercase">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-border-strong"></span>
              إجمالي: {REPORTS.length}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-DEFAULT"></span>
              المفضلة: {favorites.size}
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-DEFAULT"></span>
              متاح: {filtered.length}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Report List */}
        <div className="flex-1 flex flex-col min-h-0 bg-bg-surface rounded-[16px] border border-border-subtle shadow-sm overflow-hidden">
          
          {/* List Headers / Controls */}
          <div className="shrink-0 border-b border-border-subtle p-3 space-y-3 bg-[color-mix(in_srgb,var(--bg-surface)_80%,transparent)]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث عن تقرير..."
                  className="w-full h-9 pl-3 pr-9 rounded-[8px] bg-bg-base border border-border-normal text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary-DEFAULT transition-colors"
                />
              </div>

              <div className="relative shrink-0">
                <select 
                  value={sortBy} 
                  onChange={(event) => setSortBy(event.target.value)} 
                  className="h-9 px-3 pr-8 rounded-[8px] bg-bg-base border border-border-normal text-[11px] font-semibold text-text-secondary appearance-none outline-none focus:border-primary-DEFAULT"
                >
                  <option value="recommended">ترتيب: الأفضل</option>
                  <option value="recent">ترتيب: الأحدث استخداماً</option>
                  <option value="name">ترتيب: الاسم</option>
                  <option value="code">ترتيب: الكود</option>
                </select>
                <ArrowUpDown size={12} className="absolute top-1/2 -translate-y-1/2 right-2 text-text-muted pointer-events-none" />
              </div>

              <button
                type="button"
                className={`shrink-0 h-9 px-3 rounded-[8px] border text-[11px] font-bold transition-colors ${
                  onlyFavorites 
                    ? "bg-warning-DEFAULT/10 border-warning-DEFAULT text-warning-DEFAULT" 
                    : "bg-bg-base border-border-normal text-text-secondary hover:bg-border-subtle"
                }`}
                onClick={() => setOnlyFavorites((current) => !current)}
              >
                المفضلة
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button 
                type="button" 
                onClick={() => setActiveCategory("all")} 
                className={`px-3 py-1.5 rounded-[6px] text-[10px] font-bold tracking-[0.05em] uppercase transition-colors ${
                  activeCategory === "all" ? "bg-primary-DEFAULT text-white" : "bg-bg-base text-text-secondary hover:bg-border-subtle border border-border-normal"
                }`}
              >
                الكل
              </button>
              {CATEGORIES.map((category) => {
                const count = REPORTS.filter((r) => r.cat === category.id).length;
                const active = activeCategory === category.id;
                return (
                  <button 
                    key={category.id} 
                    type="button" 
                    onClick={() => setActiveCategory(category.id)} 
                    style={{ 
                      backgroundColor: active ? category.bg : "var(--bg-base)",
                      color: active ? category.color : "var(--text-secondary)",
                      borderColor: active ? category.color : "var(--border-normal)",
                      borderWidth: 1,
                      borderStyle: "solid"
                    }}
                    className="px-3 py-1.5 rounded-[6px] text-[10px] font-bold tracking-[0.05em] uppercase transition-colors hover:brightness-95"
                  >
                    {category.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin p-3">
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[12px] text-text-muted">
                لا توجد تقارير مطابقة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    category={CATEGORIES.find((cat) => cat.id === report.cat) || CATEGORIES[0]}
                    selected={selectedReport?.id === report.id}
                    favorited={favorites.has(report.id)}
                    onSelect={setSelectedId}
                    onToggleFav={toggleFavorite}
                    onQuickRun={(selected) => openReport(selected, selected.supportsDates ? { from: defaultFrom, to: defaultTo } : undefined)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Control Panel */}
        <div className="w-[320px] shrink-0 flex flex-col min-h-0 bg-bg-surface rounded-[16px] border border-border-subtle shadow-sm overflow-hidden">
          <div className="shrink-0 border-b border-border-subtle bg-bg-overlay/50 px-4 py-3 font-bold text-[11px] uppercase tracking-[0.05em] text-text-secondary">
            تشغيل التقرير
          </div>
          <div className="flex-1 overflow-auto scrollbar-thin p-4">
            {!selectedReport ? (
              <div className="text-[12px] text-text-muted text-center py-10">اختر تقريراً لعرض إجراءات التحكم.</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.05em]" style={{ color: selectedCategory.color, backgroundColor: selectedCategory.bg }}>
                    {selectedReport.id} - {selectedCategory.label}
                  </span>
                  <h2 className="mt-3 text-[15px] font-black tracking-[0.02em] text-text-primary">{selectedReport.title}</h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">{selectedReport.desc}</p>
                </div>

                <div className="space-y-3">
                  <button type="button" className="btn btn-primary w-full flex items-center justify-center gap-2 h-10" onClick={() => openReport(selectedReport)}>
                    <Play size={14} />
                    فتح التقرير الآن
                  </button>
                  {selectedReport.supportsDates ? (
                    <button type="button" className="btn btn-secondary w-full flex items-center justify-center gap-2 h-10" onClick={() => openReport(selectedReport, { from: defaultFrom, to: defaultTo })}>
                      <CalendarDays size={14} />
                      فتح بالشهر الحالي
                    </button>
                  ) : null}
                </div>

                {selectedReport.supportsDates ? (
                  <div className="space-y-4 rounded-[12px] border border-border-subtle bg-bg-overlay p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-text-secondary">
                      <Sparkles size={12} className="text-primary-DEFAULT" />
                      تحكم مخصص في الفترة
                    </div>
                    <div className="space-y-3">
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-bold text-text-secondary">من تاريخ</span>
                        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="input w-full h-9 text-[12px]" />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-bold text-text-secondary">إلى تاريخ</span>
                        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="input w-full h-9 text-[12px]" />
                      </label>
                    </div>
                    {invalidRange && <div className="text-[11px] text-error-DEFAULT">تاريخ البداية يجب أن يكون أصغر أو يساوي تاريخ النهاية.</div>}
                    <div className="flex gap-2 pt-2">
                      <button type="button" className="btn btn-primary flex-1 h-9 text-[11px]" disabled={invalidRange} onClick={() => openReport(selectedReport, { from, to })}>
                        فتح للمدة المحددة
                      </button>
                      <button type="button" className="btn btn-ghost h-9 px-3 text-[11px]" onClick={() => { setFrom(defaultFrom); setTo(defaultTo); }}>
                        إعادة
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-info-DEFAULT/20 bg-info-DEFAULT/5 p-3 text-[11px] leading-relaxed text-info-DEFAULT">
                    هذا التقرير يعتمد على أحدث البيانات المتاحة (اللحظية) ولا يتطلب تحديد نطاق زمني.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
