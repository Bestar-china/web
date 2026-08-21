import { useContent } from '../contexts/ContentContext';
import { useAuth } from '../contexts/AuthContext';
import { getUsers } from '../utils/storage';
import { ROLE_LABELS } from '../types';

export function Dashboard() {
  const { content } = useContent();
  const { user } = useAuth();

  const users = getUsers();
  const enabledContacts = content.contacts.filter((c) => c.enabled).length;
  const stats = [
    { label: '注册用户', value: users.length, icon: '👥', color: 'blue' },
    { label: '标签数量', value: content.tags.length, icon: '🏷️', color: 'green' },
    { label: '图片数量', value: content.images.length, icon: '🖼️', color: 'purple' },
    { label: '联系方式', value: `${enabledContacts}/${content.contacts.length}`, icon: '📇', color: 'orange' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>📊 仪表盘</h1>
        <p>欢迎回来，{user?.username}！当前角色：{user ? ROLE_LABELS[user.role] : ''}</p>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>📌 系统信息</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 20px', fontSize: '14px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>系统版本</span>
          <span style={{ fontWeight: 600 }}>v1.0.0</span>
          <span style={{ color: 'var(--text-secondary)' }}>加密方式</span>
          <span style={{ fontWeight: 600 }}>SHA-256</span>
          <span style={{ color: 'var(--text-secondary)' }}>数据存储</span>
          <span style={{ fontWeight: 600 }}>浏览器本地存储 (localStorage)</span>
          <span style={{ color: 'var(--text-secondary)' }}>技术栈</span>
          <span style={{ fontWeight: 600 }}>React + TypeScript + Vite</span>
          <span style={{ color: 'var(--text-secondary)' }}>默认管理员</span>
          <span style={{ fontWeight: 600 }}>Bestar (超级管理员)</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>🏷️ 当前标签</h3>
        {content.tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {content.tags.map((tag) => (
              <span
                key={tag.id}
                className="tag-chip"
                style={{ background: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '20px' }}>
            <p>暂无标签</p>
          </div>
        )}
      </div>
    </div>
  );
}
