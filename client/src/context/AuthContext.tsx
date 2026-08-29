"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, logout as logoutService } from '@/service/auth';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: () => Promise<User>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then(userData => {
        setUser(userData);
        setIsAuthenticated(true);
      })
      .catch(() => {
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);


  const login = useCallback(async () => {
    const userData = await getMe() as User;
    setUser(userData);
    setIsAuthenticated(true);
    return userData;
  }, []);


  const logout = useCallback(async () => {
    try {
      await logoutService();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      router.replace('/login');
    }
  }, [router]);


  return (
    <AuthContext.Provider 
      value={useMemo(
        () => ({ isAuthenticated, user, login, logout, loading }),
        [isAuthenticated, user, login, logout, loading]
      )}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
