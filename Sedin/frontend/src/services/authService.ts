import { api, API_ORIGIN } from './api';
import { ApiResponse, User } from '../types';

export const authService = {
  // Full page redirect — this is a real OAuth handshake, not an XHR.
  redirectToGoogleLogin(): void {
    window.location.href = `${API_ORIGIN}/auth/google`;
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    const body = res.data as Extract<ApiResponse<{ user: User }>, { success: true }>;
    return body.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
