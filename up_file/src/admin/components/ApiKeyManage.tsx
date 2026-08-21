import { useEffect, useState } from 'react';
import {
  SecuritySettings,
  DEFAULT_SECURITY_SETTINGS,
} from '../types';
import { getCurrentUser } from '../utils/storage';
import {
  getGithubToken,
  setGithubToken,
  clearGithubToken,
  getGithubSettings,
  saveGithubSettings,
  isValidRepo,
  isValidBranch,
  testGithubToken,
  getGithubFile,
  putGithubFile,
} from '../utils/github';
import { initConfig, parseConfigXml, buildConfigXml } from '../utils/config';
import {
  getUsersState,
  getContentState,
  getSecurityState,
  setSecurityState,
  loadStateFromXml,
} from '../utils/state';
import {
  KEY_PATHS,
  generateKeySystemFiles,
  encryptApiKey,
  decryptApiKey,
  isSecureContext,
} from '../utils/keychain';

type PageState = 'loading' | 'denied' | 'ready';
type BusyAction = '' | 'init' | 'saveKey' | 'decrypt' | 'test' | 'pushPolicy';

interface FileStatus {
  path: string;
  label: string;
  exists: boolean;
}

const FILE_META: { path: string; label: string }[] = [
  { path: KEY_PATHS.symmetricKey, label: '对称密钥 key.xml' },
  { path: KEY_PATHS.publicKey, label: 'RSA 公钥 public_key.yml' },
  { path: KEY_PATHS.privateKey, label: 'RSA 私钥 key_storage.yml' },
  { path: KEY_PATHS.apiKeyStorage, label: 'API Key 主存储' },
  { path: KEY_PATHS.key1, label: '拆分备份 key1.xml' },
  { path: KEY_PATHS.key2, label: '拆分备份 key2.xml' },
];

