import { createContext, useContext, useEffect, useState } from 'react';
import * as api from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value = {
    user,
    loading,
    login: async (creds) => setUser(await api.login(creds)),
    register: async (data) => setUser(await api.register(data)),
    logout: async () => { await api.logout(); setUser(null); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
