import { useState } from 'react';
import { useContent } from '../contexts/ContentContext';
import { NavItem, HOME_NAV_ID } from '../types';

// 固定区块锚点（主站已内置）
const FIXED_ANCHORS = [
  { label: '首页', href: '#hero' },
  { label: '核心服务', href: '#features' },
  { label: '图库', href: '#gallery' },
  { label: '关于我们', href: '#about' },
  { label: '联系我们', href: '#contact' },
];

type NavType = 'anchor' | 'page' | 'link';

function detectType(item: NavItem): NavType {
  if (item.page) return 'page';
  if (item.href.startsWith('http')) return 'link';
  return 'anchor';
}

interface EditForm {
  label: string;
  type: NavType;
  anchor: string;
  link: string;
  pageTitle: string;
  pageContent: string;
}

export function NavManagement() {
  const { content, updateSiteTitle, addNavItem, updateNavItem, deleteNavItem, moveNavItem } = useContent();
  const [siteTitle, setSiteTitle] = useState(content.siteTitle);
  const [titleDirty, setTitleDirty] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const emptyForm = (): EditForm => ({
    label: '',
    type: 'page',
    anchor: '#hero',
    link: '',
    pageTitle: '',
    pageContent: '',
  });

  const [addForm, setAddForm] = useState<EditForm>(emptyForm());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleTitleSave = () => {
    if (!siteTitle.trim()) {
      showToast('网站标题不能为空');
      return;
    }
    updateSiteTitle(siteTitle);
    setTitleDirty(false);
    showToast('网站标题已保存，导出 config.xml 部署后生效');
  };

  const buildHref = (form: EditForm, id: string): string => {
    if (form.type === 'page') return `#page-${id}`;
    if (form.type === 'link') return form.link.trim();
    return form.anchor;
  };

  const handleAdd = () => {
    const label = addForm.label.trim();
    if (!label) {
      showToast('请填写菜单名称');
      return;
    }
    if (addForm.type === 'link' && !/^https?:\/\//.test(addForm.link.trim())) {
      showToast('外链需以 http:// 或 https:// 开头');
      return;
    }
    const id = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addNavItem({
      label,
      href: buildHref(addForm, id),
      enabled: true,
      page: addForm.type === 'page' || undefined,
      pageTitle: addForm.type === 'page' ? addForm.pageTitle.trim() || label : undefined,
      pageContent: addForm.type === 'page' ? addForm.pageContent : undefined,
    });
    setShowAdd(false);
    setAddForm(emptyForm());
    showToast('菜单已添加，导出 config.xml 部署后生效');
  };

  const editFormOf = (item: NavItem): EditForm => {
    const type = detectType(item);
    return {
      label: item.label,
      type,
      anchor: FIXED_ANCHORS.some((a) => a.href === item.href) ? item.href : '#hero',
      link: type === 'link' ? item.href : '',
      pageTitle: item.pageTitle || item.label,
      pageContent: item.pageContent || '',
    };
  };

  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const startEdit = (item: NavItem) => {
    setEditingId(item.id);
    setEditForm(editFormOf(item));
  };

  const handleEditSave = () => {
    if (!editingId || !editForm) return;
    const label = editForm.label.trim();
    if (!label) {
      showToast('菜单名称不能为空');
      return;
    }
    if (editForm.type === 'link' && !/^https?:\/\//.test(editForm.link.trim())) {
      showToast('外链需以 http:// 或 https:// 开头');
      return;
    }
    updateNavItem(editingId, {
      label,
      href: buildHref(editForm, editingId),
      page: editForm.type === 'page' || undefined,
      pageTitle: editForm.type === 'page' ? editForm.pageTitle.trim() || label : undefined,
      pageContent: editForm.type === 'page' ? editForm.pageContent : undefined,
    });
    setEditingId(null);
    setEditForm(null);
    showToast('菜单已更新，导出 config.xml 部署后生效');
  };

  const handleDelete = (item: NavItem) => {
    if (item.id === HOME_NAV_ID) return;
    if (confirm(`确定删除菜单「${item.label}」吗？`)) {
      deleteNavItem(item.id);
      showToast('菜单已删除，导出 config.xml 部署后生效');
    }
  };

  const items = content.navItems;
  const homeItem = items.find((n) => n.id === HOME_NAV_ID);
  const restItems = items.filter((n) => n.id !== HOME_NAV_ID);

  return (
    <div>
      <div className="page-header">
        <h1>🧭 导航菜单管理</h1>
        <p>自定义网站标题与右上角导航菜单，可随意增删页面</p>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* 网站标题 */}
      <div className="card">
        <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 700 }}>🔖 网站标题</h3>
        <p className="form-hint" style={{ marginBottom: '10px' }}>
          显示在浏览器标签页顶部（&lt;title&gt;），也是搜索引擎展示的网站名称
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={siteTitle}
            onChange={(e) => {
              setSiteTitle(e.target.value);
              setTitleDirty(true);
            }}
            placeholder="如：企业门户 - 创新科技"
            style={{ flex: 1, minWidth: '260px' }}
          />
          <button
            className="btn btn-primary"
            onClick={handleTitleSave}
            disabled={!titleDirty}
            style={{ width: 'auto' }}
          >
            💾 保存标题
          </button>
        </div>
        {titleDirty && (
          <p className="form-hint" style={{ color: '#d97706' }}>
            ⚠️ 有未保存的标题修改
          </p>
        )}
      </div>

      {/* 添加菜单 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>📑 导航菜单（{items.length} 项）</h3>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ width: 'auto' }}>
            {showAdd ? '✕ 取消' : '＋ 添加菜单'}
          </button>
        </div>

        {showAdd && (
          <div className="nav-edit-panel">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="nav-field-label">菜单名称 *</label>
                <input
                  type="text"
                  value={addForm.label}
                  onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                  placeholder="如：关于产品"
                />
              </div>
              <div>
                <label className="nav-field-label">菜单类型</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm({ ...addForm, type: e.target.value as NavType })}
                >
                  <option value="page">📄 自定义页面（站点内新增板块）</option>
                  <option value="anchor">🧷 跳转到已有板块</option>
                  <option value="link">🔗 外部链接</option>
                </select>
              </div>
            </div>

            {addForm.type === 'page' && (
              <>
                <div>
                  <label className="nav-field-label">页面标题</label>
                  <input
                    type="text"
                    value={addForm.pageTitle}
                    onChange={(e) => setAddForm({ ...addForm, pageTitle: e.target.value })}
                    placeholder="留空则用菜单名称"
                  />
                </div>
                <div>
                  <label className="nav-field-label">页面内容</label>
                  <textarea
                    value={addForm.pageContent}
                    onChange={(e) => setAddForm({ ...addForm, pageContent: e.target.value })}
                    placeholder="在这里填写这个页面的介绍文字..."
                    style={{ minHeight: '100px' }}
                  />
                </div>
              </>
            )}

            {addForm.type === 'anchor' && (
              <div>
                <label className="nav-field-label">跳转到</label>
                <select value={addForm.anchor} onChange={(e) => setAddForm({ ...addForm, anchor: e.target.value })}>
                  {FIXED_ANCHORS.map((a) => (
                    <option key={a.href} value={a.href}>
                      {a.label}（{a.href}）
                    </option>
                  ))}
                </select>
              </div>
            )}

            {addForm.type === 'link' && (
              <div>
                <label className="nav-field-label">外部链接地址</label>
                <input
                  type="text"
                  value={addForm.link}
                  onChange={(e) => setAddForm({ ...addForm, link: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-success" onClick={handleAdd} style={{ width: 'auto' }}>
                ✅ 确认添加
              </button>
            </div>
          </div>
        )}

        {/* 菜单列表 */}
        <div className="nav-list">
          {homeItem && (
            <div className="nav-list-item nav-list-item-home">
              <div className="nav-item-main">
                <span className="nav-item-drag">🏠</span>
                <div className="nav-item-info">
                  <div className="nav-item-name">
                    {homeItem.label}
                    <span className="nav-item-badge nav-item-badge-default">默认首页</span>
                  </div>
                  <div className="nav-item-href">{homeItem.href}</div>
                </div>
                <span className="nav-item-enabled">固定显示</span>
              </div>
            </div>
          )}

          {restItems.length === 0 && !homeItem && (
            <p className="form-hint" style={{ textAlign: 'center', padding: '20px 0' }}>
              还没有自定义菜单，点击上方「添加菜单」创建
            </p>
          )}

          {restItems.map((item, idx) => (
            <div key={item.id} className="nav-list-item">
              {editingId === item.id ? (
                <div className="nav-edit-panel">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="nav-field-label">菜单名称 *</label>
                      <input
                        type="text"
                        value={editForm?.label ?? ''}
                        onChange={(e) => setEditForm(editForm ? { ...editForm, label: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <label className="nav-field-label">菜单类型</label>
                      <select
                        value={editForm?.type ?? 'page'}
                        onChange={(e) => setEditForm(editForm ? { ...editForm, type: e.target.value as NavType } : null)}
                      >
                        <option value="page">📄 自定义页面（站点内新增板块）</option>
                        <option value="anchor">🧷 跳转到已有板块</option>
                        <option value="link">🔗 外部链接</option>
                      </select>
                    </div>
                  </div>

                  {editForm?.type === 'page' && (
                    <>
                      <div>
                        <label className="nav-field-label">页面标题</label>
                        <input
                          type="text"
                          value={editForm.pageTitle}
                          onChange={(e) => setEditForm({ ...editForm, pageTitle: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="nav-field-label">页面内容</label>
                        <textarea
                          value={editForm.pageContent}
                          onChange={(e) => setEditForm({ ...editForm, pageContent: e.target.value })}
                          style={{ minHeight: '100px' }}
                        />
                      </div>
                    </>
                  )}

                  {editForm?.type === 'anchor' && (
                    <div>
                      <label className="nav-field-label">跳转到</label>
                      <select
                        value={editForm.anchor}
                        onChange={(e) => setEditForm({ ...editForm, anchor: e.target.value })}
                      >
                        {FIXED_ANCHORS.map((a) => (
                          <option key={a.href} value={a.href}>
                            {a.label}（{a.href}）
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editForm?.type === 'link' && (
                    <div>
                      <label className="nav-field-label">外部链接地址</label>
                      <input
                        type="text"
                        value={editForm.link}
                        onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-success" onClick={handleEditSave} style={{ width: 'auto' }}>
                      ✅ 保存
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                      style={{ width: 'auto' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="nav-item-main">
                    <span className="nav-item-drag">☰</span>
                    <div className="nav-item-info">
                      <div className="nav-item-name">
                        {item.label}
                        {item.page && (
                          <span className="nav-item-badge nav-item-badge-page">自定义页面</span>
                        )}
                        {!item.page && !item.href.startsWith('http') && (
                          <span className="nav-item-badge nav-item-badge-anchor">锚点</span>
                        )}
                        {item.href.startsWith('http') && (
                          <span className="nav-item-badge nav-item-badge-link">外链</span>
                        )}
                      </div>
                      <div className="nav-item-href">{item.href}</div>
                    </div>
                    <label className="switch" title="是否在主站导航显示">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => {
                          updateNavItem(item.id, { enabled: e.target.checked });
                          showToast('显示状态已更新，导出 config.xml 部署后生效');
                        }}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div className="nav-item-actions">
                    <button
                      className="nav-action-btn"
                      title="上移"
                      onClick={() => moveNavItem(item.id, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="nav-action-btn"
                      title="下移"
                      onClick={() => moveNavItem(item.id, 1)}
                      disabled={idx === restItems.length - 1}
                    >
                      ↓
                    </button>
                    <button className="nav-action-btn" title="编辑" onClick={() => startEdit(item)}>
                      ✏️
                    </button>
                    <button className="nav-action-btn nav-action-danger" title="删除" onClick={() => handleDelete(item)}>
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <p className="form-hint" style={{ marginTop: '12px' }}>
          💡 提示：菜单顺序即主站右上角显示顺序；「自定义页面」会在主站自动生成一个新板块，正文支持多行文字。
        </p>
      </div>
    </div>
  );
}
