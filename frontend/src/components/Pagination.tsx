import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  itemLabel = 'items',
}) => {
  if (totalItems === 0) {
    return null;
  }

  // Calculate page number list with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2; // Number of pages to show before and after current

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);

    if (left > 2) {
      pages.push('...');
    }

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < totalPages - 1) {
      pages.push('...');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = totalItems !== undefined ? (currentPage - 1) * pageSize + 1 : undefined;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : undefined;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-base/80 backdrop-blur-sm border-t border-border-default rounded-b-xl text-xs sm:text-sm text-text-muted ${className}`}
    >
      {/* Items Range Summary */}
      <div className="flex items-center gap-2">
        {totalItems !== undefined && (
          <span>
            Showing{' '}
            <span className="font-semibold text-text-primary">
              {totalItems === 0 ? 0 : startItem}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-text-primary">{endItem}</span> of{' '}
            <span className="font-semibold text-text-primary">{totalItems}</span> {itemLabel}
          </span>
        )}

        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden sm:inline">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-surface-elevated border border-border-default rounded-lg text-text-primary font-medium focus:ring-1 focus:ring-brand-primary outline-none transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation & Number Buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First Page"
          className="p-1.5 rounded-lg border border-border-default hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
          className="p-1.5 rounded-lg border border-border-default hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-text-muted select-none"
                >
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-xs font-semibold transition-all shadow-sm ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-brand-primary/20 scale-105'
                    : 'border border-border-default hover:bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
          className="p-1.5 rounded-lg border border-border-default hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
          className="p-1.5 rounded-lg border border-border-default hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
