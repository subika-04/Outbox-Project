import axios, { AxiosError } from 'axios';
import { ApiError, ApiErrorShape } from '../types';

// Backend runs on :9000. In dev, Vite also proxies /api, /auth, /admin there,
// but we call the absolute origin so this client behaves the same in prod.
export const API_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN as string | undefined) ?? 'http://localhost:9000';

export const api = axios.create({
  baseURL: API_ORIGIN,
  withCredentials: true, // session cookie, not localStorage — must match backend cookie auth
});

// Normalize every failure into an ApiError so UI code never has to branch on
// axios internals vs. the backend's { success:false, error } envelope.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    if (error.response?.data && typeof error.response.data === 'object' && 'error' in error.response.data) {
      const { code, message, details } = error.response.data.error;
      return Promise.reject(new ApiError(message, code, error.response.status, details));
    }
    if (error.request && !error.response) {
      return Promise.reject(
        new ApiError('Could not reach the server. Check your connection and try again.', 'NETWORK_ERROR')
      );
    }
    return Promise.reject(new ApiError(error.message || 'Something went wrong.', 'UNKNOWN_ERROR'));
  }
);
