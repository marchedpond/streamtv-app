import React from 'react';
import { Tv, Film, Clapperboard, Shield } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab, user }) {
  const navItems = [
    { id: 'live', label: 'TV en Vivo', icon: Tv },
    { id: 'movies', label: 'Películas', icon: Film },
    { id: 'series', label: 'Series', icon: Clapperboard },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-xl border-t border-neutral-800/90 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2.5 px-3 flex items-center justify-around select-none shadow-2xl shadow-black">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            data-dpad-id={`bottom-nav-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`dpad-focusable flex flex-col items-center gap-1 px-3 py-1 rounded-2xl transition-all duration-200 cursor-pointer ${
              isActive
                ? 'text-red-500 scale-105 font-bold'
                : 'text-neutral-400 hover:text-neutral-200 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-red-600/15 text-red-500 border border-red-500/30' : ''}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
