// Very deliberately loose client-side parsing: this is a first pass to give
// the user immediate feedback ("Detected N email addresses") before they
// submit. The backend re-validates every recipient independently with the
// same zod email check used in scheduleEmailSchema — client parsing is a
// convenience, never the source of truth.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
}

export function parseRecipientsFromText(raw: string): ParsedRecipients {
  const tokens = raw
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    // Handle "Name <email@x.com>" style CSV cells defensively.
    const match = token.match(/<([^>]+)>/);
    const candidate = (match ? match[1] : token).trim();

    if (EMAIL_REGEX.test(candidate)) {
      const lower = candidate.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        valid.push(candidate);
      }
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}
