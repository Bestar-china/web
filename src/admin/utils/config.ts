import {
  User,
  SiteContent,
  ContactType,
  SecuritySettings,
  CONTACT_TYPE_LIST,
  DEFAULT_CONTENT,
  DEFAULT_SECURITY_SETTINGS,
} from '../types';
import {
  getUsersState,
  getContentState,
  getSecurityState,
  loadStateFromXml,
  fallbackState,
  isStateDirty,
  isStateInitialized,
  markStateClean,
} from './state';
import { sanitizeHref, sanitizeColor, sanitizeGradient } from './security';

// ==================== 站点根路径 ====================
// admin.html / api_manage.html 位于 admin/ 子目录，直接 fetch('config.xml')
// 会被解析为 admin/config.xml（404）。统一用此函数定位站点根目录资源。
// 兼容 GitHub Pages 子路径部署（user.github.io/repo/admin/xxx.html → ../config.xml）。
export function rootUrl(rel: string): string {
  const path = window.location.pathname;
  const inSubdir = /\/admin\/[^/]*\.html/i.test(path) || /\/admin\/[^/]+$/.test(path);
  return (inSubdir ? '../' : '') + rel;
}

// ==================== XML 转义工具 ====================
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXmlAttr(text: string): string {
  return escapeXml(text).replace(/"/g, '&quot;');
}

// ==================== 生成 XML ====================
export function buildConfigXml(users: User[], content: SiteContent): string {
  const textXml = Object.entries(content.text)
    .map(([k, v]) => `    <${k}>${escapeXml(v)}</${k}>`)
    .join('\n');

  const usersXml = users
    .map(
      (u) =>
        `    <user id="${escapeXmlAttr(u.id)}" role="${escapeXmlAttr(u.role)}" createdAt="${escapeXmlAttr(u.createdAt)}">\n` +
        `      <username>${escapeXml(u.username)}</username>\n` +
        `      <passwordHash>${escapeXml(u.passwordHash)}</passwordHash>\n` +
        `    </user>`
    )
    .join('\n');

  const tagsXml = content.tags
    .map((t) => `    <tag id="${escapeXmlAttr(t.id)}" color="${escapeXmlAttr(sanitizeColor(t.color))}">${escapeXml(t.name)}</tag>`)
    .join('\n');

  const bg = content.background;
  const safeColor = sanitizeColor(bg.color);
  const safeGradient = sanitizeGradient(bg.gradient);
  const bgXml = `  <background type="${escapeXmlAttr(bg.type)}" color="${escapeXmlAttr(safeColor)}" gradient="${escapeXmlAttr(safeGradient)}"><![CDATA[${bg.imageDataUrl}]]></background>`;

  const imagesXml = content.images
    .map((img) => `    <image id="${escapeXmlAttr(img.id)}" name="${escapeXmlAttr(img.name)}"><![CDATA[${img.dataUrl}]]></image>`)
    .join('\n');

  const contactsXml = content.contacts
    .map((c) => {
      const safeLink = c.link ? sanitizeHref(c.link) : '';
      return `    <contact id="${escapeXmlAttr(c.id)}" type="${escapeXmlAttr(c.type)}" label="${escapeXmlAttr(c.label ?? '')}" link="${escapeXmlAttr(safeLink)}" enabled="${c.enabled ? 'true' : 'false'}">${escapeXml(c.value)}</contact>`;
    })
    .join('\n');

  const navXml = content.navItems
    .map((n) => {
      const safeHref = sanitizeHref(n.href);
      const attrs =
        `id="${escapeXmlAttr(n.id)}" label="${escapeXmlAttr(n.label)}" href="${escapeXmlAttr(safeHref)}" enabled="${n.enabled ? 'true' : 'false'}"` +
        (n.page ? ' page="true"' : '');
      const inner =
        n.page || n.pageTitle || n.pageContent
          ? `\n      <title>${escapeXml(n.pageTitle || n.label)}</title>\n      <content>${escapeXml(n.pageContent || '')}</content>\n    `
          : '';
      return `    <navItem ${attrs}>${inner}</navItem>`;
    })
    .join('\n');

  const security = getSecurityState();
  const securityXml = `  <security maxFails="${security.maxFails}" lockMs="${security.lockMs}" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<site-config version="1.0">
  <siteTitle>${escapeXml(content.siteTitle)}</siteTitle>
  <users>
${usersXml}
  </users>
  <text>
${textXml}
  </text>
  <tags>
${tagsXml}
  </tags>
${bgXml}
  <images>
${imagesXml}
  </images>
  <contacts>
${contactsXml}
  </contacts>
  <nav>
${navXml}
  </nav>
${securityXml}
</site-config>
`;
}

// ==================== 解析 XML ====================
function getChildText(el: Element, tagName: string): string {
  const child = el.getElementsByTagName(tagName)[0];
  return child ? child.textContent ?? '' : '';
}

export function parseConfigXml(xml: string): { users: User[]; content: SiteContent; security: SecuritySettings } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const parseError = doc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('XML 解析失败');
  }

  // ---- 用户 ----
  const users: User[] = [];
  const userNodes = doc.getElementsByTagName('user');
  for (let i = 0; i < userNodes.length; i++) {
    const el = userNodes[i];
    users.push({
      id: el.getAttribute('id') || `user-${i}`,
      username: getChildText(el, 'username'),
      passwordHash: getChildText(el, 'passwordHash'),
      role: (el.getAttribute('role') || 'normal') as User['role'],
      createdAt: el.getAttribute('createdAt') || new Date().toISOString(),
    });
  }

  // ---- 文字 ----
  const text = {} as SiteContent['text'];
  const textEl = doc.getElementsByTagName('text')[0];
  if (textEl) {
    for (const key of Object.keys(DEFAULT_CONTENT.text)) {
      const child = textEl.getElementsByTagName(key)[0];
      (text as unknown as Record<string, string>)[key] = child ? child.textContent ?? '' : '';
    }
  } else {
    Object.assign(text, DEFAULT_CONTENT.text);
  }

  // ---- 标签 ----
  const tags: SiteContent['tags'] = [];
  const tagNodes = doc.getElementsByTagName('tag');
  for (let i = 0; i < tagNodes.length; i++) {
    const el = tagNodes[i];
    tags.push({
      id: el.getAttribute('id') || `tag-${i}`,
      name: el.textContent ?? '',
      color: el.getAttribute('color') || '#4f46e5',
    });
  }

  // ---- 背景 ----
  const bgEl = doc.getElementsByTagName('background')[0];
  const background: SiteContent['background'] = bgEl
    ? {
        type: (bgEl.getAttribute('type') as SiteContent['background']['type']) || 'gradient',
        color: bgEl.getAttribute('color') || '',
        gradient: bgEl.getAttribute('gradient') || '',
        imageDataUrl: bgEl.textContent ?? '',
      }
    : DEFAULT_CONTENT.background;

  // ---- 图片 ----
  const images: SiteContent['images'] = [];
  const imgNodes = doc.getElementsByTagName('image');
  for (let i = 0; i < imgNodes.length; i++) {
    const el = imgNodes[i];
    images.push({
      id: el.getAttribute('id') || `img-${i}`,
      name: el.getAttribute('name') || '',
      dataUrl: el.textContent ?? '',
    });
  }

  // ---- 联系方式 ----
  const contacts: SiteContent['contacts'] = [];
  const contactNodes = doc.getElementsByTagName('contact');
  for (let i = 0; i < contactNodes.length; i++) {
    const el = contactNodes[i];
    const type = el.getAttribute('type');
    if (type && CONTACT_TYPE_LIST.includes(type as ContactType)) {
      contacts.push({
        id: el.getAttribute('id') || `contact-${i}`,
        type: type as ContactType,
        value: el.textContent ?? '',
        label: el.getAttribute('label') || undefined,
        link: el.getAttribute('link') || undefined,
        enabled: el.getAttribute('enabled') !== 'false',
      });
    }
  }

  // ---- 网站标题 ----
  const siteTitleEl = doc.getElementsByTagName('siteTitle')[0];
  const siteTitle = siteTitleEl?.textContent?.trim() || DEFAULT_CONTENT.siteTitle;

  // ---- 导航菜单 ----
  const navItems: SiteContent['navItems'] = [];
  const navNodes = doc.getElementsByTagName('navItem');
  for (let i = 0; i < navNodes.length; i++) {
    const el = navNodes[i];
    const id = el.getAttribute('id') || `nav-${i}`;
    const isPage = el.getAttribute('page') === 'true';
    navItems.push({
      id,
      label: el.getAttribute('label') || '',
      href: el.getAttribute('href') || '#',
      enabled: el.getAttribute('enabled') !== 'false',
      page: isPage || undefined,
      pageTitle: getChildText(el, 'title') || undefined,
      pageContent: getChildText(el, 'content') || undefined,
    });
  }
  // 旧版 config.xml 没有 nav 区块 → 用默认导航
  if (navItems.length === 0) {
    navItems.push(...DEFAULT_CONTENT.navItems);
  }

  // ---- 登录安全策略（仅超级管理员配置，解析失败用默认） ----
  let security: SecuritySettings = { ...DEFAULT_SECURITY_SETTINGS };
  const secEl = doc.getElementsByTagName('security')[0];
  if (secEl) {
    const maxFails = Number(secEl.getAttribute('maxFails') || 0);
    const lockMs = Number(secEl.getAttribute('lockMs') || 0);
    if (maxFails >= 1 && maxFails <= 100) security.maxFails = Math.floor(maxFails);
    if (lockMs >= 1000 && lockMs <= 86_400_000) security.lockMs = Math.floor(lockMs);
  }

  return {
    users,
    content: { siteTitle, navItems, tags, background, images, text, contacts },
    security,
  };
}

// ==================== 加载 / 导出 ====================
/**
 * 从站点根目录加载 config.xml（静态托管配置的唯一来源）。
 * 失败时（如 file:// 直接打开）回退到内置默认配置。
 */
export async function initConfig(): Promise<void> {
  try {
    const res = await fetch(rootUrl('config.xml'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parseConfigXml(xml);
    if (parsed.users.length > 0) {
      loadStateFromXml(parsed.users, parsed.content, parsed.security);
    } else {
      // 配置文件没有用户 → 用默认管理员兜底
      loadStateFromXml(getUsersState(), parsed.content, parsed.security);
    }
  } catch {
    // 回退默认配置（含默认超级管理员 Bestar）
    fallbackState();
  }
}

export function isConfigReady(): boolean {
  return isStateInitialized();
}

export function isConfigDirty(): boolean {
  return isStateDirty();
}

export function markConfigClean(): void {
  markStateClean();
}

/**
 * 导出最新配置为 config.xml 并下载。
 * 用户把文件放回站点根目录并重新部署后，所有访客可见新内容。
 */
export function exportConfigXml(): void {
  const xml = buildConfigXml(getUsersState(), getContentState());
  const blob = new Blob(['\ufeff' + xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.xml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  markStateClean();
}
