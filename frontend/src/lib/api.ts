import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('b2b_access_token');
    
    // Token yoxdursa, session-dan yoxla
    if (!token) {
      const session = localStorage.getItem('b2b_auth_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed.accessToken) {
            token = parsed.accessToken;
            localStorage.setItem('b2b_access_token', parsed.accessToken);
          }
        } catch (error) {
          console.warn('Session parse error in interceptor', error);
        }
      }
    }
    
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 401 xətası zamanı refresh token ilə yeni access token almağa çalış
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 xətası və refresh token varsa, yeni access token al
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Əgər artıq refresh prosesi gedirsə, növbəyə qoy
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = localStorage.getItem('b2b_auth_session');
        if (session) {
          const parsed = JSON.parse(session);
          if (parsed.refreshToken) {
            // Refresh token ilə yeni access token al
            const response = await axios.post(
              `${baseURL}/refresh`,
              { refreshToken: parsed.refreshToken },
            );

            const { accessToken, refreshToken, user } = response.data;

            // Yeni token-ları localStorage-də saxla
            const newSession = {
              user,
              accessToken,
              refreshToken: refreshToken || parsed.refreshToken,
            };
            localStorage.setItem('b2b_auth_session', JSON.stringify(newSession));
            localStorage.setItem('b2b_access_token', accessToken);

            // AuthContext-də session-i yenilə (əgər mövcuddursa)
            // Bu, React komponentlərinin yenilənmiş session-i görməsi üçün lazımdır
            const event = new CustomEvent('auth:token-refreshed', {
              detail: { accessToken, refreshToken, user },
            });
            window.dispatchEvent(event);

            // Növbədə olan sorğuları yenilə
            processQueue(null, accessToken);

            // Orijinal sorğunu yenidən göndər
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            }
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh token da keçibsə və ya xəta varsa, session-i təmizlə
        processQueue(refreshError as AxiosError, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('b2b_access_token');
          localStorage.removeItem('b2b_auth_session');
          // Login səhifəsinə yönləndir
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;

