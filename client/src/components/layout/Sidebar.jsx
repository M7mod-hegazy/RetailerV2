import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PieChart, Database, Box, Users, Building,
  Warehouse, ShoppingCart, ReceiptText, CircleDollarSign,
  Wallet, TrendingDown, TrendingUp, Receipt, ArrowRightLeft,
  Settings, LogOut, Radar, ChevronDown, Search, PackageSearch,
  FileSpreadsheet, Boxes, ClipboardList, Landmark, Tags, ShieldCheck,
  Activity, UsersRound, Scale, Menu, ChevronLeft, Truck, Coins, Store, BadgePercent, Banknote, HeartHandshake, Briefcase, Fingerprint, CreditCard
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const PRIMARY_MENU = [
  { path: "/dashboard", label: "مساحة العمل", icon: LayoutDashboard },
  { path: "/pos", label: "نقطة البيع (POS)", icon: Store, highlight: true },
  { path: "/daily-treasury", label: "الخزينة اليومية", icon: Wallet },
  { path: "/analytics", label: "التحليلات والمبيعات", icon: Activity },
];

const NAV_MODULES = [
  {
    title: "المبيعات والمشتريات",
    id: "trade",
    icon: ShoppingCart,
    items: [
      { path: "/purchases", label: "فواتير المشتريات", icon: PackageSearch },
      { path: "/purchases/orders", label: "أوامر الشراء", icon: ClipboardList },
      { path: "/purchases/returns", label: "مرتجع المشتريات", icon: ArrowRightLeft },
      { path: "/sales/returns", label: "مرتجع المبيعات", icon: ReceiptText },
      { path: "/operations/branch-transfer", label: "نقل المخزون", icon: Truck },
      { path: "/operations/quotations", label: "عروض الأسعار", icon: Receipt },
    ],
  },
  {
    title: "الخزينة والمالية",
    id: "finance",
    icon: CircleDollarSign,
    items: [
      { path: "/payments", label: "القبض والدفع", icon: Coins },
      { path: "/accounts/customers", label: "حسابات العملاء", icon: HeartHandshake },
      { path: "/accounts/suppliers", label: "حسابات الموردين", icon: Building },
      { path: "/operations/installments", label: "الأقساط والآجل", icon: Coins },
      { path: "/revenues", label: "تسجيل الإيرادات", icon: TrendingUp },
      { path: "/expenses", label: "تسجيل المصروفات", icon: TrendingDown },
      { path: "/operations/payment-methods", label: "وسائل الدفع", icon: CreditCard },
      { path: "/operations/bank-operations", label: "البنوك والفيزا", icon: Landmark },
      { path: "/operations/cheques", label: "إدارة الشيكات", icon: Banknote },
    ],
  },
  {
    title: "المخازن والأصناف",
    id: "inventory",
    icon: Boxes,
    items: [
      { path: "/definitions/items", label: "قاعدة الأصناف", icon: Box },
      { path: "/operations/bulk-price-update", label: "تحديث الأسعار", icon: Tags },
      { path: "/stock/transfer", label: "تحويل مخزني", icon: ArrowRightLeft },
      { path: "/stock/physical-count", label: "الجرد الفعلي", icon: FileSpreadsheet },
      { path: "/definitions/promotions", label: "العروض والتخفيضات", icon: BadgePercent },
    ],
  },
  {
    title: "تعريفات أساسية",
    id: "definitions",
    icon: Database,
    items: [
      { path: "/definitions/branches", label: "الفروع", icon: Store },
      { path: "/definitions/customers", label: "العملاء", icon: UsersRound },
      { path: "/definitions/suppliers", label: "الموردين", icon: Briefcase },
      { path: "/definitions/warehouses", label: "المخازن", icon: Warehouse },
      { path: "/definitions/banks", label: "البنوك", icon: Landmark },
      { path: "/definitions/units", label: "وحدات القياس", icon: Scale },
      { path: "/definitions/expense-categories", label: "أقسام المصروفات", icon: TrendingDown },
      { path: "/definitions/revenue-categories", label: "أقسام الإيرادات", icon: TrendingUp },
    ],
  },
  {
    title: "إدارة النظام",
    id: "system",
    icon: ShieldCheck,
    items: [
      { path: "/reports/center", label: "مركز التقارير", icon: PieChart },
      { path: "/definitions/users", label: "المستخدمين", icon: Fingerprint },
      { path: "/definitions/employees", label: "الموظفين", icon: UsersRound },
      { path: "/settings", label: "الإعدادات العامة", icon: Settings },
    ],
  },
];

