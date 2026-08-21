// ==================== 用户角色 ====================
export type UserRole = 'visitor' | 'normal' | 'admin' | 'super_admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  visitor: '访客',
  normal: '普通',
  admin: '管理员',
  super_admin: '超级管理员',
};

export const ROLE_BADGES: Record<UserRole, string> = {
  visitor: 'badge-visitor',
  normal: 'badge-normal',
  admin: 'badge-admin',
  super_admin: 'badge-super',
};

// ==================== 权限定义 ====================
export type Permission =
  | 'dashboard'
  | 'text'
  | 'tags'
  | 'background'
  | 'images'
  | 'contacts'
  | 'nav'
  | 'users'
  | 'deploy';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  visitor: ['dashboard'],
  normal: ['dashboard', 'text', 'contacts', 'nav'],
  admin: ['dashboard', 'text', 'tags', 'background', 'images', 'contacts', 'nav'],
  super_admin: ['dashboard', 'text', 'tags', 'background', 'images', 'contacts', 'nav', 'users', 'deploy'],
};

// ==================== 用户 ====================
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

// ==================== 标签 ====================
export interface Tag {
  id: string;
  name: string;
  color: string;
}

// ==================== 图片 ====================
export interface SiteImage {
  id: string;
  name: string;
  dataUrl: string;
}

// ==================== 文字内容 ====================
export interface TextContent {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  featuresTitle: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  footerText: string;
  navLogo: string;
}

// ==================== 背景配置 ====================
export type BackgroundType = 'color' | 'gradient' | 'image';

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  gradient: string;
  imageDataUrl: string;
}

// ==================== 联系方式 ====================
export type ContactType =
  | 'email' | 'phone' | 'wechat' | 'qq' | 'github' | 'weibo' | 'douyin'
  | 'xiaohongshu' | 'twitter' | 'linkedin' | 'facebook' | 'instagram'
  | 'telegram' | 'whatsapp' | 'website' | 'address';

export interface ContactInfo {
  id: string;
  type: ContactType;
  value: string;
  label?: string;
  link?: string;
  enabled: boolean;
}

export interface ContactMeta {
  label: string;
  icon: string;
  placeholder: string;
  linkPrefix?: string;
  hint?: string;
}

export const CONTACT_TYPE_META: Record<ContactType, ContactMeta> = {
  email:       { label: '邮箱',     icon: '✉️', placeholder: 'example@company.com',        linkPrefix: 'mailto:', hint: '填写邮箱地址，点击可直接发邮件' },
  phone:       { label: '电话',     icon: '📞', placeholder: '+86 138-0000-0000',          linkPrefix: 'tel:',   hint: '填写手机号或座机号，点击可直接拨号' },
  wechat:      { label: '微信',     icon: '💬', placeholder: '微信号或手机号',              hint: '填写微信号；可把 link 留空' },
  qq:          { label: 'QQ',       icon: '🐧', placeholder: 'QQ 号码',                    linkPrefix: 'https://wpa.qq.com/msgrd?v=3&uin=', hint: '填写 QQ 号，点击可发起临时会话' },
  github:      { label: 'GitHub',   icon: '🐙', placeholder: 'GitHub 用户名',              linkPrefix: 'https://github.com/', hint: '填写用户名，自动生成主页链接' },
  weibo:       { label: '微博',     icon: '📱', placeholder: '微博用户名或主页链接',        linkPrefix: 'https://weibo.com/', hint: '填写用户名或完整主页链接' },
  douyin:      { label: '抖音',     icon: '🎵', placeholder: '抖音号或主页链接',            hint: '填写抖音号，link 填主页链接（可选）' },
  xiaohongshu: { label: '小红书',   icon: '📕', placeholder: '小红书号或主页链接',          hint: '填写小红书号，link 填主页链接（可选）' },
  twitter:     { label: 'Twitter/X', icon: '🐦', placeholder: '用户名',                     linkPrefix: 'https://twitter.com/', hint: '填写用户名，自动生成主页链接' },
  linkedin:    { label: 'LinkedIn', icon: '💼', placeholder: '个人主页完整链接',            hint: '粘贴完整的 LinkedIn 主页链接' },
  facebook:    { label: 'Facebook', icon: '👤', placeholder: '主页完整链接',                hint: '粘贴完整的 Facebook 主页链接' },
  instagram:   { label: 'Instagram',icon: '📸', placeholder: '用户名',                      linkPrefix: 'https://instagram.com/', hint: '填写用户名，自动生成主页链接' },
  telegram:    { label: 'Telegram', icon: '✈️', placeholder: '用户名或链接',                linkPrefix: 'https://t.me/', hint: '填写用户名，自动生成会话链接' },
  whatsapp:    { label: 'WhatsApp', icon: '🟢', placeholder: '+86 手机号',                  linkPrefix: 'https://wa.me/', hint: '填写含国家区号的手机号' },
  website:     { label: '网站',     icon: '🌐', placeholder: 'https://your-website.com',    hint: '填写完整网址，点击可直接访问' },
  address:     { label: '地址',     icon: '📍', placeholder: '公司或联系地址',              hint: '填写联系地址（不生成链接）' },
};

