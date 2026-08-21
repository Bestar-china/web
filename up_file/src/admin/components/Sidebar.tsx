import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, Permission, UserRole } from '../types';

interface SidebarProps {
  activePage: Permission;
  onPageChange: (page: Permission) => void;
}

interface NavItem {
  key: Permission;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: '📊' },
  { key: 'text', label: '文字内容', icon: '📝' },
  { key: 'tags', label: '标签管理', icon: '🏷️' },
  { key: 'background', label: '背景设置', icon: '🎨' },
  { key: 'images', label: '图片管理', icon: '🖼️' },
  { key: 'contacts', label: '联系方式', icon: '📇' },
  { key: 'nav', label: '导航菜单', icon: '🧭' },
  { key: 'users', label: '用户管理', icon: '👥' },
  { key: 'deploy', label: '部署设置', icon: '🚀' },
];

export function Sidebar({ activePage, onPageChange }: SidebarProps) {
  const { user, logout, hasPermission } = useAuth();

  if (!user) return null;

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>⚙️ 管理后台</h2>
        <p>Enterprise Admin Panel</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          if (!hasPermission(item.key)) return null;
          return (
            <div
              key={item.key}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => onPageChange(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
        })}
        {/* 独立密钥管理页面入口（仅超级管理员） */}
        {hasPermission('deploy') && (
          <a
            className="nav-item nav-item-external"
            href="api_manage.html"
            title="打开独立页面：API 密钥管理（RSA/AES 加密存储）"
          >
            <span className="nav-icon">🔑</span>
            <span>API 密钥管理</span>
            <span className="nav-external-badge">独立页</span>
          </a>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">{initial}</div>
          <div className="user-info-text">
            <div className="username">{user.username}</div>
            <div className="role">{ROLE_LABELS[user.role as UserRole]}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout}>
          🚪 退出登录
        </button>
      </div>
    </aside>
  );
}
