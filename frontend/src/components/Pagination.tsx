import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination as PaginationType } from '../types';

interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ pagination, onPageChange }: PaginationProps) => {
  const { page, totalPages, totalCount, limit } = pagination;
  if (totalCount === 0) return null;

  const rangeStart = (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, totalCount);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm">
      <p className="text-ink-faint font-mono">
        {rangeStart}–{rangeEnd} of {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-line text-ink-soft hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 font-mono text-ink-soft">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-line text-ink-soft hover:bg-paper disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
