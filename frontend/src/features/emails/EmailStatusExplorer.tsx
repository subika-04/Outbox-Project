import { useState } from 'react';
import { Search, Ban, RotateCcw, Inbox } from 'lucide-react';
import { useEmailList } from '../../hooks/useEmailList';
import { emailService } from '../../services/emailService';
import { DataTable, Column } from '../../components/Table';
import { StatusBadge } from '../../components/Badge';
import { Pagination } from '../../components/Pagination';
import { TableSkeleton } from '../../components/Loading';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Select } from '../../components/Input';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { EmailRecord, EmailStatus, ApiError } from '../../types';
import { formatDateTime } from '../../utils/formatDate';

interface EmailStatusExplorerProps {
  title: string;
  description: string;
  statusOptions: { value: EmailStatus; label: string }[];
  defaultStatus: EmailStatus;
  timeColumnLabel: string;
  timeColumnValue: (email: EmailRecord) => string | null;
}

export const EmailStatusExplorer = ({
  title,
  description,
  statusOptions,
  defaultStatus,
  timeColumnLabel,
  timeColumnValue,
}: EmailStatusExplorerProps) => {
  const [status, setStatus] = useState<EmailStatus>(defaultStatus);
  const [searchInput, setSearchInput] = useState('');
  const { emails, pagination, setPage, setSearch, loading, error, reload } = useEmailList(status);
  const [actingId, setActingId] = useState<string | null>(null);
  const { show } = useToast();

  const handleCancel = async (email: EmailRecord) => {
    setActingId(email.id);
    try {
      await emailService.cancel(email.id);
      show('success', `Cancelled the email to ${email.recipient}.`);
      reload();
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Could not cancel this email.');
    } finally {
      setActingId(null);
    }
  };

  const handleRetry = async (email: EmailRecord) => {
    setActingId(email.id);
    try {
      await emailService.retry(email.id);
      show('success', `Retrying the email to ${email.recipient}.`);
      reload();
    } catch (e) {
      show('error', e instanceof ApiError ? e.message : 'Could not retry this email.');
    } finally {
      setActingId(null);
    }
  };

  const columns: Column<EmailRecord>[] = [
    { key: 'recipient', header: 'Email', render: (e) => <span className="font-mono text-sm">{e.recipient}</span> },
    { key: 'subject', header: 'Subject', render: (e) => <span className="truncate block max-w-xs">{e.subject}</span> },
    { key: 'sender', header: 'Sender', render: (e) => <span className="text-ink-soft">{e.sender.displayName}</span> },
    {
      key: 'time',
      header: timeColumnLabel,
      render: (e) => <span className="font-mono text-ink-soft">{formatDateTime(timeColumnValue(e))}</span>,
    },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ];

  return (
    <div className="bg-white border border-line rounded-lg shadow-card overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4 border-b border-line">
        <div>
          <h2 className="font-display font-semibold text-ink">{title}</h2>
          <p className="text-xs text-ink-faint">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                setSearch(value);
              }}
              placeholder="Search recipient or subject…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-line bg-white focus-ring w-56"
            />
          </div>
          {statusOptions.length > 1 && (
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as EmailStatus);
                setPage(1);
              }}
              options={statusOptions}
              className="!py-1.5 w-36"
            />
          )}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : emails.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title="No emails here yet"
          description={
            searchInput
              ? `Nothing matches "${searchInput}" for this status.`
              : `Emails with status "${status}" will show up here.`
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={emails}
            rowKey={(e) => e.id}
            actions={(e) =>
              e.status === 'SCHEDULED' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Ban className="w-3.5 h-3.5" />}
                  loading={actingId === e.id}
                  onClick={() => handleCancel(e)}
                >
                  Cancel
                </Button>
              ) : e.status === 'FAILED' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  loading={actingId === e.id}
                  onClick={() => handleRetry(e)}
                >
                  Retry
                </Button>
              ) : null
            }
          />
          {pagination && <Pagination pagination={pagination} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
};
