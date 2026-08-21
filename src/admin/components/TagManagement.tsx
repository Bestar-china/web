import { useState } from 'react';
import { useContent } from '../contexts/ContentContext';

const TAG_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#06b6d4',
];

export function TagManagement() {
  const { content, addTag, deleteTag } = useContent();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAdd = () => {
    if (!name.trim()) {
      showToast('请输入标签名称');
      return;
    }
    addTag(name.trim(), color);
    setName('');
    setColor(TAG_COLORS[0]);
    setShowForm(false);
    showToast('标签添加成功');
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定删除标签 "${name}" 吗？`)) {
      deleteTag(id);
      showToast('标签已删除');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🏷️ 标签管理</h1>
        <p>管理网站显示的标签</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>标签列表 ({content.tags.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)} style={{ width: 'auto' }}>
            {showForm ? '收起' : '➕ 添加标签'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '24px', padding: '24px', background: '#f9fafb', borderRadius: 'var(--radius-sm)' }}>
            <div className="form-group">
              <label>标签名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：创新、专业、高效"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>标签颜色</label>
              <div className="color-picker-grid">
                {TAG_COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={handleAdd} style={{ width: 'auto' }}>添加</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)} style={{ width: 'auto' }}>取消</button>
            </div>
          </div>
        )}

        {content.tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {content.tags.map((tag) => (
              <span
                key={tag.id}
                className="tag-chip"
                style={{ background: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
              >
                {tag.name}
                <span className="tag-delete" onClick={() => handleDelete(tag.id, tag.name)}>×</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <p>暂无标签，点击"添加标签"创建</p>
          </div>
        )}
      </div>
      {toast && <div className="toast success">✅ {toast}</div>}
    </div>
  );
}
