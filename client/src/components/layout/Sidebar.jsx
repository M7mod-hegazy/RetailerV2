import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Target, PieChart, Database, Box, Users, Building,
  Warehouse, KeySquare, ShoppingCart, ReceiptText, CircleDollarSign,
  Wallet, TrendingDown, TrendingUp, Receipt, CalendarRange, ArrowRightLeft,
  Bell, Settings, LogOut, Radar, ChevronDown, Search, PackageSearch,
  FileSpreadsheet, Boxes, ClipboardList, Landmark, Tags, Percent, ShieldCheck,
  Activity, UsersRound, Scale, Menu, ChevronLeft, Truck, BookOpen, CreditCard
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

const PRIMARY_MENU = [
  { path: "/dashboard", label: "مساحة العمل", icon: LayoutDashboard },
  { path: "/pos", label: "نقطة البيع (POS)", icon: Target, highlight: true },
  { path: "/daily-treasury", label: "الخزينة اليومية", icon: BookOpen, highlight: false },
  { path: "/analytics", label: "التحليلات والمبيعات", icon: Activity },
];

const NAV_MODULES = [
  {
    title: "المبيعات والمشتريات",
    id: "trade",
    icon: ShoppingCart,
    items: [
      { path: "/purchases", label: "فواتير المشتريات", icon: PackageSearch },
      { path: "/purchases/orders", label: "أوامر الشراء", icon: FileSpreadsheet },
      { path: "/purchases/returns", label: "مرتجع المشتريات", icon: ArrowRightLeft },
      { path: "/sales/returns", label: "مرتجع المبيعات", icon: ReceiptText },
      { path: "/operations/branch-transfer", label: "استلام / تسليم بضاعة", icon: Truck },
      { path: "/operations/quotations", label: "عروض الأسعار", icon: Receipt },
    ],
  },
  {
    title: "الخزينة والمالية",
    id: "finance",
    icon: CircleDollarSign,
    items: [
      { path: "/payments", label: "القبض والدفع", icon: Wallet },
      { path: "/accounts/customers", label: "حسابات العملاء", icon: Users },
      { path: "/accounts/suppliers", label: "حسابات الموردين", icon: Building },
      { path: "/revenues", label: "تسجيل الإيرادات", icon: TrendingUp },
      { path: "/expenses", label: "تسجيل المصروفات", icon: TrendingDown },
      { path: "/operations/ajal-tracker", label: "متابعة الديون (أجل)", icon: CalendarRange },
      { path: "/operations/payment-methods", label: "وسائل الدفع", icon: CreditCard },
      { path: "/operations/bank-operations", label: "البنوك والفيزا", icon: Landmark },
      { path: "/operations/cheques", label: "إدارة الشيكات", icon: Receipt },
    ],
  },
  {
    title: "المخازن والأصناف",
    id: "inventory",
    icon: Boxes,
    items: [
      { path: "/definitions/items", label: "قاعدة الأصناف", icon: Box },
      { path: "/operations/bulk-price-update", label: "تحديث أسعار", icon: Tags },
      { path: "/stock/transfer", label: "تحويل مخزني", icon: ArrowRightLeft },
      { path: "/stock/physical-count", label: "الجرد الفعلي وتسوية", icon: ClipboardList },
      { path: "/definitions/promotions", label: "العروض والتخفيضات", icon: Percent },
    ],
  },
  {
    title: "تعريفات أساسية",
    id: "definitions",
    icon: Database,
    items: [
      { path: "/definitions/branches", label: "الفروع", icon: Building },
      { path: "/definitions/customers", label: "العملاء", icon: Users },
      { path: "/definitions/suppliers", label: "الموردين", icon: Building },
      { path: "/definitions/warehouses", label: "المخازن", icon: Warehouse },
      { path: "/definitions/banks", label: "البنوك", icon: Landmark },
      { path: "/definitions/units", label: "وحدات القياس", icon: Scale },
      { path: "/definitions/expense-categories", label: "أقسام المصروفات", icon: TrendingDown },
      { path: "/definitions/revenue-categories", label: "أقسام الإيرادات", icon: Database },
    ],
  },
  {
    title: "نظام وإدارة",
    id: "system",
    icon: ShieldCheck,
    items: [
      { path: "/reports/center", label: "مركز التقارير", icon: PieChart },
      { path: "/definitions/users", label: "المستخدمين", icon: KeySquare },
      { path: "/definitions/employees", label: "الموظفين", icon: UsersRound },
      { path: "/settings", label: "الإعدادات العامة", icon: Settings },
    ],
  },
];

