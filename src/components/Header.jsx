import React, { useState, useEffect } from 'react';
import { Tv, Film, Clapperboard, Clock, ShieldCheck, User } from 'lucide-react';

export default function Header({ accountInfo, activeTab, setActiveTab }) {
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

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 glass-panel flex items-center justify-between z-40 relative border-b border-neutral-800 select-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 overflow-hidden border border-neutral-800 flex items-center justify-center shadow-lg shadow-red-950/50">
          <img src="/favicon.png" alt="StreamTV Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-base sm:text-xl font-extrabold tracking-wider text-white flex items-center gap-1.5">
          Stream<span className="text-red-600">TV</span>
          <span className="hidden sm:inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/40">
            Xtream
          </span>
        </h1>
      </div>

      {/* Navigation Items (Visible on all screens, compact on mobile) */}
      <nav className="flex items-center gap-1 sm:gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              data-dpad-id={`header-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`dpad-focusable px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-900/40 scale-105'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/70'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status (Hidden on mobile) */}
      <div className="hidden lg:flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl">
          <User className="w-3.5 h-3.5 text-red-500" />
          <span className="font-semibold text-neutral-200">
            Cliente StreamTV
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Activo
          </span>
        </div>

        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl font-mono text-xs text-neutral-300">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span>{formattedTime}</span>
        </div>
      </div>
    </header>
  );
}
