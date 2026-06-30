import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setToken, clearToken } from '../api/pmClient';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => sessionStorage.getItem('pm_token') || null);
  const [user, setUser] = useState(() => { const u = sessionStorage.getItem('pm_user'); return u ? JSON.parse(u) : null; });
  useEffect(() => { token ? setToken(token) : clearToken(); }, [token]);
  const login = useCallback((newToken, userObj) => { sessionStorage.setItem('pm_token', newToken); sessionStorage.setItem('pm_user', JSON.stringify(userObj)); setToken(newToken); setTokenState(newToken); setUser(userObj); }, []);
  const logout = useCallback(() => { sessionStorage.removeItem('pm_token'); sessionStorage.removeItem('pm_user'); clearToken(); setTokenState(null); setUser(null); }, []);
  return <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; }
