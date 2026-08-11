import React from 'react';
import { Play, Clock, Sparkles } from 'lucide-react';
import { getOptimizedImageUrl, handleImageError } from '../utils/imageProxy';

export default function ContinueWatching({ historyItems = [], onResume }) {
  if (!historyItems || historyItems.length === 0) return null;

  return (
    <div className="space-y-3 p-6 pb-2 select-none">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
        <h2 className="text-lg font-bold text-white tracking-wide">Continuar Viendo</h2>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-3 scrollbar-none">
        {historyItems.map((item) => {
          const progressPercent = item.duration_seconds > 0
            ? Math.min(100, Math.max(5, (item.progress_seconds / item.duration_seconds) * 100))
            : 0;

          const posterUrl = getOptimizedImageUrl(item.poster, 250);

          return (
            <div
              key={item.id || `${item.item_type}_${item.item_id}`}
              data-dpad-id={`continue-${item.id}`}
              onClick={() => onResume(item)}
              className="dpad-focusable group relative w-48 sm:w-56 flex-shrink-0 bg-neutral-900 rounded-2xl border border-neutral-800/80 overflow-hidden cursor-pointer flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:border-red-600 shadow-lg"
            >
              {/* Thumbnail / Poster */}
              <div className="aspect-[16/9] w-full bg-neutral-950 relative overflow-hidden">
                {item.poster ? (
                  <img
                    src={posterUrl}
                    alt={item.title}
                    loading="lazy"
                    onError={handleImageError}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                    <Clock className="w-8 h-8 text-neutral-700" />
                  </div>
                )}

                {/* Play Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-950/80">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Progress Bar at bottom of poster */}
                <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60">
                  <div
                    className="bg-red-600 h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-3 space-y-1 bg-neutral-900/90">
                <h3 className="text-xs font-bold text-white truncate">{item.title}</h3>
                {item.subtitle && <p className="text-[10px] text-red-400 font-medium truncate">{item.subtitle}</p>}
                <p className="text-[10px] text-neutral-500 font-mono">
                  {item.duration_seconds > 0 ? `${Math.round(progressPercent)}% visto` : 'En progreso'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
