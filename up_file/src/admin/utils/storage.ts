import { User, SiteContent } from '../types';
import {
  getUsersState,
  getContentState,
  setUsersState,
  setContentState,
} from './state';

// ==================== 数据源 ====================
// 本系统不使用 localStorage —— 配置统一存储在站点根目录的 config.xml（静态托管共享）。
// 本模块提供与旧版一致的 API，底层读写 state.ts 的内存状态。
// 当前登录用户使用 sessionStorage：关闭标签页 / 浏览器后自动清除 → 自动登出。

// ==================== 用户（内存，随 config.xml 部署） ====================
export function getUsers(): User[] {
  return getUsersState();
}

export function saveUsers(users: User[]): void {
  setUsersState(users);
}

export function addUser(username: string, passwordHash: string, role: User['role']): User {
  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
  };
  setUsersState([...getUsersState(), newUser]);
  return newUser;
}

export function updateUser(id: string, updates: Partial<User>): void {
  const users = getUsersState();
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) {
    const next = [...users];
    next[idx] = { ...next[idx], ...updates };
    setUsersState(next);
  }
}

export function deleteUser(id: string): void {
  setUsersState(getUsersState().filter((u) => u.id !== id));
}

export function findUserByUsername(username: string): User | undefined {
  return getUsersState().find((u) => u.username.toLowerCase() === username.toLowerCase());
}

// ==================== 当前登录用户（sessionStorage → 关闭浏览器自动登出） ====================
const SESSION_KEY = 'enterprise_session_user';

export function getCurrentUser(): User | null {
  try {
    const name = sessionStorage.getItem(SESSION_KEY);
    if (!name) return null;
    return findUserByUsername(name) ?? null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null): void {
  try {
    if (user) {
      sessionStorage.setItem(SESSION_KEY, user.username);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

// ==================== 站点内容（内存，随 config.xml 部署） ====================
export function getSiteContent(): SiteContent {
  return getContentState();
}

export function saveSiteContent(content: SiteContent): void {
  setContentState(content);
}

// ==================== 配置初始化 / 导出（转发到 config.ts） ====================
export {
  initConfig,
  isConfigReady,
  isConfigDirty,
  markConfigClean,
  exportConfigXml,
} from './config';
