import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginPage from './LoginPage';
import api from '../../lib/api';

vi.mock('../../hooks/useAuth', () => {
  const setSession = vi.fn();
  return {
    __esModule: true,
    default: () => ({
      setSession,
    }),
    useAuth: () => ({
      setSession,
    }),
  };
});

vi.mock('../../lib/api', () => {
  const post = vi.fn().mockResolvedValue({
    data: {
      user: { id: '1', email: 'admin@demo.az', role: 'super_admin' },
      accessToken: 'token',
      refreshToken: 'refresh',
    },
  });
  return {
    __esModule: true,
    default: {
      post,
      defaults: { baseURL: '' },
    },
  };
});

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> };

const renderWithProviders = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('LoginPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form and submits credentials', async () => {
    renderWithProviders();

    const adminPanelButton = await screen.findByRole('button', { name: /Admin Paneli/i });
    fireEvent.click(adminPanelButton);

    const emailInput = await screen.findByLabelText(/E-mail/i);
    fireEvent.change(emailInput, { target: { value: 'admin@demo.az' } });

    const passwordInput = await screen.findByLabelText(/Şifrə/i);
    fireEvent.change(passwordInput, { target: { value: 'Admin123!' } });

    const submitButton = await screen.findByRole('button', { name: /Daxil ol/i });
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/login', {
        email: 'admin@demo.az',
        password: 'Admin123!',
      }),
    );
  });
});

