import React, { useState, useEffect } from 'react';
import { Tv, Film, Clapperboard, Clock, ShieldCheck, User, Shield, LogOut } from 'lucide-react';

export default function Header({ accountInfo, activeTab, setActiveTab, user, onLogout }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const navItems = [
    { id: 'live', label: 'TV en Vivo', icon: Tv },
    { id: 'movies', label: 'Películas', icon: Film },
    { id: 'series', label: 'Series', icon: Clapperboard },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Panel Admin', icon: Shield });
  }

  return (
    <header className="h-16 sm:h-18 pt-[env(safe-area-inset-top,0px)] px-4 sm:px-6 glass-panel flex items-center justify-between z-40 relative border-b border-neutral-800 select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 overflow-hidden border border-neutral-800 flex items-center justify-center shadow-lg shadow-red-950/50">
          <img src="/favicon.png" alt="StreamTV Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-base sm:text-xl font-extrabold tracking-wider text-white flex items-center gap-1.5">
          Stream<span className="text-red-600">TV</span>
        </h1>
      </div>

      {/* System Status & Logout */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        <div className="hidden lg:flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl">
          <User className="w-3.5 h-3.5 text-red-500" />
          <span className="font-semibold text-neutral-200 truncate max-w-[120px]">
            {user?.email || 'Usuario'}
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> {user?.role === 'admin' ? 'Admin' : 'Beta'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl font-mono text-xs text-neutral-300">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>{formattedTime}</span>
        </div>

        <button
          onClick={onLogout}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-neutral-900 hover:bg-red-950/30 text-neutral-300 hover:text-red-500 border border-neutral-800 transition cursor-pointer flex items-center gap-1.5"
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          <span className="hidden sm:inline text-xs font-semibold">Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
}
