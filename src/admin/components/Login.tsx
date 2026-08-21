import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getLoginLockRemainMs, recordLoginFail, resetLoginFails, getLoginPolicy } from '../utils/security';

export function Login() {
  const { login } = useAuth();
  const policy = getLoginPolicy();
  const lockSec = Math.ceil(policy.lockMs / 1000);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lockRemainSec, setLockRemainSec] = useState(() => Math.ceil(getLoginLockRemainMs() / 1000));

  // 锁定倒计时（连续失败策略次数后锁定，时长由超级管理员配置）
  useEffect(() => {
    if (lockRemainSec <= 0) return;
    const timer = window.setInterval(() => {
      const remain = Math.ceil(getLoginLockRemainMs() / 1000);
      setLockRemainSec(remain);
      if (remain <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockRemainSec]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemainSec > 0) {
      setError(`尝试次数过多，请 ${lockRemainSec} 秒后再试`);
      return;
    }
    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    const ok = login(username, password);
    if (!ok) {
      recordLoginFail();
      const remain = Math.ceil(getLoginLockRemainMs() / 1000);
      setLockRemainSec(remain);
      setError(remain > 0 ? `密码错误次数过多，请 ${remain} 秒后再试` : '用户名或密码错误');
    } else {
      resetLoginFails();
    }
  };

  const locked = lockRemainSec > 0;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">⚙️</span>
          <h1>管理后台</h1>
          <p>企业管理系统 · 登录</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              disabled={locked}
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={locked}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={locked}>
            {locked ? `⏳ 锁定中（${lockRemainSec}s）` : '🔐 登 录'}
          </button>
        </form>
        <p className="login-hint">
          默认管理员：Bestar · 密码由 SHA-256 加密存储 · 连续输错 {policy.maxFails} 次锁定 {lockSec} 秒
        </p>
      </div>
    </div>
  );
}
