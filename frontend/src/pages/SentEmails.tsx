import { EmailStatusExplorer } from '../features/emails/EmailStatusExplorer';

export const SentEmails = () => (
  <div className="space-y-4">
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Sent emails</h1>
      <p className="text-sm text-ink-faint">Completed send attempts, successful or failed.</p>
    </div>
    <EmailStatusExplorer
      title="History"
      description="Filter by outcome or search recipient/subject across completed attempts."
      statusOptions={[
        { value: 'SENT', label: 'Sent' },
        { value: 'FAILED', label: 'Failed' },
      ]}
      defaultStatus="SENT"
      timeColumnLabel="Sent at"
      timeColumnValue={(e) => e.sentAt ?? e.failedAt}
    />
  </div>
);
