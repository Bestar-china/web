import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useContent, DeployStatus } from '../contexts/ContentContext';
import {
  getGithubToken,
  setGithubToken,
  clearGithubToken,
  getGithubSettings,
  saveGithubSettings,
  isValidRepo,
  isValidBranch,
  testGithubToken,
} from '../utils/github';

const DEPLOY_STATUS_META: Record<DeployStatus, { label: string; className: string }> = {
  idle: { label: '待命', className: 'deploy-status-idle' },
  saving: { label: '正在推送...', className: 'deploy-status-saving' },
  success: { label: '推送成功', className: 'deploy-status-success' },
  error: { label: '推送失败', className: 'deploy-status-error' },
};

export function DeploySettings() {
  const { user } = useAuth();
  const { deployStatus, lastDeployMsg, autoDeployEnabled, deployNow } = useContent();

  const saved = getGithubSettings();
  const [repo, setRepo] = useState(saved.repo);
  const [branch, setBranch] = useState(saved.branch);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaved, setTokenSaved] = useState<boolean>(() => !!getGithubToken());
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // ==================== 权限：仅超级管理员 ====================
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="permission-denied">
        <div className="lock-icon">🔒</div>
        <h2>权限不足</h2>
        <p>仅超级管理员可以查看和修改部署设置（API Key）</p>
      </div>
    );
  }

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    // 仓库校验
    if (!isValidRepo(repo)) {
      showToast('err', '仓库格式不正确，应为 owner/repo，如 Bestar/enterprise-website');
      return;
    }
    if (!isValidBranch(branch)) {
      showToast('err', '分支名不合法（不能含空格、..、控制字符）');
      return;
    }
    // Token：留空 = 保留已保存的；填写 = 覆盖
    if (tokenInput.trim()) {
      setGithubToken(tokenInput.trim());
      setTokenSaved(true);
      setTokenInput('');
    } else if (!getGithubToken()) {
      showToast('err', '请填写 GitHub Token（Personal Access Token）');
      return;
    }
    saveGithubSettings({ repo: repo.trim(), branch: branch.trim() });
    showToast('ok', '部署设置已保存。之后每次修改内容，将自动推送 config.xml 到 GitHub 并触发重新部署');
  };

  const handleTest = async () => {
    const token = tokenInput.trim() || getGithubToken();
    if (!token) {
      showToast('err', '请先填写 Token');
      return;
    }
    setTesting(true);
    const result = await testGithubToken(token);
    setTesting(false);
    if (result.ok) showToast('ok', result.message);
    else showToast('err', result.message);
  };

  const handleClearToken = () => {
    if (!confirm('确定清除已保存的 GitHub Token 吗？清除后自动部署将停止。')) return;
    clearGithubToken();
    setTokenSaved(false);
    setTokenInput('');
    showToast('ok', 'Token 已清除，自动部署已停止');
  };

  const statusMeta = DEPLOY_STATUS_META[deployStatus];

  return (
    <div>
      <div className="page-header">
        <h1>🚀 部署设置（GitHub 自动写入）</h1>
        <p>配置后，后台修改内容将自动写入 config.xml 并推送到 GitHub，无需手动导出上传</p>
      </div>

      {toast && <div className={`toast ${toast.type === 'ok' ? 'success' : 'error'}`}>{toast.msg}</div>}

      {/* 安全说明 */}
      <div className="card" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>🔐 安全提示（仅超级管理员可见）</h3>
        <ul className="security-tips">
          <li>API Key 只保存在<strong>当前浏览器会话</strong>（sessionStorage），关闭浏览器自动清除，<strong>绝不写入 config.xml</strong>，访客无法获取。</li>
          <li>API Key 只建议勾选 <strong>repo / contents</strong> 权限，最小授权原则。</li>
          <li>GitHub Token 的生成位置：GitHub → Settings → Developer settings → Personal access tokens → Generate new token（勾选 repo 权限）。</li>
        </ul>
      </div>

      {/* 自动部署状态 */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '12px' }}>📡 自动部署状态</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className={`deploy-status-badge ${statusMeta.className}`}>{statusMeta.label}</span>
          {autoDeployEnabled ? (
            <span className="deploy-status-enabled">已开启：内容修改后约 3 秒自动推送</span>
          ) : (
            <span className="deploy-status-disabled">未开启：请先填写 Token 和仓库地址</span>
          )}
        </div>
        {lastDeployMsg && (
          <p className="form-hint" style={{ marginTop: '10px', color: deployStatus === 'error' ? '#dc2626' : '#374151' }}>
            {lastDeployMsg}
          </p>
        )}
        {autoDeployEnabled && (
          <div style={{ marginTop: '12px' }}>
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              onClick={() => deployNow()}
              disabled={deployStatus === 'saving'}
            >
              {deployStatus === 'saving' ? '⏳ 正在推送...' : '⚡ 立即推送一次'}
            </button>
          </div>
        )}
      </div>

      {/* 配置表单 */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>⚙️ GitHub 配置</h3>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>仓库地址（owner/repo）*</label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="Bestar/enterprise-website"
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>分支 *</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>
        </div>

        <div className="form-group">
          <label>GitHub API Key（Token）</label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={tokenSaved ? '已保存（••••••••），留空则保留原值；填入新值可覆盖' : '粘贴 Personal Access Token（ghp_...）'}
            autoComplete="off"
          />
          <p className="form-hint">
            {tokenSaved ? '✅ 当前会话已保存 Token（仅本浏览器可见，关闭后自动清除）' : '⚠️ 尚未保存 Token'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={handleSave} style={{ width: 'auto' }}>
            💾 保存配置
          </button>
          <button className="btn btn-secondary" onClick={handleTest} style={{ width: 'auto' }} disabled={testing}>
            {testing ? '⏳ 测试中...' : '🔌 测试 Token'}
          </button>
          {tokenSaved && (
            <button className="btn btn-danger" onClick={handleClearToken} style={{ width: 'auto' }}>
              🗑️ 清除 Token（停止自动部署）
            </button>
          )}
        </div>
      </div>

      {/* 工作原理 */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>💡 工作原理</h3>
        <p className="form-hint" style={{ lineHeight: 1.8 }}>
          1. 静态托管（GitHub Pages）下，浏览器无法直接修改服务器文件；<br />
          2. 本功能通过 GitHub Contents API 把最新 config.xml 自动写回仓库；<br />
          3. 推送成功后 GitHub Pages 自动重新构建，约 1-2 分钟全站生效；<br />
          4. 访客主站每 30 秒自动检测新配置，部署完成后无需刷新即可看到新内容。
        </p>
      </div>
    </div>
  );
}
