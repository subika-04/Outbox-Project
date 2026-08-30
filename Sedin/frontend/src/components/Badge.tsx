import { EmailStatus } from '../types';

const STATUS_CONFIG: Record<EmailStatus, { label: string; fg: string; bg: string }> = {
  SCHEDULED: { label: 'Scheduled', fg: 'text-manifest-scheduled', bg: 'bg-manifest-scheduledBg' },
  PROCESSING: { label: 'Processing', fg: 'text-manifest-processing', bg: 'bg-manifest-processingBg' },
  SENT: { label: 'Sent', fg: 'text-manifest-sent', bg: 'bg-manifest-sentBg' },
  FAILED: { label: 'Failed', fg: 'text-manifest-failed', bg: 'bg-manifest-failedBg' },
  CANCELLED: { label: 'Cancelled', fg: 'text-manifest-cancelled', bg: 'bg-manifest-cancelledBg' },
};

export const StatusBadge = ({ status }: { status: EmailStatus }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium ${cfg.fg} ${cfg.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.fg.replace('text-', 'bg-')}`} />
      {cfg.label}
    </span>
  );
};
