import { useNavigate } from 'react-router-dom';
import { PenSquare, Clock3, Send, ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { SlackConnectionWidget } from '../features/slack/SlackConnectionWidget';
import { GlobalSearch } from '../features/search/GlobalSearch';
import { EmailStatusExplorer } from '../features/emails/EmailStatusExplorer';
import { useAuth } from '../features/auth/AuthContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">
            Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-ink-faint">Here's what's moving through your send queue.</p>
        </div>
        <Button icon={<PenSquare className="w-4 h-4" />} onClick={() => navigate('/compose')}>
          Compose new email
        </Button>
      </div>

      <GlobalSearch />

      <SlackConnectionWidget />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <Clock3 className="w-4 h-4" /> Scheduled emails
          </h2>
          <button
            onClick={() => navigate('/scheduled')}
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <EmailStatusExplorer
          title="Upcoming sends"
          description="Emails waiting for their scheduled time or being processed by the worker."
          statusOptions={[
            { value: 'SCHEDULED', label: 'Scheduled' },
            { value: 'PROCESSING', label: 'Processing' },
          ]}
          defaultStatus="SCHEDULED"
          timeColumnLabel="Scheduled at"
          timeColumnValue={(e) => e.scheduledAt}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <Send className="w-4 h-4" /> Sent emails
          </h2>
          <button
            onClick={() => navigate('/sent')}
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <EmailStatusExplorer
          title="Recent activity"
          description="Emails the worker has already attempted to send."
          statusOptions={[
            { value: 'SENT', label: 'Sent' },
            { value: 'FAILED', label: 'Failed' },
          ]}
          defaultStatus="SENT"
          timeColumnLabel="Sent at"
          timeColumnValue={(e) => e.sentAt ?? e.failedAt}
        />
      </section>
    </div>
  );
};
