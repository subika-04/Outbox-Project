import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
    {icon && <div className="text-ink-faint">{icon}</div>}
    <div className="space-y-1">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-ink-faint max-w-sm">{description}</p>}
    </div>
    {action}
  </div>
);
