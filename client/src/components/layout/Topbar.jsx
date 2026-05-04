import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, Search, Command, LayoutGrid, Coins } from "lucide-react";
import { useNotificationStore } from "../../stores/notificationStore";
import { useUiStore } from "../../stores/uiStore";
import { useAppSettingsStore } from "../../stores/appSettingsStore";
import { ROUTES } from "../../constants/routes";

const routeLabelMatchers = [
  { match: ROUTES.DASHBOARD, label: "لوحة التحكم" },
  { match: ROUTES.POS, label: "نقطة البيع" },
  { match: "/definitions", label: "البيانات الأساسية" },
  { match: ROUTES.PURCHASES, label: "المشتريات" },
  { match: ROUTES.PAYMENTS, label: "المدفوعات والتحصيل" },
  { match: ROUTES.EXPENSES, label: "المصروفات" },
  { match: ROUTES.REVENUES, label: "الإيرادات" },
  { match: "/stock", label: "المخزون" },
  { match: "/operations", label: "العمليات" },
  { match: ROUTES.REPORTS, label: "مركز التقارير" },
  { match: ROUTES.SETTINGS, label: "إعدادات النظام" },
];

export default function Topbar() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const items = useNotificationStore((state) => state.items);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const openGlobalSearch = useUiStore((state) => state.openGlobalSearch);
  const settings = useAppSettingsStore((state) => state.settings);
  const location = useLocation();
  const [openBell, setOpenBell] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    return new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }, []);

  const currentLabel =
    routeLabelMatchers.find((entry) => location.pathname.startsWith(entry.match))?.label ||
    "العمل اليومي";

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openGlobalSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openGlobalSearch]);

  useEffect(() => {
    const close = () => setOpenBell(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <header className="sticky top-4 z-30 mx-4 mb-8 flex h-[76px] items-center justify-between rounded-3xl border border-white bg-white/70 px-6 shadow-[0_8px_32px_rgba(15,23,42,0.04)] backdrop-blur-3xl lg:mx-8">
      <div className="flex items-center gap-4 border-r border-slate-200/60 pr-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-900 shadow-[0_4px_16px_rgba(15,23,42,0.15)]">
          <LayoutGrid className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-[19px] font-black leading-none tracking-tight text-slate-900">{currentLabel}</h1>
          <p className="mt-1 text-[12px] font-bold text-slate-500">{today}</p>
        </div>
      </div>

      <button
        onClick={openGlobalSearch}
        className="group mx-8 hidden w-full max-w-xl flex-1 items-center gap-3 rounded-[18px] border border-slate-200 bg-white/60 px-4 py-3 transition-all duration-300 hover:border-emerald-200 hover:bg-white hover:shadow-[0_8px_24px_rgba(5,150,105,0.08)] md:flex"
      >
        <Search className="h-5 w-5 text-slate-400 transition-colors group-hover:text-emerald-500" />
        <span className="flex-1 text-right text-[14px] font-bold text-slate-400 transition-colors group-hover:text-slate-600">
          بحث شامل داخل النظام...
        </span>
        <div
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-mono transition-colors group-hover:border-emerald-100/50 group-hover:bg-emerald-50"
          dir="ltr"
        >
          <Command className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600" />
          <span className="text-[10px] font-black tracking-wider text-slate-500 group-hover:text-emerald-700">K</span>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 sm:flex">
          <Coins className="h-4 w-4 text-emerald-600" />
          <span>{settings.currency_symbol || settings.currency_code || "EGP"}</span>
        </div>

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setOpenBell((v) => !v)}
            className="relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
          >
            <Bell className={`h-5 w-5 ${unreadCount ? "animate-[bell-ring_1.5s_infinite] text-emerald-600" : ""}`} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[11px] font-black text-white shadow-[0_4px_8px_rgba(239,68,68,0.3)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {openBell && (
            <div className="animate-in fade-in zoom-in-95 absolute right-0 top-16 z-50 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-2 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <span className="text-[15px] font-bold text-slate-800">التنبيهات</span>
                <button onClick={markAllAsRead} className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700">
                  تعيين الكل كمقروء
                </button>
              </div>
              <div className="scrollbar-none max-h-80 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm font-semibold text-slate-400">لا توجد تنبيهات جديدة</div>
                ) : (
                  items.slice(0, 5).map((note) => (
                    <button
                      key={note.id}
                      onClick={() => markAsRead(note.id)}
                      className={`mb-1 block w-full rounded-2xl p-3 text-start ${
                        note.is_read
                          ? "bg-transparent text-slate-500"
                          : "border border-emerald-100 bg-emerald-50 text-slate-900 hover:bg-emerald-100/50"
                      }`}
                    >
                      <div className="text-[13px] font-bold">{note.title}</div>
                      <div className="mt-1 text-[11px] font-semibold leading-relaxed opacity-80">{note.message}</div>
                    </button>
                  ))
                )}
              </div>
              <Link
                to="/notifications"
                onClick={() => setOpenBell(false)}
                className="m-2 block rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-[13px] font-bold text-slate-700 hover:bg-slate-100"
              >
                عرض كل التنبيهات
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
