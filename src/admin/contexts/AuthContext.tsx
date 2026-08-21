import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, ROLE_LABELS, Permission, ROLE_PERMISSIONS } from '../types';
import {
  getCurrentUser,
  setCurrentUser,
  findUserByUsername,
} from '../utils/storage';
import { verifyPassword } from '../utils/crypto';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  hasPermission: (perm: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // 恢复登录状态（sessionStorage：关闭浏览器自动登出）
    const saved = getCurrentUser();
    if (saved) {
      // 重新从当前配置读取最新用户数据（可能角色被修改了）
      const latest = findUserByUsername(saved.username);
      if (latest) {
        setUser(latest);
        setCurrentUser(latest);
      } else {
        // 用户可能被删除了
        setCurrentUser(null);
      }
    }
  }, []);

  const login = useCallback((username: string, password: string): boolean => {
    const found = findUserByUsername(username);
    if (!found) return false;
    if (!verifyPassword(password, found.passwordHash)) return false;
    setUser(found);
    setCurrentUser(found);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setCurrentUser(null);
  }, []);

  const hasPermission = useCallback(
    (perm: Permission): boolean => {
      if (!user) return false;
      return ROLE_PERMISSIONS[user.role].includes(perm);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ROLE_LABELS };
export type { UserRole };