function downloadText(filename: string, content: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ApiKeyManage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [secure, setSecure] = useState(true);
  const [busy, setBusy] = useState<BusyAction>('');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // GitHub 账户表单
  const saved = getGithubSettings();
  const [username, setUsername] = useState('');
  const [repo, setRepo] = useState(saved.repo);
  const [branch, setBranch] = useState(saved.branch);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaved, setTokenSaved] = useState<boolean>(() => !!getGithubToken());

  // 密钥文件状态
  const [files, setFiles] = useState<FileStatus[]>(
    FILE_META.map((m) => ({ ...m, exists: false }))
  );

  // 解密结果
  const [storedKeyInfo, setStoredKeyInfo] = useState<{ has: boolean; method: string; masked: string }>({
    has: false,
    method: '',
    masked: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState('');

  // 锁定策略
  const [policy, setPolicy] = useState<SecuritySettings>({ ...DEFAULT_SECURITY_SETTINGS });
  const [policyUnit, setPolicyUnit] = useState<'sec' | 'min'>('sec');
  const [policyInput, setPolicyInput] = useState('30');

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 5000);
  };

  // ==================== 页面初始化 ====================
  useEffect(() => {
    (async () => {
      // 1) 登录态校验（sessionStorage 会话级，关闭浏览器自动登出）
      const current = getCurrentUser();
      if (!current || current.role !== 'super_admin') {
        setPageState('denied');
        return;
      }
      // 2) 安全上下文（Web Crypto 需要 https / localhost）
      setSecure(isSecureContext());
      // 3) 加载站点配置（config.xml → 内存，供锁定策略读取）
      try {
        await initConfig();
      } catch {
        // ignore
      }
      const sec = getSecurityState() || DEFAULT_SECURITY_SETTINGS;
      setPolicy({ ...sec });
      setPolicyUnit(sec.lockMs % 60_000 === 0 && sec.lockMs >= 60_000 ? 'min' : 'sec');
      setPolicyInput(sec.lockMs % 60_000 === 0 && sec.lockMs >= 60_000 ? String(sec.lockMs / 60_000) : String(Math.ceil(sec.lockMs / 1000)));
      // 4) 探测密钥文件状态（需已配置 Token/仓库）
      if (getGithubToken() && isValidRepo(getGithubSettings().repo)) {
        await refreshFileStatus();
      }
      setPageState('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== 探测密钥文件 ====================
  const refreshFileStatus = async () => {
    const results = await Promise.all(
      FILE_META.map(async (m) => {
        const res = await getGithubFile(m.path);
        return { ...m, exists: res.exists };
      })
    );
    setFiles(results);
    return results;
  };

  // ==================== 保存 GitHub 账户 ====================
  const handleSaveAccount = async () => {
    if (!isValidRepo(repo)) {
      showToast('err', '仓库格式不正确，应为 owner/repo，如 Bestar/enterprise-website');
      return;
    }
    if (!isValidBranch(branch)) {
      showToast('err', '分支名不合法（不能含空格、..、控制字符）');
      return;
    }
    if (tokenInput.trim()) {
      setGithubToken(tokenInput.trim());
      setTokenSaved(true);
      setTokenInput('');
    } else if (!getGithubToken()) {
      showToast('err', '请填写 GitHub Token（Personal Access Token）');
      return;
    }
    saveGithubSettings({ repo: repo.trim(), branch: branch.trim() });
    await refreshFileStatus();
    showToast('ok', 'GitHub 账户配置已保存，密钥文件状态已刷新');
  };

  const handleTestToken = async () => {
    const token = tokenInput.trim() || getGithubToken();
    if (!token) {
      showToast('err', '请先填写 Token');
      return;
    }
    setBusy('test');
    const result = await testGithubToken(token);
    setBusy('');
    if (result.ok) {
      showToast('ok', result.message);
      setUsername(result.message.includes('账号：') ? result.message.split('账号：')[1].trim() : username);
    } else {
      showToast('err', result.message);
    }
  };

  const handleClearToken = () => {
    if (!confirm('确定清除会话中的 GitHub Token 吗？清除后自动部署与密钥读写将停止。')) return;
    clearGithubToken();
    setTokenSaved(false);
    setTokenInput('');
    setDecryptedKey('');
    setStoredKeyInfo({ has: false, method: '', masked: '' });
    showToast('ok', 'Token 已清除（仅清除本浏览器会话，仓库中的加密文件不受影响）');
  };

  // ==================== 初始化密钥系统 ====================
  const handleInitKeySystem = async () => {
    if (!secure) {
      showToast('err', '当前环境不支持加密（需要 https 或 localhost），无法生成密钥');
      return;
    }
    if (!getGithubToken() || !isValidRepo(getGithubSettings().repo)) {
      showToast('err', '请先在上方保存 GitHub 账户配置（仓库 + Token）');
      return;
    }
    if (!confirm('将重新生成整套密钥（RSA 公私钥 + AES 对称密钥）并推送到仓库。\n重新生成后，旧的 API Key 加密文件将无法解密，需要重新加密保存。\n确定继续？')) return;
    setBusy('init');
    try {
      const generated = await generateKeySystemFiles();
      const paths = Object.keys(generated);
      for (const p of paths) {
        const res = await putGithubFile(p, generated[p], `chore: 初始化密钥系统 ${p} [workbuddy]`);
        if (!res.ok) {
          showToast('err', `初始化失败：${res.message}`);
          setBusy('');
          return;
        }
      }
      await refreshFileStatus();
      showToast('ok', '密钥系统初始化成功：RSA 公钥/私钥（AES 加密）+ 对称密钥已推送到仓库');
    } catch (e) {
      showToast('err', '初始化异常：' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  // ==================== 加密保存 API Key ====================
  const handleSaveApiKey = async () => {
    if (!secure) {
      showToast('err', '当前环境不支持加密（需要 https / localhost）');
      return;
    }
    const token = tokenInput.trim() || getGithubToken();
    if (!token) {
      showToast('err', '请先填写要加密保存的 GitHub API Key（Token）');
      return;
    }
    if (!isValidRepo(getGithubSettings().repo)) {
      showToast('err', '请先保存仓库配置');
      return;
    }
    setBusy('saveKey');
    try {
      // 1) 从仓库拉取密钥系统文件
      const filesMap: Record<string, string> = {};
      for (const p of [KEY_PATHS.symmetricKey, KEY_PATHS.publicKey, KEY_PATHS.privateKey]) {
        const res = await getGithubFile(p);
        if (!res.exists || !res.content) {
          showToast('err', '密钥系统尚未初始化，请先点「初始化密钥系统」');
          setBusy('');
          return;
        }
        filesMap[p] = res.content;
      }
      // 2) 加密
      const encrypted = await encryptApiKey(filesMap, token);
      // 3) 推送三个存储文件
      for (const p of Object.keys(encrypted)) {
        const res = await putGithubFile(p, encrypted[p], `chore: 加密保存 API Key ${p} [workbuddy]`);
        if (!res.ok) {
          showToast('err', `保存失败：${res.message}`);
          setBusy('');
          return;
        }
      }
      // 4) 本会话直接使用该 Token
      setGithubToken(token.trim());
      setTokenSaved(true);
      setTokenInput('');
      await refreshFileStatus();
      await handleDecrypt(false);
      showToast('ok', 'API Key 已加密保存：主存储（RSA）+ 拆分备份（key1/key2）均已推送');
    } catch (e) {
      showToast('err', '加密保存异常：' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  // ==================== 解密查看 API Key ====================
  const handleDecrypt = async (notify = true) => {
    if (!secure) {
      showToast('err', '当前环境不支持解密（需要 https / localhost）');
      return;
    }
    setBusy('decrypt');
    try {
      const filesMap: Record<string, string> = {};
      for (const p of [KEY_PATHS.symmetricKey, KEY_PATHS.privateKey, KEY_PATHS.apiKeyStorage, KEY_PATHS.key1, KEY_PATHS.key2]) {
        const res = await getGithubFile(p);
        if (res.exists && res.content) filesMap[p] = res.content;
      }
      const result = await decryptApiKey(filesMap);
      if (!result.ok) {
        showToast('err', result.error || '解密失败');
        setStoredKeyInfo({ has: false, method: '', masked: '' });
        setDecryptedKey('');
        setBusy('');
        return;
      }
      setDecryptedKey(result.apiKey);
      setShowKey(false);
      const methodLabel = result.method === 'rsa-main' ? 'RSA 主存储' : '拆分备份 key1+key2';
      setStoredKeyInfo({
        has: true,
        method: methodLabel,
        masked: result.apiKey.slice(0, 6) + '••••••••' + result.apiKey.slice(-4),
      });
      // 解密成功 → 本会话使用该 Token（供 config.xml 推送等）
      setGithubToken(result.apiKey);
      setTokenSaved(true);
      if (notify) showToast('ok', `解密成功（${methodLabel}），已通过交叉校验，本会话已启用该 Token`);
    } catch (e) {
      showToast('err', '解密异常：' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  // ==================== 锁定策略保存 ====================
  const handleSavePolicy = async () => {
    const maxFails = Math.floor(Number(policy.maxFails));
    const val = Math.floor(Number(policyInput));
    if (!(maxFails >= 1 && maxFails <= 100)) {
      showToast('err', '失败次数需在 1-100 之间');
      return;
    }
    const lockMs = policyUnit === 'min' ? val * 60_000 : val * 1000;
    if (!(lockMs >= 1000 && lockMs <= 86_400_000)) {
      showToast('err', '锁定时长需在 1 秒 - 24 小时之间');
      return;
    }
    if (!getGithubToken() || !isValidRepo(getGithubSettings().repo)) {
      showToast('err', '自动写入 config.xml 需要先保存 GitHub 账户配置');
      return;
    }
    setBusy('pushPolicy');
    try {
      // 1) 从仓库拉最新 config.xml 再改（避免覆盖他人修改）
      const res = await getGithubFile('config.xml');
      if (res.exists && res.content) {
        const parsed = parseConfigXml(res.content);
        // 应用新策略 + 最新用户/内容到内存，再生成完整 config.xml
        loadStateFromXml(parsed.users, parsed.content, { maxFails, lockMs });
      } else {
        setSecurityState({ maxFails, lockMs });
      }
      const xml = buildConfigXml(getUsersState(), getContentState());
      const put = await putGithubFile('config.xml', xml, 'chore: 更新登录锁定策略 [workbuddy]');
      if (!put.ok) {
        showToast('err', put.message);
      } else {
        setPolicy({ maxFails, lockMs });
        showToast('ok', `登录锁定策略已保存并部署：连续输错 ${maxFails} 次锁定 ${policyUnit === 'min' ? val + ' 分钟' : val + ' 秒'}`);
      }
    } catch (e) {
      showToast('err', '保存策略异常：' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy('');
  };

  // ==================== 导出备份 ====================
  const handleExportBackup = async () => {
    let count = 0;
    const missing: string[] = [];
    for (const m of FILE_META) {
      const res = await getGithubFile(m.path);
      if (res.exists && res.content) {
        downloadText(m.path.split('/').pop() || m.path, res.content);
        count++;
      } else {
        missing.push(m.path);
      }
    }
    showToast(
      missing.length ? 'err' : 'ok',
      missing.length
        ? `已导出 ${count} 个文件；以下文件不存在：${missing.join(', ')}`
        : `已导出全部 ${count} 个密钥/存储文件（请妥善离线保存备份）`
    );
  };

  // ==================== 渲染 ====================
  if (pageState === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>正在加载密钥系统...</p>
      </div>
    );
  }

  if (pageState === 'denied') {
    return (
      <div className="permission-denied" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="lock-icon">🔒</div>
        <h2>权限不足</h2>
        <p>仅超级管理员可以访问 API 密钥管理页面</p>
        <button className="btn btn-primary" style={{ width: 'auto', marginTop: '16px' }} onClick={() => (window.location.href = './admin.html')}>
          ← 返回管理后台
        </button>
      </div>
    );
  }

  const keyFilesReady = files.filter((f) => f.exists).length;
  const totalFiles = files.length;
  const allReady = keyFilesReady >= 3; // 三个密钥系统文件存在即可加密保存
  const policyUnitLabel = policyUnit === 'min' ? '分钟' : '秒';

  return (
    <div className="api-page">
      <header className="api-header">
        <div>
          <h1>🔑 API 密钥管理</h1>
          <p>GitHub 凭证加密存储 · RSA 公钥加密 + AES 对称加密 · 拆分备份（key1 + key2 = whole_key）</p>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => (window.location.href = './admin.html')}>
          ← 返回管理后台
        </button>
      </header>

      {!secure && (
        <div className="card" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
          <h3 style={{ fontSize: '15px', marginBottom: '6px' }}>⚠️ 当前环境不支持加密</h3>
          <p className="form-hint" style={{ color: '#991b1b' }}>
            密钥加解密依赖 Web Crypto API，需要 <strong>https</strong> 或 <strong>localhost</strong> 环境。
            GitHub Pages 为 https，可直接使用；请勿用 file:// 直接打开本页面。
          </p>
        </div>
      )}

      {toast && <div className={`toast ${toast.type === 'ok' ? 'success' : 'error'}`}>{toast.msg}</div>}

      {/* ============ ① 密钥系统状态 ============ */}
      <div className="card">
        <div className="api-card-head">
          <h3>🗂️ 密钥系统状态</h3>
          <span className={`deploy-status-badge ${allReady ? 'deploy-status-success' : 'deploy-status-error'}`}>
            {allReady ? `已就绪（${keyFilesReady}/${totalFiles}）` : `未就绪（${keyFilesReady}/${totalFiles}）`}
          </span>
        </div>
        <div className="api-file-grid">
          {files.map((f) => (
            <div key={f.path} className={`api-file-item ${f.exists ? 'ok' : 'missing'}`}>
              <span className="api-file-icon">{f.exists ? '✅' : '❌'}</span>
              <div>
                <div className="api-file-label">{f.label}</div>
                <div className="api-file-path">{f.path}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="form-hint" style={{ marginTop: '10px', lineHeight: 1.8 }}>
          加密体系：<strong>key.xml</strong>（AES-256 对称密钥，base64 编码）→ 保护 <strong>key_storage.yml</strong>（RSA 私钥）；
          API Key 用 <strong>public_key.yml</strong>（RSA 公钥）加密存入主存储，并拆分为两段分别用不同派生密钥加密存入 <strong>key1.xml / key2.xml</strong>（key1 + key2 = whole_key）。
          读取时交叉校验，任一文件丢失都有另一套兜底。
        </p>
      </div>

      {/* ============ ② GitHub 账户 ============ */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>👤 GitHub 账户（密钥文件写入目标）</h3>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>GitHub 用户名（可选，仅用于显示）</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Bestar" />
          </div>
          <div className="form-group" style={{ flex: 2 }}>
            <label>仓库地址（owner/repo）*</label>
            <input type="text" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="Bestar/enterprise-website" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>分支 *</label>
            <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
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
            {storedKeyInfo.has
              ? `✅ 已从加密存储解密并启用（${storedKeyInfo.method}）：${storedKeyInfo.masked}`
              : tokenSaved
                ? '✅ 当前会话已保存 Token（仅本浏览器可见，关闭后自动清除）'
                : '⚠️ 尚未保存 Token'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={handleSaveAccount} style={{ width: 'auto' }}>
            💾 保存账户配置
          </button>
          <button className="btn btn-secondary" onClick={handleTestToken} style={{ width: 'auto' }} disabled={busy === 'test'}>
            {busy === 'test' ? '⏳ 测试中...' : '🔌 测试 Token'}
          </button>
          {tokenSaved && (
            <button className="btn btn-danger" onClick={handleClearToken} style={{ width: 'auto' }}>
              🗑️ 清除会话 Token
            </button>
          )}
        </div>
      </div>

      {/* ============ ③ API Key 加密存储 ============ */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>🔐 API Key 加密存储</h3>
        <div className="form-group">
          <label>要加密保存的 API Key</label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="与上方同一 Token（加密后仅密文入仓库，任何人下载都无法还原）"
            autoComplete="off"
          />
          <p className="form-hint">
            存储位置：<code>api/key/api_key_storage.xml</code>（RSA 主存储）+ <code>api/key/key1.xml</code> / <code>key2.xml</code>（拆分备份）
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleInitKeySystem} style={{ width: 'auto' }} disabled={busy !== ''}>
            {busy === 'init' ? '⏳ 正在生成并推送密钥...' : '⚙️ 初始化密钥系统（首次必做）'}
          </button>
          <button className="btn btn-success" onClick={handleSaveApiKey} style={{ width: 'auto' }} disabled={busy !== '' || !allReady}>
            {busy === 'saveKey' ? '⏳ 正在加密并推送...' : '🔒 加密保存 API Key'}
          </button>
          <button className="btn btn-secondary" onClick={() => handleDecrypt()} style={{ width: 'auto' }} disabled={busy !== ''}>
            {busy === 'decrypt' ? '⏳ 正在解密...' : '🔓 解密查看'}
          </button>
          {decryptedKey && (
            <button className="btn btn-secondary" onClick={() => setShowKey(!showKey)} style={{ width: 'auto' }}>
              {showKey ? '🙈 隐藏' : '👁️ 显示明文'}
            </button>
          )}
        </div>
        {decryptedKey && (
          <div className="api-key-result">
            <div className="form-group">
              <label>解密后的 API Key（仅本浏览器可见）</label>
              <input type={showKey ? 'text' : 'password'} value={decryptedKey} readOnly />
            </div>
            <p className="form-hint">解密成功即代表密钥链完整可用；此 Token 已写入本会话，可直接用于自动部署。</p>
          </div>
        )}
      </div>

      {/* ============ ④ 登录锁定策略 ============ */}
      <div className="card" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
        <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>⏱️ 登录锁定策略（仅超级管理员可配置）</h3>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>连续输错次数（1-100）</label>
            <input
              type="number"
              min={1}
              max={100}
              value={policy.maxFails}
              onChange={(e) => setPolicy({ ...policy, maxFails: Number(e.target.value) })}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>锁定时间</label>
            <input
              type="number"
              min={1}
              value={policyInput}
              onChange={(e) => setPolicyInput(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>时间单位</label>
            <select value={policyUnit} onChange={(e) => setPolicyUnit(e.target.value as 'sec' | 'min')}>
              <option value="sec">秒</option>
              <option value="min">分钟</option>
            </select>
          </div>
        </div>
        <p className="form-hint" style={{ marginBottom: '12px' }}>
          当前生效：连续输错 <strong>{policy.maxFails}</strong> 次锁定 <strong>{policyInput} {policyUnitLabel}</strong>。
          保存后自动写入 <code>config.xml</code> 的 security 节点并推送到 GitHub，部署后所有浏览器生效。
        </p>
        <button className="btn btn-primary" onClick={handleSavePolicy} style={{ width: 'auto' }} disabled={busy === 'pushPolicy'}>
          {busy === 'pushPolicy' ? '⏳ 正在保存并部署...' : '💾 保存并部署锁定策略'}
        </button>
      </div>

      {/* ============ ⑤ 导出备份 ============ */}
      <div className="card">
        <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>📦 导出备份 / 安全说明</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExportBackup} style={{ width: 'auto' }}>
            ⬇️ 导出全部密钥文件（离线备份）
          </button>
        </div>
        <ul className="security-tips">
          <li>API Key 加密后仅以<strong>密文</strong>形式存在于仓库 <code>api/</code> 目录；没有密钥链（key.xml → key_storage.yml → public_key.yml）无法还原。</li>
          <li>Token 明文只出现在<strong>当前浏览器会话</strong>（sessionStorage），关闭浏览器自动清除。</li>
          <li>GitHub 已不支持账号密码调用 API，请使用 <strong>Personal Access Token</strong>（GitHub → Settings → Developer settings → PAT，仅勾选 repo 权限）。</li>
          <li>建议定期「导出全部密钥文件」离线备份；密钥丢失后需重新初始化并重新加密保存 API Key。</li>
          <li>若仓库为公开仓库，任何人可下载 <code>api/</code> 下的密文文件——分层加密提高破解成本，<strong>更安全的做法是让整个仓库为私有</strong>。</li>
        </ul>
      </div>
    </div>
  );
}
