import { createContext } from 'react';
import type { User } from '../types';

export interface AuthSessionData {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSessionData) => void;
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

