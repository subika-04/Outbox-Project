import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState = ({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
    <div className="w-10 h-10 rounded-full bg-manifest-failedBg flex items-center justify-center text-manifest-failed">
      <AlertTriangle className="w-5 h-5" />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-sm text-ink-faint max-w-sm">{message}</p>
    </div>
    {onRetry && (
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);
