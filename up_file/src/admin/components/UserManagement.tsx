import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUsers, addUser, deleteUser, updateUser } from '../utils/storage';
import { sha256 } from '../utils/crypto';
import { User, UserRole, ROLE_LABELS, ROLE_BADGES } from '../types';

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; user: User }
  | null;

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(getUsers());
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'normal' as UserRole });
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const refresh = () => setUsers(getUsers());

  const openAdd = () => {
    setForm({ username: '', password: '', role: 'normal' });
    setModal({ type: 'add' });
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, password: '', role: u.role });
    setModal({ type: 'edit', user: u });
  };

  const handleSubmit = () => {
    if (!form.username.trim()) {
      showToast('请输入用户名', 'error');
      return;
    }
    if (modal?.type === 'add' && !form.password) {
      showToast('请输入密码', 'error');
      return;
    }

    if (modal?.type === 'add') {
      // 检查用户名是否已存在
      const existing = getUsers().find(
        (u) => u.username.toLowerCase() === form.username.toLowerCase()
      );
      if (existing) {
        showToast('用户名已存在', 'error');
        return;
      }
      const passwordHash = sha256(form.password);
      addUser(form.username, passwordHash, form.role);
      showToast('用户已创建，导出 config.xml 部署后生效');
    } else if (modal?.type === 'edit') {
      const updates: Partial<User> = { role: form.role };
      if (form.password) {
        updates.passwordHash = sha256(form.password);
      }
      // 不允许修改自己的角色
      if (modal.user.id === currentUser?.id) {
        updates.role = currentUser.role;
      }
      updateUser(modal.user.id, updates);
      showToast('用户已更新，导出 config.xml 部署后生效');
    }

    setModal(null);
    refresh();
  };

  const handleDelete = (u: User) => {
    if (u.id === currentUser?.id) {
      showToast('不能删除当前登录用户', 'error');
      return;
    }
    if (confirm(`确定删除用户 "${u.username}" 吗？`)) {
      deleteUser(u.id);
      showToast('用户已删除，导出 config.xml 部署后生效');
      refresh();
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>👥 用户管理</h1>
        <p>管理系统用户，设置角色和权限</p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>用户列表 ({users.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>
            ➕ 添加用户
          </button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>
                  {u.username}
                  {u.id === currentUser?.id && (
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--primary)' }}>(当前)</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${ROLE_BADGES[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {new Date(u.createdAt).toLocaleString('zh-CN')}
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>编辑</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser?.id}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>🔐 角色权限说明</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>角色</th>
              <th>可访问模块</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><span className="badge badge-visitor">访客</span></td><td>仪表盘（仅查看）</td></tr>
            <tr><td><span className="badge badge-normal">普通</span></td><td>仪表盘 + 文字内容 + 联系方式</td></tr>
            <tr><td><span className="badge badge-admin">管理员</span></td><td>仪表盘 + 文字 + 标签 + 背景 + 图片 + 联系方式</td></tr>
            <tr><td><span className="badge badge-super">超级管理员</span></td><td>全部功能（含用户管理）</td></tr>
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.type === 'add' ? '➕ 添加用户' : '✏️ 编辑用户'}</h2>
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="请输入用户名"
              />
            </div>
            <div className="form-group">
              <label>密码 {modal.type === 'edit' && '（留空则不修改）'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="请输入密码"
              />
            </div>
            <div className="form-group">
              <label>角色</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                disabled={modal.type === 'edit' && modal.user.id === currentUser?.id}
                style={{ width: '100%', padding: '12px 16px', border: '2px solid var(--border-color)', borderRadius: 'var(--radius-sm)', fontSize: '15px', outline: 'none' }}
              >
                <option value="visitor">访客</option>
                <option value="normal">普通</option>
                <option value="admin">管理员</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {modal.type === 'add' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}
    </div>
  );
}