function useCategoryCount() {
  const [count, setCount] = useState(null);
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const token = useAuthStore.getState().token;
    const base = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";
    fetch(`${base}/api/categories`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.data)) setCount(d.data.length); })
      .catch(() => {});
  }, []);
  return count;
}

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const categoryCount = useCategoryCount();

  const filteredModules = NAV_MODULES.map((module) => {
    if (!searchQuery) return module;
    const query = searchQuery.toLowerCase();
    if (module.title.toLowerCase().includes(query)) return module;
    const items = module.items.filter((item) => item.label.toLowerCase().includes(query));
    return { ...module, items };
  }).filter((module) => module.items.length > 0);

  useEffect(() => {
    if (searchQuery || collapsed) return;
    const activeModule = NAV_MODULES.find((module) =>
      module.items.some((item) => item.path === location.pathname || (location.pathname.startsWith(item.path) && item.path !== "/")),
    );
    if (activeModule) setActiveAccordion(activeModule.id);
  }, [location.pathname, searchQuery, collapsed]);

  return (
    <aside className={`relative z-40 flex shrink-0 h-screen flex-col border-l border-zinc-200/80 bg-white transition-all duration-300 ${collapsed ? 'w-[80px]' : 'w-[280px]'}`} dir="rtl">
      {/* Brand */}
      <div className={`p-6 flex items-center justify-between border-b border-zinc-100 ${collapsed ? 'justify-center px-4' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-emerald-400">
            <Radar strokeWidth={2} className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="animate-in fade-in">
              <h2 className="text-[18px] font-black tracking-tight text-zinc-900">نظام الحجازي</h2>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-0.5">إدارة التجزئة</div>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className={`flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors ${collapsed ? 'absolute -left-[16px] top-7 bg-white shadow-md border border-zinc-200 z-50 h-8 w-8 text-zinc-900 rounded-full' : ''}`}>
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 scrollbar-none">
        {/* Search */}
        {!collapsed && (
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في القوائم..."
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200/60 py-2.5 pl-3 pr-9 text-[13px] font-semibold text-zinc-900 placeholder-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none transition-all"
            />
          </div>
        )}

        <div className="space-y-1 mb-8">
          {PRIMARY_MENU.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${isActive ? 'bg-zinc-950 text-white shadow-md shadow-zinc-900/10' : item.highlight ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'} ${collapsed ? 'justify-center px-0' : ''}`}>
                <item.icon strokeWidth={isActive ? 2 : 1.5} className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-emerald-400' : ''}`} />
                {!collapsed && <span className={`text-[13px] tracking-wide ${isActive ? 'font-black' : 'font-bold'}`}>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          {filteredModules.map((module) => {
            const isExpanded = searchQuery.length > 0 || activeAccordion === module.id;
            const hasActiveItem = module.items.some((item) => location.pathname === item.path || location.pathname.startsWith(item.path) && item.path !== "/");
            
            return (
              <div key={module.id} className="mb-1">
                <button onClick={() => { if(collapsed) setCollapsed(false); setActiveAccordion(prev => prev === module.id ? null : module.id); }} className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${isExpanded || hasActiveItem ? 'text-zinc-900 bg-zinc-50/50' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'} ${collapsed ? 'justify-center px-0' : ''}`}>
                  <div className="flex items-center gap-3">
                    <module.icon strokeWidth={1.5} className={`h-[18px] w-[18px] shrink-0 ${hasActiveItem && !isExpanded ? 'text-emerald-600' : isExpanded ? 'text-zinc-900' : 'text-zinc-400'}`} />
                    {!collapsed && <span className={`text-[13px] ${isExpanded || hasActiveItem ? 'font-black' : 'font-bold'}`}>{module.title}</span>}
                  </div>
                  {!collapsed && <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180 text-zinc-900' : 'text-zinc-400'}`} />}
                </button>

                {!collapsed && (
                  <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1 mb-2" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden flex flex-col relative pr-7 pl-2">
                      <div className="absolute right-[21px] top-1 bottom-1 w-[2px] bg-zinc-100 rounded-full" />
                      {module.items.map((item) => {
                        const isItemActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== "/");
                        return (
                          <Link key={item.path} to={item.path} className={`relative flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-all ${isItemActive ? 'text-zinc-900 font-black bg-zinc-50' : 'text-zinc-500 hover:text-zinc-900 font-semibold'}`}>
                            <div className="flex items-center gap-2">
                              {isItemActive && <div className="absolute right-[-15px] top-1/2 -translate-y-1/2 w-1.5 h-4 bg-zinc-900 rounded-full shadow-sm" />}
                              <span className="text-[12px]">{item.label}</span>
                            </div>
                            {item.path === "/definitions/items" && categoryCount !== null && (
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${isItemActive ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'}`}>
                                {categoryCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t border-zinc-100 ${collapsed ? 'p-2' : ''}`}>
        <div className={`flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-2 ${collapsed ? 'flex-col gap-2 p-1' : ''}`}>
          <Link to="/settings" className={`flex items-center gap-3 ${collapsed ? '' : 'px-2'}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-zinc-200 shadow-sm text-zinc-700 hover:bg-zinc-100 transition-colors">
              <Settings strokeWidth={1.5} className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-zinc-900 truncate max-w-[100px]">{user?.name || "مدير النظام"}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">Admin</span>
              </div>
            )}
          </Link>
          <button onClick={() => { logout(); navigate("/login"); }} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors">
            <LogOut strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