export const CONTACT_TYPE_LIST = Object.keys(CONTACT_TYPE_META) as ContactType[];

export const DEFAULT_CONTACTS: ContactInfo[] = [
  { id: 'contact-email', type: 'email', value: 'contact@company.com', enabled: true },
  { id: 'contact-phone', type: 'phone', value: '+86 138-0000-0000', enabled: true },
  { id: 'contact-address', type: 'address', value: '北京市朝阳区示例路 88 号', enabled: true },
];

// ==================== 导航菜单 ====================
export interface NavItem {
  id: string;
  label: string;
  /** 跳转目标：#锚点（页内区块）或 http(s) 外链 */
  href: string;
  enabled: boolean;
  /** 是否为自定义页面区块（主站需要渲染对应 section） */
  page?: boolean;
  /** 自定义页面区块标题（缺省用 label） */
  pageTitle?: string;
  /** 自定义页面区块正文 */
  pageContent?: string;
}

export const HOME_NAV_ID = 'nav-home';

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: HOME_NAV_ID, label: '首页', href: '#hero', enabled: true },
  { id: 'nav-features', label: '服务', href: '#features', enabled: true },
  { id: 'nav-gallery', label: '图库', href: '#gallery', enabled: true },
  { id: 'nav-about', label: '关于', href: '#about', enabled: true },
  { id: 'nav-contact', label: '联系', href: '#contact', enabled: true },
];

export const DEFAULT_SITE_TITLE = '企业门户 - 创新科技';

// ==================== GitHub 自动部署设置 ====================
// 注意：API Token 属于敏感凭证，永不进入 config.xml / 任何共享文件，
// 只保存在当前浏览器会话的 sessionStorage 中（关闭浏览器自动清除）。
export interface GitHubSettings {
  /** 仓库，格式 owner/repo，如 Bestar/enterprise-website */
  repo: string;
  /** 分支，默认 main */
  branch: string;
}

export const DEFAULT_GITHUB_SETTINGS: GitHubSettings = {
  repo: '',
  branch: 'main',
};

// ==================== 登录安全策略（仅超级管理员可配置） ====================
// 写入 config.xml 的 <security> 节点（明文，非敏感信息），
// 登录页（admin.html）与 api_manage.html 共享同一份配置。
export interface SecuritySettings {
  /** 连续失败多少次后锁定，范围 1-100，默认 5 */
  maxFails: number;
  /** 锁定时长（毫秒），范围 1000-86400000（1 秒-24 小时），默认 30 秒 */
  lockMs: number;
}

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  maxFails: 5,
  lockMs: 30_000,
};

// ==================== 站点内容 ====================
export interface SiteContent {
  siteTitle: string;
  navItems: NavItem[];
  tags: Tag[];
  background: BackgroundConfig;
  images: SiteImage[];
  text: TextContent;
  contacts: ContactInfo[];
}

// ==================== 默认数据 ====================
export const DEFAULT_TEXT: TextContent = {
  navLogo: '🏢 企业门户',
  heroTitle: '创新科技 · 筑梦未来',
  heroSubtitle: '专业的企业级解决方案提供商，致力于为您打造卓越的数字化体验',
  aboutTitle: '关于我们',
  aboutText: '我们是一家专注于技术创新的企业，致力于为客户提供高质量的产品和服务。凭借多年的行业经验和专业的技术团队，我们帮助企业在数字化转型的浪潮中稳步前行。',
  featuresTitle: '核心服务',
  feature1Title: '智能解决方案',
  feature1Desc: '基于先进技术架构，提供智能化的业务解决方案，助力企业高效运营。',
  feature2Title: '专业技术支持',
  feature2Desc: '经验丰富的技术团队，7×24小时全天候支持，确保您的业务稳定运行。',
  feature3Title: '安全可靠',
  feature3Desc: '采用企业级安全标准，全面保护您的数据安全与隐私，让您无后顾之忧。',
  footerText: '© 2026 企业门户. 保留所有权利.',
};

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'gradient',
  color: '#4f46e5',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  imageDataUrl: '',
};

export const DEFAULT_TAGS: Tag[] = [
  { id: 'tag-1', name: '创新', color: '#4f46e5' },
  { id: 'tag-2', name: '专业', color: '#10b981' },
  { id: 'tag-3', name: '高效', color: '#f59e0b' },
  { id: 'tag-4', name: '安全', color: '#ef4444' },
];

export const DEFAULT_CONTENT: SiteContent = {
  siteTitle: DEFAULT_SITE_TITLE,
  navItems: DEFAULT_NAV_ITEMS,
  tags: DEFAULT_TAGS,
  background: DEFAULT_BACKGROUND,
  images: [],
  text: DEFAULT_TEXT,
  contacts: DEFAULT_CONTACTS,
};

// SHA256 hash of "Mia_210201"
export const DEFAULT_PASSWORD_HASH = '5cdb2ae09fb5dd26af2fa3295bbf845cbd995b03543aea6ccfc602e84eb4826a';

export const DEFAULT_USER: User = {
  id: 'user-default',
  username: 'Bestar',
  passwordHash: DEFAULT_PASSWORD_HASH,
  role: 'super_admin',
  createdAt: new Date().toISOString(),
};