// Fetches category count once for the badge on "قاعدة الأصناف"
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

  // Set initial active accordion based on path
  useEffect(() => {
    if (searchQuery || collapsed) return;
    const currentPath = location.pathname;
    
    // Exact matching for highlighting module
    const activeModule = NAV_MODULES.find((module) =>
      module.items.some((item) => item.path === currentPath || (currentPath.startsWith(item.path) && item.path !== "/")),
    );

    if (activeModule) {
      setActiveAccordion(activeModule.id);
    } else {
      setActiveAccordion(null); // Default close if on top-level like Dashboard
    }
  }, [location.pathname, searchQuery, collapsed]);

  const toggleSection = (id) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setActiveAccordion(prev => prev === id ? null : id);
  };

  return (
    <aside className={`fixed right-0 top-0 z-[60] flex h-screen shadow-[8px_0_30px_rgba(0,0,0,0.03)] transition-all duration-500 flex-col border-l border-slate-200 bg-white ${collapsed ? 'w-[80px]' : 'w-[280px]'}`} dir="rtl">
      
      {/* Brand Header */}
      <div className={`p-6 pb-4 transition-all duration-300 ${collapsed ? 'px-4' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
              <Radar className="h-6 w-6 text-white" />
            </div>
            {!collapsed && (
              <div className="transition-opacity duration-300 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-[20px] font-black leading-tight tracking-tight text-slate-900 truncate">نظام الحجازي</h2>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 truncate">إدارة التجزئة</div>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100 ${collapsed ? 'absolute -left-[18px] top-8 bg-white shadow-md border-slate-200 z-[70] h-9 w-9 text-blue-600 rounded-full' : ''}`}
          >
            {collapsed ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className={`px-5 mb-2 transition-all duration-300 ${collapsed ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'}`}>
        <div className="relative group">
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="بحث في القوائم..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-[14px] bg-slate-50 border border-slate-200/60 py-3 pl-3 pr-10 text-[13px] font-bold text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-50"
          />
        </div>
      </div>

      {/* Navigation Matrix */}
      <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-4 pb-8 mt-2 overflow-x-hidden">
        
        {/* Top Level Nav (Dash, POS, Analytics) */}
        <div className="space-y-1 mb-4">
          {PRIMARY_MENU.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative flex items-center gap-3 rounded-[16px] px-4 py-3.5 transition-all duration-300 overflow-hidden ${
                  isActive
                    ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.2)]"
                    : item.highlight
                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : ""}
              >
                <item.icon className={`w-[20px] h-[20px] shrink-0 transition-transform duration-300 ${isActive ? "" : "group-hover:scale-110"}`} />
                {!collapsed && <span className={`text-[14px] font-black truncate ${isActive ? "tracking-wide" : ""}`}>{item.label}</span>}
                {isActive && !collapsed && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-blue-400 rounded-l-full shadow-[0_0_10px_rgba(96,165,250,0.8)]" />}
              </Link>
            );
          })}
        </div>

        <div className={`h-px bg-slate-100 mx-2 mb-4 transition-all ${collapsed ? 'opacity-0' : 'opacity-100'}`} />

        {/* Modules Accordion */}
        <div className="space-y-1.5">
          {filteredModules.length === 0 && !collapsed ? (
            <div className="py-4 text-center text-[12px] font-black text-slate-400 uppercase tracking-widest">لا توجد قوائم</div>
          ) : null}

          {filteredModules.map((module) => {
            const isExpanded = searchQuery.length > 0 ? true : activeAccordion === module.id;
            const hasActiveItem = module.items.some((item) => location.pathname === item.path);

            return (
              <div key={module.id} className="overflow-hidden">
                <button
                  onClick={() => toggleSection(module.id)}
                  className={`w-full flex items-center justify-between rounded-[16px] px-4 py-3.5 transition-all duration-200 ${
                    isExpanded ? "bg-slate-50 text-slate-900" : hasActiveItem ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? module.title : ""}
                >
                  <div className="flex items-center gap-3">
                    <module.icon className={`w-[18px] h-[18px] shrink-0 ${hasActiveItem && !isExpanded ? "text-blue-500" : isExpanded ? "text-slate-700" : "text-slate-400"}`} />
                    {!collapsed && <span className="text-[14px] font-black truncate">{module.title}</span>}
                  </div>
                  {!collapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180 text-slate-700" : hasActiveItem ? "text-blue-500" : "text-slate-400"}`} />}
                </button>

                {!collapsed && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out pl-2 pr-6 ${
                      isExpanded ? "grid-rows-[1fr] mt-1 mb-2 opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden flex flex-col gap-1 relative before:absolute before:right-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 before:rounded-full pt-1">
                      {module.items.map((item) => {
                        const isItemActive = location.pathname === item.path;

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-all duration-200 ${
                              isItemActive
                                ? "bg-slate-100/80 text-blue-700 font-black shadow-sm"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 font-bold"
                            }`}
                          >
                            {isItemActive && (
                              <div className="absolute right-[-17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                            )}
                            <span className="flex-1 text-[13px]">{item.label}</span>
                            {item.path === "/definitions/items" && categoryCount !== null && (
                              <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-black text-white leading-none">
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

      {/* User Footer Profile */}
      <div className={`p-4 border-t border-slate-100 bg-slate-50/50 transition-all ${collapsed ? 'p-2' : ''}`}>
        <div className={`flex items-center justify-between rounded-[18px] bg-white border border-slate-200 p-2 shadow-sm ${collapsed ? 'flex-col gap-2 p-1' : ''}`}>
          <Link to="/settings" className={`flex items-center gap-3 px-2 transition-opacity hover:opacity-80 ${collapsed ? 'px-0' : ''}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-slate-600">
              <Settings className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-[13px] font-black text-slate-800 truncate max-w-[90px]">{user?.name || "مدير العام"}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Admin</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 ${collapsed ? 'h-8 w-8' : ''}`}
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
