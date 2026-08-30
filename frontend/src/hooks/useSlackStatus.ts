import { useCallback, useEffect, useState } from 'react';
import { slackService } from '../services/slackService';
import { SlackStatus, ApiError } from '../types';

export function useSlackStatus() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await slackService.status();
      setStatus(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load Slack status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { status, loading, error, reload: load };
}
