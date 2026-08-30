import { useCallback, useEffect, useState } from 'react';
import { senderService } from '../services/senderService';
import { Sender, ApiError } from '../types';

export function useSenders() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await senderService.list();
      setSenders(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load sender profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { senders, loading, error, reload: load };
}
