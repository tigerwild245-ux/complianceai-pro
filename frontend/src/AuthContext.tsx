import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from './lib/api';

interface User {
  id: string;
  fullName: string;
  email: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  /**
   * Sign up a new user
   */
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const result = await authAPI.signUp({
        fullName,
        email,
        password
      });

      if (result.success && result.user) {
        setUser(result.user);
        return { data: { user: result.user }, error: null };
      }

      return { data: null, error: { message: result.message || 'Registration failed' } };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { 
        data: null, 
        error: { message: error.message || 'Registration failed' } 
      };
    }
  };

  /**
   * Log in an existing user
   */
  const login = async (email: string, password: string) => {
    try {
      const result = await authAPI.signIn({ email, password });

      if (result.success && result.user) {
        setUser(result.user);
        return { data: { user: result.user }, error: null };
      }

      return { data: null, error: { message: result.message || 'Login failed' } };
    } catch (error: any) {
      console.error('Login error:', error);
      return { 
        data: null, 
        error: { message: error.message || 'Login failed' } 
      };
    }
  };

  /**
   * Log out current user
   */
  const logout = () => {
    setUser(null);
    authAPI.signOut();
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, signUp, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
