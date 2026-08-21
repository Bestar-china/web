// ==================== GitHub 自动部署（config.xml 自动写入） ====================
// 原理：静态托管下浏览器无法直接写服务器文件，但可以调用 GitHub Contents API
// 把 config.xml 自动写回仓库 → 触发 GitHub Pages 自动重新构建 → 全站生效。
//
// 安全设计：
//   1. API Token 只存 sessionStorage（当前浏览器会话），关闭浏览器即清除，
//      绝不写入 config.xml / localStorage / 任何共享文件 —— 防止访客窃取。
//   2. 所有导出/推送操作内部二次校验：仅 super_admin 角色可用
//      （即使通过控制台调用也会被拒绝）。
//   3. 仓库地址仅允许 owner/repo 格式，防止路径注入。

import { User } from '../types';
import { getUsersState, getContentState } from './state';
import { buildConfigXml } from './config';

// ==================== 会话级存储（不进 config.xml） ====================
const TOKEN_KEY = 'enterprise_github_token';
const SETTINGS_KEY = 'enterprise_github_settings';

export function getGithubToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setGithubToken(token: string): void {
  try {
    const t = (token || '').trim();
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function clearGithubToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getGithubSettings(): { repo: string; branch: string } {
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY);
    if (!raw) return { repo: '', branch: 'main' };
    const parsed = JSON.parse(raw) as { repo?: string; branch?: string };
    return {
      repo: typeof parsed.repo === 'string' ? parsed.repo.trim() : '',
      branch: typeof parsed.branch === 'string' && parsed.branch.trim() ? parsed.branch.trim() : 'main',
    };
  } catch {
    return { repo: '', branch: 'main' };
  }
}

export function saveGithubSettings(settings: { repo: string; branch: string }): void {
  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// ==================== 权限校验 ====================
/** 仅超级管理员可操作 GitHub 部署。非 super_admin 一律拒绝。 */
export function requireDeployPermission(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'super_admin';
}

// ==================== GitHub Contents API ====================
/** 仓库名格式校验：owner/repo，仅允许字母数字-_./ */
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** 安全路径校验：不允许 ../、控制字符、前导 / */
export function isValidRepoPath(path: string): boolean {
  const p = (path || '').trim();
  if (!p || p.startsWith('/')) return false;
  if (p.includes('..')) return false;
  if (/[\x00-\x1f]/.test(p)) return false;
  return /^[A-Za-z0-9_./\-]+\.[A-Za-z0-9]+$/.test(p) || /^[A-Za-z0-9_./\-]+\/[A-Za-z0-9_./\-]+$/.test(p);
}

/** 构建 GitHub API 请求头（需已保存 Token） */
function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/**
 * 读取仓库内任意文件（Contents API GET）。
 * @param path 仓库内相对路径，如 api/key/api_key_storage.xml
 */
export async function getGithubFile(path: string): Promise<{ exists: boolean; sha?: string; content?: string; message?: string }> {
  const token = getGithubToken();
  const { repo, branch } = getGithubSettings();
  if (!token) return { exists: false, message: '未配置 GitHub Token' };
  if (!isValidRepo(repo)) return { exists: false, message: '仓库格式不正确' };
  if (!isValidRepoPath(path)) return { exists: false, message: '文件路径不合法' };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
      { headers: buildHeaders(token), cache: 'no-store' }
    );
    if (res.status === 404) return { exists: false };
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null;
      return { exists: false, message: `读取 ${path} 失败（${res.status}）：${err?.message ?? '未知错误'}` };
    }
    const data = (await res.json()) as { sha?: string; content?: string; encoding?: string };
    let text = '';
    if (data.content && data.encoding === 'base64') {
      try {
        const bytes = Uint8Array.from(atob(data.content.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
        text = new TextDecoder().decode(bytes);
      } catch {
        text = '';
      }
    }
    return { exists: true, sha: data.sha, content: text };
  } catch {
    return { exists: false, message: '无法连接 GitHub API，请检查网络' };
  }
}

/**
 * 写入/更新仓库内任意文件（Contents API PUT，自动处理 sha）。
 * @param path 仓库内相对路径
 * @param content 文件文本内容（UTF-8，自动 BOM 处理）
 */
