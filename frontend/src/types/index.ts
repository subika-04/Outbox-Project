// Shared types mirroring the backend's actual Prisma models + API envelopes.
// Kept in sync with backend/prisma/schema.prisma and backend/src/controllers/*.

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  hourlyLimit: number;
  enabled: boolean;
}

export interface SenderSummary {
  email: string;
  displayName: string;
}

export interface EmailRecord {
  id: string;
  userId: string;
  senderId: string;
  sender: SenderSummary;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  bullJobId: string | null;
  attempts: number;
  rescheduleCount: number;
  error: string | null;
  providerMessageId: string | null;
  esIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SlackConnectionInfo {
  teamName: string;
  channelId: string;
  createdAt: string;
}

export interface SlackStatus {
  connected: boolean;
  connection: SlackConnectionInfo | null;
}

export interface SearchResult {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
}

// ---- API envelope shapes, matching backend's { success, data } / { success, error } pattern ----

export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorShape {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorShape;

// Normalized error thrown by the api client for consistent handling in the UI.
export class ApiError extends Error {
  code: string;
  details?: unknown;
  status?: number;

  constructor(message: string, code: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
