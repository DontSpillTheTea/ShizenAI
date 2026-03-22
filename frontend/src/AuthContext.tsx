import React, { createContext, useContext, useState, useEffect } from 'react';

type User = { name: string; role: string } | null;

interface AuthContextType {
  user: User;
  token: string | null;
  login: (token: string, name: string, role: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, login: () => {}, logout: () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    const storedName = localStorage.getItem('name');
    if (token && storedRole && storedName) {
      setUser({ name: storedName, role: storedRole });
    }
  }, [token]);

  const login = (newToken: string, name: string, role: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('name', name);
    localStorage.setItem('role', role);
    setToken(newToken);
    setUser({ name, role });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    localStorage.removeItem('role');
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
