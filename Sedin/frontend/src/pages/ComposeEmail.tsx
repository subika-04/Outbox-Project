import { ComposeForm } from '../features/compose/ComposeForm';

export const ComposeEmail = () => (
  <div className="space-y-4">
    <div>
      <h1 className="font-display text-xl font-semibold text-ink">Compose email</h1>
      <p className="text-sm text-ink-faint">Upload recipients, write your message, and pick a start time.</p>
    </div>
    <ComposeForm />
  </div>
);
