// ==================== 安全工具 ====================
// 纯前端静态站没有后端、没有数据库，SQL 注入不适用；
// 主要攻击面是存储型 XSS（恶意 URL 协议注入）与凭证泄露。
// 本模块提供白名单净化与登录防爆破。

// ---- 安全 URL 协议白名单 ----
// 仅允许这些协议/形式，其余一律视为不安全：
//   #锚点、/相对路径、http(s)、mailto、tel、./、../、?查询
const SAFE_HREF_PREFIXES = ['#', '/', './', '../', '?', 'http://', 'https://', 'mailto:', 'tel:'];

export function isSafeHref(href: string): boolean {
  const h = (href || '').trim().toLowerCase();
  if (!h) return false;
  return SAFE_HREF_PREFIXES.some((p) => h.startsWith(p));
}

/**
 * 净化 URL：阻断 javascript: / data: / vbscript: 等可执行协议。
 * 不安全时返回 '#'（锚点回退），避免点击执行恶意脚本。
 */
export function sanitizeHref(href: string | undefined | null): string {
  const h = (href || '').trim();
  if (!h) return '#';
  return isSafeHref(h) ? h : '#';
}

// ---- 颜色校验 ----
// 只允许 #hex / rgb / rgba / hsl / hsla / 常用命名色（用于标签、背景纯色）
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/;
const HSL_COLOR = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*[\d.]+)?\s*\)$/;
const NAMED_COLORS = new Set([
  'black','white','red','green','blue','yellow','orange','purple','pink','gray','grey',
  'brown','cyan','magenta','teal','navy','olive','maroon','silver','lime','gold','violet','indigo','coral','salmon','beige','ivory','khaki','lavender','turquoise',
]);

export function isSafeColor(color: string): boolean {
  const c = (color || '').trim();
  if (!c) return false;
  return HEX_COLOR.test(c) || RGB_COLOR.test(c) || HSL_COLOR.test(c) || NAMED_COLORS.has(c.toLowerCase());
}

export function sanitizeColor(color: string): string {
  return isSafeColor(color) ? color.trim() : '#4f46e5';
}

// ---- 渐变校验 ----
// 仅允许 linear-gradient/radial-gradient 形式，且内部不得包含 url( 或 ; 或 }（阻断 CSS 注入）
export function isSafeGradient(gradient: string): boolean {
  const g = (gradient || '').trim();
  if (!g) return false;
  if (!/^(linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\(.*\)$/i.test(g)) return false;
  if (/url\(|;|\}|\{/i.test(g)) return false;
  return true;
}

export function sanitizeGradient(gradient: string): string {
  return isSafeGradient(gradient) ? gradient.trim() : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

// ---- 登录防爆破（会话级） ----
// 纯前端无法真正限制网络攻击，但可防止同一浏览器内快速暴力尝试。
// 失败次数与锁定时长由超级管理员在「API 密钥管理」页配置（config.xml <security> 节点）。
// 若配置尚未加载（如加载失败回退），使用默认 5 次 / 30 秒。
import { SecuritySettings, DEFAULT_SECURITY_SETTINGS } from '../types';
import { getSecurityState } from './state';

const LOGIN_KEY = 'enterprise_login_fails';
const LOGIN_LOCK_KEY = 'enterprise_login_locked_until';

/** 读取当前生效的登录安全策略（默认 5 次 / 30 秒） */
export function getLoginPolicy(): SecuritySettings {
  const s = getSecurityState();
  if (!s) return { ...DEFAULT_SECURITY_SETTINGS };
  const maxFails = s.maxFails >= 1 && s.maxFails <= 100 ? Math.floor(s.maxFails) : DEFAULT_SECURITY_SETTINGS.maxFails;
  const lockMs = s.lockMs >= 1000 && s.lockMs <= 86_400_000 ? Math.floor(s.lockMs) : DEFAULT_SECURITY_SETTINGS.lockMs;
  return { maxFails, lockMs };
}

export function getLoginLockRemainMs(): number {
  try {
    const until = Number(sessionStorage.getItem(LOGIN_LOCK_KEY) || 0);
    return Math.max(0, until - Date.now());
  } catch {
    return 0;
  }
}

export function recordLoginFail(): void {
  try {
    const { maxFails, lockMs } = getLoginPolicy();
    const fails = Number(sessionStorage.getItem(LOGIN_KEY) || 0) + 1;
    sessionStorage.setItem(LOGIN_KEY, String(fails));
    if (fails >= maxFails) {
      sessionStorage.setItem(LOGIN_LOCK_KEY, String(Date.now() + lockMs));
    }
  } catch {
    // ignore
  }
}

export function resetLoginFails(): void {
  try {
    sessionStorage.removeItem(LOGIN_KEY);
    sessionStorage.removeItem(LOGIN_LOCK_KEY);
  } catch {
    // ignore
  }
}
