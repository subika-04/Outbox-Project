import { api, API_ORIGIN } from './api';
import { ApiResponse, SlackStatus } from '../types';

export const slackService = {
  async status(): Promise<SlackStatus> {
    const res = await api.get<ApiResponse<SlackStatus>>('/api/slack/status');
    const body = res.data as Extract<ApiResponse<SlackStatus>, { success: true }>;
    return body.data;
  },

  connect(): void {
    window.location.href = `${API_ORIGIN}/api/slack/connect`;
  },

  async disconnect(): Promise<void> {
    await api.post('/api/slack/disconnect');
  },
};
