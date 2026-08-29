import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/config/publicEnv';


type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const refreshApi = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error?: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      await new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      return api(originalRequest);
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      await refreshApi.get('/auth/v1/refresh');
      processQueue();
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      if (
        typeof window !== 'undefined'
        && !['/login', '/signup'].includes(window.location.pathname)
      ) {
        window.location.replace('/login');
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
