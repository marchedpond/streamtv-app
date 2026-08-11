import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({ currentPage, totalPages, totalItems, onPageChange, sectionId = 'grid' }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 select-none border-t border-neutral-800/60 mt-4">
      {/* Items count summary */}
      <p className="text-xs text-neutral-400 font-medium">
        Mostrando página <span className="text-white font-bold">{currentPage}</span> de{' '}
        <span className="text-white font-bold">{totalPages}</span> ({totalItems} elementos)
      </p>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-2">
        <button
          data-dpad-id={`${sectionId}-page-prev`}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={`dpad-focusable px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
            currentPage === 1
              ? 'bg-neutral-900 text-neutral-600 opacity-50 cursor-not-allowed border border-neutral-800'
              : 'bg-neutral-900 border border-neutral-800 text-white hover:bg-red-600 hover:border-red-600 shadow-md'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anterior</span>
        </button>

        {/* Page indicator pill */}
        <div className="px-3 py-1.5 bg-red-950/60 border border-red-800/60 rounded-xl text-xs font-bold text-red-400">
          {currentPage} / {totalPages}
        </div>

        <button
          data-dpad-id={`${sectionId}-page-next`}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={`dpad-focusable px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
            currentPage === totalPages
              ? 'bg-neutral-900 text-neutral-600 opacity-50 cursor-not-allowed border border-neutral-800'
              : 'bg-neutral-900 border border-neutral-800 text-white hover:bg-red-600 hover:border-red-600 shadow-md'
          }`}
        >
          <span>Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
