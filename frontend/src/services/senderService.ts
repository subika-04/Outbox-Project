import { api } from './api';
import { ApiResponse, Sender } from '../types';

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  hourlyLimit?: number;
}

export const senderService = {
  async list(): Promise<Sender[]> {
    const res = await api.get<ApiResponse<{ senders: Sender[] }>>('/api/senders');
    const body = res.data as Extract<ApiResponse<{ senders: Sender[] }>, { success: true }>;
    return body.data.senders;
  },

  async create(input: CreateSenderInput): Promise<Sender> {
    const res = await api.post<ApiResponse<{ sender: Sender }>>('/api/senders', input);
    const body = res.data as Extract<ApiResponse<{ sender: Sender }>, { success: true }>;
    return body.data.sender;
  },
};
