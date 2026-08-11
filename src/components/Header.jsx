import React, { useState, useEffect } from 'react';
import { Tv, Film, Clapperboard, Wifi, User, Clock, ShieldCheck } from 'lucide-react';

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
    <header className="h-16 px-6 glass-panel flex items-center justify-between z-40 relative border-b border-neutral-800">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-neutral-900 overflow-hidden border border-neutral-800 flex items-center justify-center shadow-lg shadow-red-950/50">
          <img src="/favicon.png" alt="StreamTV Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider text-white flex items-center gap-2">
            Stream<span className="text-red-600">TV</span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/40">
              Xtream
            </span>
          </h1>
        </div>
      </div>

      {/* Top Tabs / Nav Items */}
      <nav className="flex items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              data-dpad-id={`header-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`dpad-focusable px-5 py-2 rounded-xl flex items-center gap-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/40 scale-105'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Info & System Status */}
      <div className="flex items-center gap-4 text-xs">
        {/* Account Indicator */}
        <div className="hidden md:flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl">
          <User className="w-4 h-4 text-red-500" />
          <div className="flex flex-col">
            <span className="font-semibold text-neutral-200">
              {accountInfo?.user_info?.username || 'Usuario'}
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Activo
            </span>
          </div>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 px-3 py-1.5 rounded-xl font-mono text-sm text-neutral-300">
          <Clock className="w-4 h-4 text-neutral-400" />
          <span>{formattedTime}</span>
        </div>
      </div>
    </header>
  );
}
