import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, Mail, PlusCircle, Send } from 'lucide-react';
import { useSenders } from '../../hooks/useSenders';
import { emailService } from '../../services/emailService';
import { senderService } from '../../services/senderService';
import { FileUploader } from '../../components/FileUploader';
import { Input, Select, Textarea } from '../../components/Input';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { Loading } from '../../components/Loading';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ApiError } from '../../types';
import { ParsedRecipients } from '../../utils/parseRecipients';
import { toLocalInputValue } from '../../utils/formatDate';

interface FieldErrors {
  senderId?: string;
  recipients?: string;
  subject?: string;
  body?: string;
  scheduledAt?: string;
}

export const ComposeForm = () => {
  const { senders, loading: sendersLoading, error: sendersError, reload: reloadSenders } = useSenders();
  const { show } = useToast();
  const navigate = useNavigate();

  const [senderId, setSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date(Date.now() + 5 * 60 * 1000)));
  const [parsed, setParsed] = useState<ParsedRecipients>({ valid: [], invalid: [] });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const [showAddSender, setShowAddSender] = useState(false);

  const selectedSender = useMemo(() => senders.find((s) => s.id === senderId) ?? null, [senders, senderId]);

  const validateClientSide = (): boolean => {
    const errors: FieldErrors = {};
    if (!senderId) errors.senderId = 'Pick a sender profile to send from.';
    if (parsed.valid.length === 0) errors.recipients = 'Upload a file with at least one valid email address.';
    if (!subject.trim()) errors.subject = 'Subject is required.';
    if (!body.trim()) errors.body = 'Body is required.';
    if (!scheduledAt) {
      errors.scheduledAt = 'Pick a start time.';
    } else if (new Date(scheduledAt).getTime() < Date.now() - 60000) {
      errors.scheduledAt = 'Start time can\'t be in the past.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Translates the backend's zod error.format() shape into the same
  // FieldErrors map used for client-side errors, so both render identically.
  const applyBackendValidationErrors = (details: unknown) => {
    if (!details || typeof details !== 'object') return;
    const d = details as Record<string, { _errors?: string[] }>;
    const next: FieldErrors = {};
    if (d.senderId?._errors?.length) next.senderId = d.senderId._errors[0];
    if (d.recipients?._errors?.length) next.recipients = d.recipients._errors[0];
    if (d.subject?._errors?.length) next.subject = d.subject._errors[0];
    if (d.body?._errors?.length) next.body = d.body._errors[0];
    if (d.scheduledAt?._errors?.length) next.scheduledAt = d.scheduledAt._errors[0];
    setFieldErrors((prev) => ({ ...prev, ...next }));
  };

  const handleSubmit = async () => {
    setSuccessCount(null);
    if (!validateClientSide()) return;

    setSubmitting(true);
    try {
      const result = await emailService.schedule({
        senderId,
        recipients: parsed.valid,
        subject: subject.trim(),
        body,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setSuccessCount(result.scheduled.length);
      show('success', `Scheduled ${result.scheduled.length} email(s).`);
      setSubject('');
      setBody('');
      setParsed({ valid: [], invalid: [] });
      setFieldErrors({});
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'VALIDATION_ERROR') {
          applyBackendValidationErrors(e.details);
          show('error', 'The backend rejected some fields — check the highlighted inputs.');
        } else {
          show('error', e.message);
        }
      } else {
        show('error', 'Could not schedule this email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (sendersLoading) return <Loading label="Loading sender profiles…" />;
  if (sendersError) return <ErrorState message={sendersError} onRetry={reloadSenders} />;

  return (
    <div className="max-w-2xl space-y-6">
      {senders.length === 0 && (
        <EmptyState
          icon={<Mail className="w-8 h-8" />}
          title="No sender profiles yet"
          description="Add an SMTP sender before you can schedule an email."
          action={
            <Button size="sm" icon={<PlusCircle className="w-4 h-4" />} onClick={() => setShowAddSender(true)}>
              Add sender
            </Button>
          }
        />
      )}

      {senders.length > 0 && (
        <div className="bg-white border border-line rounded-lg p-6 space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label="Send from"
                required
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="Choose a sender profile"
                error={fieldErrors.senderId}
                options={senders.map((s) => ({ value: s.id, label: `${s.displayName} <${s.email}>` }))}
              />
            </div>
            <Button variant="secondary" size="md" onClick={() => setShowAddSender(true)} className="mb-0">
              <PlusCircle className="w-4 h-4" />
            </Button>
          </div>

          {selectedSender && (
            <p className="text-xs text-ink-faint bg-paper border border-line rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              This sender is capped at{' '}
              <span className="font-mono text-ink-soft">{selectedSender.hourlyLimit}/hr</span>. The minimum delay
              between sends is enforced automatically by the worker — no need to set one here.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              Recipients <span className="text-manifest-failed">*</span>
            </label>
            <FileUploader onParsed={setParsed} />
            {(parsed.valid.length > 0 || parsed.invalid.length > 0) && (
              <div className="mt-1.5 space-y-2">
                {parsed.valid.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {parsed.valid.slice(0, 6).map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center rounded-full border border-brand-500 text-brand-600 bg-white px-2.5 py-0.5 text-xs font-mono"
                      >
                        {email}
                      </span>
                    ))}
                    {parsed.valid.length > 6 && (
                      <span className="inline-flex items-center rounded-full border border-line text-ink-soft bg-paper px-2.5 py-0.5 text-xs font-mono">
                        +{parsed.valid.length - 6}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm flex items-center gap-1.5 text-manifest-sent">
                  <CheckCircle2 className="w-4 h-4" />
                  Detected {parsed.valid.length} email address{parsed.valid.length === 1 ? '' : 'es'}
                </p>
                {parsed.invalid.length > 0 && (
                  <p className="text-xs flex items-center gap-1.5 text-manifest-failed">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Ignored {parsed.invalid.length} line{parsed.invalid.length === 1 ? '' : 's'} that didn't look
                    like a valid email
                  </p>
                )}
              </div>
            )}
            {fieldErrors.recipients && <p className="text-xs text-manifest-failed">{fieldErrors.recipients}</p>}
          </div>

          <Input
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            error={fieldErrors.subject}
            placeholder="Q3 product update"
          />

          <Textarea
            label="Body"
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={fieldErrors.body}
            placeholder="Write your message…"
          />

          <Input
            label="Start time"
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            error={fieldErrors.scheduledAt}
            hint="Emails send no earlier than this time, subject to the sender's rate limit."
          />

          {successCount !== null && (
            <div className="flex items-center gap-2 text-sm text-manifest-sent bg-manifest-sentBg rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Scheduled {successCount} email(s). Track them on the{' '}
              <button onClick={() => navigate('/scheduled')} className="underline font-medium">
                Scheduled Emails
              </button>{' '}
              page.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button icon={<Send className="w-4 h-4" />} loading={submitting} onClick={handleSubmit}>
              Schedule email
            </Button>
          </div>
        </div>
      )}

      <AddSenderModal open={showAddSender} onClose={() => setShowAddSender(false)} onCreated={(id) => {
        reloadSenders();
        setSenderId(id);
        setShowAddSender(false);
      }} />
    </div>
  );
};

interface AddSenderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (senderId: string) => void;
}

const AddSenderModal = ({ open, onClose, onCreated }: AddSenderModalProps) => {
  const { show } = useToast();
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    hourlyLimit: '200',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const sender = await senderService.create({
        email: form.email,
        displayName: form.displayName,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpUser: form.smtpUser,
        smtpPass: form.smtpPass,
        hourlyLimit: form.hourlyLimit ? Number(form.hourlyLimit) : undefined,
      });
      show('success', `Added sender ${sender.email}.`);
      onCreated(sender.id);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VALIDATION_ERROR' && e.details) {
        const d = e.details as Record<string, { _errors?: string[] }>;
        const next: Record<string, string> = {};
        Object.entries(d).forEach(([key, val]) => {
          if (val?._errors?.length) next[key] = val._errors[0];
        });
        setErrors(next);
      } else {
        show('error', e instanceof ApiError ? e.message : 'Could not add this sender.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add sender profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={submit}>
            Save sender
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="From email" required value={form.email} onChange={update('email')} error={errors.email} />
        <Input
          label="Display name"
          required
          value={form.displayName}
          onChange={update('displayName')}
          error={errors.displayName}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="SMTP host" required value={form.smtpHost} onChange={update('smtpHost')} error={errors.smtpHost} />
          <Input label="SMTP port" required type="number" value={form.smtpPort} onChange={update('smtpPort')} error={errors.smtpPort} />
        </div>
        <Input label="SMTP username" required value={form.smtpUser} onChange={update('smtpUser')} error={errors.smtpUser} />
        <Input label="SMTP password" required type="password" value={form.smtpPass} onChange={update('smtpPass')} error={errors.smtpPass} />
        <Input
          label="Hourly limit"
          type="number"
          value={form.hourlyLimit}
          onChange={update('hourlyLimit')}
          error={errors.hourlyLimit}
          hint="Max sends per hour for this sender. Enforced server-side."
        />
      </div>
    </Modal>
  );
};
