import React, { useState, useEffect } from 'react';
import { Tv, Film, Clapperboard, Clock, ShieldCheck, User, Shield, LogOut } from 'lucide-react';

export default function Header({ accountInfo, activeTab, setActiveTab, user, onLogout }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const navItems = [
    { id: 'live', label: 'TV en Vivo', icon: Tv },
    { id: 'movies', label: 'Películas', icon: Film },
    { id: 'series', label: 'Series', icon: Clapperboard },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Panel Admin', icon: Shield });
  }

  return (
    <header className="min-h-[76px] sm:h-18 pt-[max(14px,env(safe-area-inset-top,0px))] pb-2 px-3.5 sm:px-6 glass-panel flex items-center justify-between z-40 relative border-b border-neutral-800 select-none">
      {/* Brand Capsule Pill (Stacked Logo Icon on Top + Text Below on Mobile, Horizontal on Desktop) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 shadow-md flex-shrink-0">
        <img src="/logo_icon_transparent.png" alt="StreamTV Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <h1 className="text-[11px] sm:text-lg font-extrabold tracking-wider text-white flex items-center gap-1 leading-none text-center">
          Stream<span className="text-red-600 font-black">TV</span>
        </h1>
      </div>

      {/* System Status & Logout (Symmetrical pills matching left brand pill height) */}
      <div className="flex items-center gap-2 text-xs">
        {/* User Info (Desktop only) */}
        <div className="hidden lg:flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-2xl shadow-md">
          <User className="w-3.5 h-3.5 text-red-500" />
          <span className="font-semibold text-neutral-200 truncate max-w-[120px]">
            {user?.email || 'Usuario'}
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> {user?.role === 'admin' ? 'Admin' : 'Beta'}
          </span>
        </div>

        {/* Live Clock Pill (Mobile & Desktop) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-2xl bg-neutral-900/90 border border-neutral-800/90 shadow-md font-mono text-[10px] sm:text-xs">
          <Clock className="w-3.5 h-3.5 text-red-500" />
          <span className="font-bold text-neutral-200">{formattedTime}</span>
        </div>

        {/* Logout Pill (Mobile & Desktop) */}
        <button
          onClick={onLogout}
          className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-2xl bg-neutral-900/90 hover:bg-red-950/40 text-neutral-300 hover:text-red-500 border border-neutral-800/90 shadow-md transition cursor-pointer"
          title="Cerrar Sesión"
        >
          <LogOut className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[10px] sm:text-xs font-semibold text-neutral-300">Salir</span>
        </button>
      </div>
    </header>
  );
}
