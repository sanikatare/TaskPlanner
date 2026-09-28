import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { auth } from '@/config/firebase';
import { API_BASE_URL } from '@/config/constants';

const AUTH_TOKEN_KEY = 'auth-token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

// Backward compatibility
export const getDevAuthToken = getAuthToken;
export const setDevAuthToken = setAuthToken;
export const clearDevAuthToken = clearAuthToken;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const storedToken = getAuthToken();
    if (storedToken) {
      config.headers.Authorization = `Bearer ${storedToken}`;
      return config;
    }

    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (getAuthToken()) {
        clearAuthToken();
        window.location.href = '/login';
        return Promise.reject(error);
      }
      await auth?.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
