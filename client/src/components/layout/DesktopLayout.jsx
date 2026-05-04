import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';

export default function DesktopLayout({ children, branding }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f4f6f8] text-slate-800 font-sans overflow-hidden" dir="rtl">
      
      {/* ─── NEW GLASSMORPHIC SIDEBAR ─── */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* ─── MAIN CONTENT PLATFORM ─── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'mr-0 xl:mr-[80px]' : 'mr-0 xl:mr-[280px]'} h-screen overflow-hidden`}>
        
        {/* Dynamic App Environment Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-emerald-200/20 rounded-full blur-[120px] mix-blend-multiply" />
          <div className="absolute bottom-0 left-[20%] w-[600px] h-[600px] bg-teal-200/20 rounded-full blur-[100px] mix-blend-multiply" />
        </div>

        {/* Global Floating Topbar */}
        <div className="relative z-20 pt-4 shrink-0 px-4 lg:px-8">
          <Topbar />
        </div>

        {/* Dynamic Page Injection */}
        <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {children}
        </main>

      </div>
    </div>
  );
}
