import { Loader2 } from 'lucide-react';

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-faint">
    <Loader2 className="w-6 h-6 animate-spin" />
    <p className="text-sm font-mono">{label}</p>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="divide-y divide-line">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 px-4 py-3.5">
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="h-4 bg-line/70 rounded animate-pulse flex-1" />
        ))}
      </div>
    ))}
  </div>
);
