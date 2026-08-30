import { useCallback, useEffect, useState } from 'react';
import { emailService, ListEmailsParams } from '../services/emailService';
import { EmailRecord, Pagination, EmailStatus, ApiError } from '../types';

const PAGE_SIZE = 10;

export function useEmailList(status: EmailStatus) {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number, searchTerm: string) => {
      setLoading(true);
      setError(null);
      try {
        const params: ListEmailsParams = { status, page: targetPage, limit: PAGE_SIZE };
        if (searchTerm.trim()) params.search = searchTerm.trim();
        const result = await emailService.list(params);
        setEmails(result.emails);
        setPagination(result.pagination);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not load emails.');
      } finally {
        setLoading(false);
      }
    },
    [status]
  );

  useEffect(() => {
    load(page, search);
  }, [load, page, search]);

  const changeSearch = useCallback((term: string) => {
    setSearch(term);
    setPage(1);
  }, []);

  return {
    emails,
    pagination,
    page,
    setPage,
    search,
    setSearch: changeSearch,
    loading,
    error,
    reload: () => load(page, search),
  };
}
