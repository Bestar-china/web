import { User, SiteContent, SecuritySettings, DEFAULT_USER, DEFAULT_CONTENT, DEFAULT_SECURITY_SETTINGS } from '../types';

// ==================== 内存状态（替代 localStorage） ====================
// 静态托管下无法写文件，配置以 config.xml 文件形式随站点发布。
// 运行时：加载 config.xml → 内存；后台修改 → 内存 + 标记 dirty → 导出新 config.xml → 放回站点部署。

interface ConfigState {
  users: User[];
  content: SiteContent;
  security: SecuritySettings;
  initialized: boolean;
  dirty: boolean;
}

let state: ConfigState = {
  users: [DEFAULT_USER],
  content: DEFAULT_CONTENT,
  security: DEFAULT_SECURITY_SETTINGS,
  initialized: false,
  dirty: false,
};

// ---- 读取 ----
export function getUsersState(): User[] {
  return state.users;
}

export function getContentState(): SiteContent {
  return state.content;
}

export function getSecurityState(): SecuritySettings {
  return state.security;
}

export function setSecurityState(security: SecuritySettings): void {
  state.security = security;
  state.dirty = true;
}

export function isStateInitialized(): boolean {
  return state.initialized;
}

export function isStateDirty(): boolean {
  return state.dirty;
}

// ---- 写入 ----
export function setUsersState(users: User[]): void {
  state.users = users;
  state.dirty = true;
}

export function setContentState(content: SiteContent): void {
  state.content = content;
  state.dirty = true;
}

/** 从 config.xml 加载完成后填充状态 */
export function loadStateFromXml(users: User[], content: SiteContent, security?: SecuritySettings): void {
  state.users = users;
  state.content = content;
  if (security) state.security = security;
  state.initialized = true;
}

/** config.xml 加载失败时回退默认 */
export function fallbackState(): void {
  state.users = [DEFAULT_USER];
  state.content = DEFAULT_CONTENT;
  state.security = DEFAULT_SECURITY_SETTINGS;
  state.initialized = true;
}

export function markStateClean(): void {
  state.dirty = false;
}
