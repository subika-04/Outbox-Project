import { EmailStatusExplorer } from '../features/emails/EmailStatusExplorer';

export const ScheduledEmails = () => (
  <div className="space-y-4">
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Scheduled emails</h1>
      <p className="text-sm text-ink-faint">Jobs waiting in the queue, keyed by their delayed BullMQ job.</p>
    </div>
    <EmailStatusExplorer
      title="Queue"
      description="Filter by state or search recipient/subject across your scheduled jobs."
      statusOptions={[
        { value: 'SCHEDULED', label: 'Scheduled' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ]}
      defaultStatus="SCHEDULED"
      timeColumnLabel="Scheduled at"
      timeColumnValue={(e) => e.scheduledAt}
    />
  </div>
);
