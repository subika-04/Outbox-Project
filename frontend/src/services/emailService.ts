import { api } from './api';
import { ApiResponse, EmailRecord, EmailStatus, Pagination, SearchResult } from '../types';

export interface ScheduleEmailInput {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
}

export interface ScheduleEmailResult {
  scheduled: { id: string; jobId: string | null }[];
}

export interface ListEmailsParams {
  status?: EmailStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const emailService = {
  async schedule(input: ScheduleEmailInput): Promise<ScheduleEmailResult> {
    const res = await api.post<ApiResponse<ScheduleEmailResult>>('/api/emails/schedule', input);
    const body = res.data as Extract<ApiResponse<ScheduleEmailResult>, { success: true }>;
    return body.data;
  },

  // Backend exposes a single filterable GET /api/emails/ (no separate
  // /scheduled or /sent routes) — the Scheduled/Sent views both call this
  // with a different `status` filter.
  async list(params: ListEmailsParams): Promise<{ emails: EmailRecord[]; pagination: Pagination }> {
    const res = await api.get<ApiResponse<{ emails: EmailRecord[]; pagination: Pagination }>>(
      '/api/emails',
      { params }
    );
    const body = res.data as Extract<
      ApiResponse<{ emails: EmailRecord[]; pagination: Pagination }>,
      { success: true }
    >;
    return body.data;
  },

  async cancel(id: string): Promise<void> {
    await api.post(`/api/emails/${id}/cancel`);
  },

  async retry(id: string): Promise<void> {
    await api.post(`/api/emails/${id}/retry`);
  },

  // Elasticsearch-backed full text search, distinct from the DB `search` list filter.
  async search(q: string): Promise<{ results: SearchResult[]; isElasticsearchDown: boolean }> {
    const res = await api.get<ApiResponse<{ results: SearchResult[]; isElasticsearchDown: boolean }>>(
      '/api/emails/search',
      { params: { q } }
    );
    const body = res.data as Extract<
      ApiResponse<{ results: SearchResult[]; isElasticsearchDown: boolean }>,
      { success: true }
    >;
    return body.data;
  },
};