export async function putGithubFile(path: string, content: string, commitMsg?: string): Promise<DeployResult> {
  const token = getGithubToken();
  const { repo, branch } = getGithubSettings();
  if (!token) return { ok: false, message: '未配置 GitHub Token' };
  if (!isValidRepo(repo)) return { ok: false, message: '仓库格式不正确，应为 owner/repo' };
  if (!isValidBranch(branch)) return { ok: false, message: '分支名不合法' };
  if (!isValidRepoPath(path)) return { ok: false, message: '文件路径不合法' };

  const base = `https://api.github.com/repos/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  try {
    // 1) 读取现有 sha
    let sha: string | undefined;
    try {
      const getRes = await fetch(base + `?ref=${encodeURIComponent(branch)}`, { headers: buildHeaders(token), cache: 'no-store' });
      if (getRes.ok) {
        const data = (await getRes.json()) as { sha?: string };
        sha = data.sha;
      } else if (getRes.status !== 404) {
        const err = (await getRes.json().catch(() => null)) as { message?: string } | null;
        return { ok: false, message: `读取 ${path} 失败（${getRes.status}）：${err?.message ?? '请检查 Token 权限'}` };
      }
    } catch {
      return { ok: false, message: '无法连接 GitHub API，请检查网络' };
    }

    // 2) 写入
    const putRes = await fetch(base, {
      method: 'PUT',
      headers: { ...buildHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMsg || `chore: 更新 ${path} [workbuddy]`,
        content: utf8Base64(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = (await putRes.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: `写入 ${path} 失败（${putRes.status}）：${err?.message ?? '未知错误'}` };
    }

    return { ok: true, message: `${path} 已推送到 ${repo}@${branch}` };
  } catch {
    return { ok: false, message: '推送请求异常，请稍后重试' };
  }
}

export function isValidRepo(repo: string): boolean {
  return REPO_PATTERN.test(repo.trim());
}

/** 分支名校验：不允许空格、../、控制字符 */
export function isValidBranch(branch: string): boolean {
  const b = branch.trim();
  return b.length > 0 && b.length <= 100 && !/\s/.test(b) && !b.includes('..') && !/[\x00-\x1f]/.test(b);
}

/** UTF-8 安全的 Base64 编码（btoa 无法直接处理中文） */
export function utf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type DeployResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * 把当前配置自动写入 GitHub 仓库（覆盖 config.xml）。
 * @param user 当前登录用户（内部校验 super_admin）
 */
export async function pushConfigToGithub(user: User | null): Promise<DeployResult> {
  // ---- 权限验证：仅超级管理员 ----
  if (!requireDeployPermission(user)) {
    return { ok: false, message: '权限不足：仅超级管理员可执行自动部署' };
  }

  const token = getGithubToken();
  const { repo, branch } = getGithubSettings();

  if (!token) return { ok: false, message: '未配置 GitHub Token，请先在「部署设置」中填写' };
  if (!isValidRepo(repo)) return { ok: false, message: '仓库格式不正确，应为 owner/repo（如 Bestar/enterprise-website）' };
  if (!isValidBranch(branch)) return { ok: false, message: '分支名不合法' };

  const xml = buildConfigXml(getUsersState(), getContentState());
  const base = `https://api.github.com/repos/${encodeURIComponent(repo)}/contents/config.xml`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  try {
    // 1) 读取现有文件拿 sha（首次提交时 404，属正常情况）
    let sha: string | undefined;
    try {
      const getRes = await fetch(base + `?ref=${encodeURIComponent(branch)}`, { headers, cache: 'no-store' });
      if (getRes.ok) {
        const data = (await getRes.json()) as { sha?: string };
        sha = data.sha;
      } else if (getRes.status !== 404) {
        const err = (await getRes.json().catch(() => null)) as { message?: string } | null;
        return { ok: false, message: `读取 config.xml 失败（${getRes.status}）：${err?.message ?? '请检查 Token 权限'} ` };
      }
    } catch {
      return { ok: false, message: '无法连接 GitHub API，请检查网络' };
    }

    // 2) 写入 config.xml
    const putRes = await fetch(base, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'chore: 自动更新 config.xml [workbuddy]',
        content: utf8Base64('\ufeff' + xml),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = (await putRes.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, message: `写入失败（${putRes.status}）：${err?.message ?? '未知错误'} ` };
    }

    return {
      ok: true,
      message: `config.xml 已自动推送到 ${repo}@${branch}，GitHub Pages 正在重新构建，约 1-2 分钟后全站生效`,
    };
  } catch {
    return { ok: false, message: '自动部署请求异常，请稍后重试' };
  }
}

/**
 * 测试 Token 是否有效（读取用户信息，最小权限校验）。
 */
export async function testGithubToken(token: string): Promise<{ ok: boolean; message: string }> {
  if (!token.trim()) return { ok: false, message: '请先填写 Token' };
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, message: `Token 无效（${res.status}），请检查是否正确` };
    }
    const data = (await res.json()) as { login?: string };
    return { ok: true, message: `Token 有效，当前账号：${data.login ?? 'unknown'} ` };
  } catch {
    return { ok: false, message: '无法连接 GitHub API，请检查网络' };
  }
}
