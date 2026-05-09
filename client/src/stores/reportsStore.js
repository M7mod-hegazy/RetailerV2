import { create } from "zustand";

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(`reports_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function persist(key, value) {
  try { localStorage.setItem(`reports_${key}`, JSON.stringify(value)); } catch { /* noop */ }
}

export const useReportsStore = create((set, get) => ({
  // Per-report preferences keyed by slug
  preferences: loadPersisted("preferences", {}),

  // Favorites (set of report ids)
  favorites: new Set(loadPersisted("favorites", [])),

  // Recent reports (ordered list of report ids with timestamps)
  recents: loadPersisted("recents", []),

  // Saved presets
  presets: loadPersisted("presets", []),

  // Sidebar open state
  sidebarOpen: true,

  getPreference(slug, key, fallback = null) {
    return get().preferences?.[slug]?.[key] ?? fallback;
  },

  setPreference(slug, key, value) {
    set((state) => {
      const updated = {
        ...state.preferences,
        [slug]: { ...(state.preferences[slug] || {}), [key]: value },
      };
      persist("preferences", updated);
      return { preferences: updated };
    });
  },

  setColumnVisibility(slug, visibility) {
    get().setPreference(slug, "columnVisibility", visibility);
  },

  setColumnOrder(slug, order) {
    get().setPreference(slug, "columnOrder", order);
  },

  setColumnWidth(slug, colKey, width) {
    const existing = get().preferences?.[slug]?.columnWidths || {};
    get().setPreference(slug, "columnWidths", { ...existing, [colKey]: width });
  },

  setLastFilters(slug, filters) {
    get().setPreference(slug, "lastFilters", filters);
  },

  setCostMethod(slug, method) {
    get().setPreference(slug, "costMethod", method);
  },

  toggleFavorite(slug) {
    set((state) => {
      const next = new Set(state.favorites);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      persist("favorites", [...next]);
      return { favorites: next };
    });
  },

  pushRecent(slug) {
    set((state) => {
      const next = state.recents.filter((r) => r.slug !== slug);
      next.unshift({ slug, at: Date.now() });
      if (next.length > 20) next.length = 20;
      persist("recents", next);
      return { recents: next };
    });
  },

  savePreset(name, slug, filters, costMethod) {
    set((state) => {
      const next = [...state.presets, { id: Date.now(), name, slug, filters, costMethod }];
      persist("presets", next);
      return { presets: next };
    });
  },

  deletePreset(id) {
    set((state) => {
      const next = state.presets.filter((p) => p.id !== id);
      persist("presets", next);
      return { presets: next };
    });
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
}));
