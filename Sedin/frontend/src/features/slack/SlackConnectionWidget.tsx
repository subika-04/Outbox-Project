import { Hash, Slack, Unplug } from 'lucide-react';
import { useState } from 'react';
import { useSlackStatus } from '../../hooks/useSlackStatus';
import { slackService } from '../../services/slackService';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { ApiError } from '../../types';

export const SlackConnectionWidget = () => {
  const { status, loading, error, reload } = useSlackStatus();
  const [disconnecting, setDisconnecting] = useState(false);
  const { show } = useToast();

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await slackService.disconnect();
      show('success', 'Slack disconnected.');
      await reload();
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Could not disconnect Slack.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-white border border-line rounded-lg shadow-card p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-md flex items-center justify-center ${
            status?.connected ? 'bg-manifest-sentBg text-manifest-sent' : 'bg-paper text-ink-faint'
          }`}
        >
          <Slack className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Slack notifications</p>
          {loading ? (
            <p className="text-xs text-ink-faint font-mono">Checking connection…</p>
          ) : error ? (
            <p className="text-xs text-manifest-failed">{error}</p>
          ) : status?.connected && status.connection ? (
            <p className="text-xs text-ink-faint flex items-center gap-1">
              Connected to <span className="font-medium text-ink-soft">{status.connection.teamName}</span>
              <span className="inline-flex items-center gap-0.5 font-mono">
                <Hash className="w-3 h-3" />
                {status.connection.channelId}
              </span>
            </p>
          ) : (
            <p className="text-xs text-ink-faint">Get rate-limit alerts posted to a channel.</p>
          )}
        </div>
      </div>
      {!loading &&
        (status?.connected ? (
          <Button variant="secondary" size="sm" icon={<Unplug className="w-4 h-4" />} loading={disconnecting} onClick={handleDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={() => slackService.connect()}>
            Connect Slack
          </Button>
        ))}
    </div>
  );
};
