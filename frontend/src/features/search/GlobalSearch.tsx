import { useState } from 'react';
import { Search, X, ServerCrash } from 'lucide-react';
import { emailService } from '../../services/emailService';
import { SearchResult, ApiError } from '../../types';
import { StatusBadge } from '../../components/Badge';
import { formatDateTime } from '../../utils/formatDate';
import { Loading } from '../../components/Loading';

export const GlobalSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [esDown, setEsDown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await emailService.search(q.trim());
      setResults(res.results);
      setEsDown(res.isElasticsearchDown);
      setOpen(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Search failed.');
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults(null);
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch(query);
            if (e.key === 'Escape') clear();
          }}
          placeholder="Search all emails by subject, body, or recipient…"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-line bg-white focus-ring"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-line rounded-md shadow-popover max-h-96 overflow-y-auto">
          {loading ? (
            <Loading label="Searching Elasticsearch…" />
          ) : error ? (
            <p className="p-4 text-sm text-manifest-failed">{error}</p>
          ) : (
            <>
              {esDown && (
                <div className="flex items-center gap-2 px-4 py-2 bg-manifest-scheduledBg text-manifest-scheduled text-xs border-b border-line">
                  <ServerCrash className="w-3.5 h-3.5" />
                  Elasticsearch is unreachable right now — search results may be incomplete.
                </div>
              )}
              {results && results.length === 0 ? (
                <p className="p-4 text-sm text-ink-faint">No emails match "{query}".</p>
              ) : (
                <ul className="divide-y divide-line">
                  {results?.map((r) => (
                    <li key={r.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink font-medium truncate">{r.subject}</p>
                        <p className="text-xs text-ink-faint font-mono truncate">{r.recipient}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={r.status} />
                        <span className="text-[11px] text-ink-faint font-mono">
                          {formatDateTime(r.sentAt ?? r.scheduledAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
