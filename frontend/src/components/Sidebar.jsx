import React from 'react';
import { Tv, Film, Clapperboard, RefreshCw, Radio, Shield, LogOut } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onRefresh, user, onLogout }) {
  const menuItems = [
    { id: 'live', label: 'TV en Vivo', icon: Tv },
    { id: 'movies', label: 'Películas', icon: Film },
    { id: 'series', label: 'Series', icon: Clapperboard },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ id: 'admin', label: 'Panel Admin', icon: Shield });
  }

  return (
    <aside className="hidden md:flex w-64 glass-panel border-r border-neutral-800 flex-col justify-between p-4 z-30 select-none flex-shrink-0">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Navegación
          </p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-dpad-id={`sidebar-item-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`dpad-focusable w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-950/60 font-semibold'
                    : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-1 pt-4 border-t border-neutral-800/80">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
            Acciones
          </p>

          {user?.role === 'admin' && (
            <button
              data-dpad-id="sidebar-action-refresh"
              onClick={onRefresh}
              className="dpad-focusable w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs text-neutral-400 hover:text-white hover:bg-neutral-800/60 cursor-pointer transition-all"
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Actualizar Listas</span>
            </button>
          )}

          <button
            data-dpad-id="sidebar-action-logout"
            onClick={onLogout}
            className="dpad-focusable w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-xs text-neutral-400 hover:text-red-400 hover:bg-red-950/20 cursor-pointer transition-all"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* D-Pad Hint Footer */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
          <span>Modo Smart TV</span>
        </div>
        <p className="text-[11px] text-neutral-400 leading-tight">
          Navega usando las <span className="text-white font-medium">Flechas</span> y confirma con <span className="text-white font-medium">Enter</span>.
        </p>
      </div>
    </aside>
  );
}
