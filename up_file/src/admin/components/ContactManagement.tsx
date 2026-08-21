import { useState } from 'react';
import { useContent } from '../contexts/ContentContext';
import {
  ContactType,
  CONTACT_TYPE_META,
  CONTACT_TYPE_LIST,
  ContactInfo,
} from '../types';
import { sanitizeHref } from '../utils/security';

export function ContactManagement() {
  const { content, addContact, updateContact, deleteContact } = useContent();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ContactType>('email');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [link, setLink] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleTypeChange = (newType: ContactType) => {
    setType(newType);
    // 根据类型自动填充 link 提示（linkPrefix）
    const meta = CONTACT_TYPE_META[newType];
    if (meta.linkPrefix) {
      setLink(meta.linkPrefix + value);
    }
  };

  const handleSubmit = () => {
    if (!value.trim()) {
      showToast('⚠️ 请填写联系方式内容');
      return;
    }
    // 安全净化：仅允许 http(s)/mailto/tel/# 等安全协议，阻断 javascript: 等注入
    const safeLink = link.trim() ? sanitizeHref(link) : '';
    if (link.trim() && safeLink === '#') {
      showToast('⚠️ 链接地址含不安全协议，已自动改为锚点，请使用 http(s) 开头');
    }
    addContact(type, value, label, safeLink, enabled);
    setValue('');
    setLabel('');
    setLink('');
    setEnabled(true);
    setShowForm(false);
    showToast('✅ 联系方式已添加');
  };

  const usedTypes = content.contacts.map((c) => c.type);
  const availableTypes = CONTACT_TYPE_LIST.filter((t) => !usedTypes.includes(t));

  return (
    <div>
      <div className="page-header">
        <h1>📇 联系方式</h1>
        <p>管理展示在主页的联系方式 —— 支持 16 种类型，自由选择要展示哪些</p>
      </div>

      {toast && <div className="toast success">{toast}</div>}

      {/* 添加按钮 */}
      {!showForm && (
        <button className="btn btn-primary" style={{ marginBottom: '20px', width: 'auto' }} onClick={() => setShowForm(true)}>
          ➕ 添加联系方式
        </button>
      )}

      {/* 添加表单 */}
      {showForm && (
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>📝 新增联系方式</h3>
          <div className="form-group">
            <label>联系方式类型（共 {CONTACT_TYPE_LIST.length} 种可选）</label>
            <div className="contact-type-grid">
              {CONTACT_TYPE_LIST.map((t) => {
                const meta = CONTACT_TYPE_META[t];
                const isUsed = usedTypes.includes(t);
                return (
                  <div
                    key={t}
                    className={`contact-type-option ${type === t ? 'active' : ''} ${isUsed ? 'used' : ''}`}
                    onClick={() => !isUsed && handleTypeChange(t)}
                    title={isUsed ? '该类型已添加过' : meta.hint}
                  >
                    <span className="contact-type-icon">{meta.icon}</span>
                    <span>{meta.label}</span>
                    {isUsed && <span className="contact-type-used">已添加</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>内容 *</label>
              <input
                type="text"
                value={value}
                placeholder={CONTACT_TYPE_META[type].placeholder}
                onChange={(e) => {
                  setValue(e.target.value);
                  const meta = CONTACT_TYPE_META[type];
                  if (meta.linkPrefix && !link) {
                    setLink(meta.linkPrefix + e.target.value);
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label>自定义标签（可选）</label>
              <input
                type="text"
                value={label}
                placeholder={CONTACT_TYPE_META[type].label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>跳转链接（可选）</label>
            <input
              type="text"
              value={link}
              placeholder="留空则自动生成，或粘贴完整链接"
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="form-hint">{CONTACT_TYPE_META[type].hint}</p>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 'auto' }}
              />
              在主页显示该联系方式
            </label>
          </div>

          <div className="modal-actions">
            <button className="btn btn-success" onClick={handleSubmit}>✅ 保存</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 联系方式列表 */}
      {content.contacts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📇</div>
          <p>还没有联系方式，点击上方按钮添加一个吧</p>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>
            已添加的联系方式（{content.contacts.length} 个）
            <span style={{ fontSize: '13px', color: 'var(--text-light)', marginLeft: '10px', fontWeight: 400 }}>
              勾选状态 = 是否在主页显示
            </span>
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>内容</th>
                <th>链接</th>
                <th>显示</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {content.contacts.map((contact) => {
                const meta = CONTACT_TYPE_META[contact.type];
                return (
                  <tr key={contact.id}>
                    <td>
                      <span className="badge" style={{ background: '#f3f4f6', color: 'var(--text-primary)' }}>
                        {meta.icon} {contact.label || meta.label}
                      </span>
                    </td>
                    <td>{contact.value}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {contact.link ? (
                        <a href={contact.link} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                          {contact.link.length > 30 ? contact.link.slice(0, 30) + '…' : contact.link}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={contact.enabled}
                          onChange={(e) => updateContact(contact.id, { enabled: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            deleteContact(contact.id);
                            showToast('🗑️ 已删除');
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 类型概览 */}
      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>📚 全部支持的类型（{CONTACT_TYPE_LIST.length} 种）</h3>
        <div className="contact-overview-grid">
          {CONTACT_TYPE_LIST.map((t) => {
            const meta = CONTACT_TYPE_META[t];
            const used = usedTypes.includes(t);
            return (
              <div key={t} className={`contact-overview-item ${used ? 'used' : ''}`}>
                <span className="contact-type-icon">{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="contact-overview-status">{used ? '已添加 ✓' : '未添加'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
