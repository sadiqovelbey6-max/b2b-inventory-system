import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { queryClient } from './lib/queryClient';
import ToastProvider from './components/toast/ToastProvider';
import NotificationProvider from './components/notifications/NotificationProvider';
import GlobalLoader from './components/GlobalLoader';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <ToastProvider>
            <GlobalLoader />
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
