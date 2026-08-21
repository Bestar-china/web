import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ContentProvider, useContent } from './contexts/ContentContext';
import { initConfig } from './utils/storage';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { UserManagement } from './components/UserManagement';
import { TagManagement } from './components/TagManagement';
import { BackgroundSettings } from './components/BackgroundSettings';
import { ImageManagement } from './components/ImageManagement';
import { TextManagement } from './components/TextManagement';
import { ContactManagement } from './components/ContactManagement';
import { NavManagement } from './components/NavManagement';
import { DeploySettings } from './components/DeploySettings';
import { Permission } from './types';

function DeployBanner() {
  const { dirty, exportXml, markClean, deployStatus, lastDeployMsg, autoDeployEnabled } = useContent();

  // 自动部署推送中：显示进度条横幅
  if (deployStatus === 'saving') {
    return (
      <div className="deploy-banner deploy-banner-saving">
        <div className="deploy-banner-info">
          <span className="deploy-banner-icon">⏳</span>
          <div>
            <strong>正在自动部署...</strong>
            <p>{lastDeployMsg || '正在把最新配置推送到 GitHub，请稍候'}</p>
          </div>
        </div>
      </div>
    );
  }

  // 自动部署失败：提示错误 + 保留手动导出兜底
  if (deployStatus === 'error') {
    return (
      <div className="deploy-banner deploy-banner-error">
        <div className="deploy-banner-info">
          <span className="deploy-banner-icon">❌</span>
          <div>
            <strong>自动部署失败</strong>
            <p>{lastDeployMsg || '推送失败，请检查部署设置中的 Token 和仓库地址'}</p>
          </div>
        </div>
        <div className="deploy-banner-actions">
          <button className="btn btn-success" onClick={exportXml} style={{ width: 'auto' }}>
            ⬇️ 导出 config.xml（手动兜底）
          </button>
          <button className="btn btn-secondary" onClick={markClean} style={{ width: 'auto' }}>
            知道了
          </button>
        </div>
      </div>
    );
  }

  if (!dirty) return null;

  return (
    <div className="deploy-banner">
      <div className="deploy-banner-info">
        <span className="deploy-banner-icon">📤</span>
        <div>
          <strong>{autoDeployEnabled ? '有修改，即将自动部署' : '有未部署的修改'}</strong>
          <p>
            {autoDeployEnabled
              ? '停止修改后约 3 秒自动推送到 GitHub 并触发重新部署'
              : '导出 config.xml 并放回站点根目录重新部署后，所有访客才能看到新内容'}
          </p>
        </div>
      </div>
      <div className="deploy-banner-actions">
        <button className="btn btn-success" onClick={exportXml} style={{ width: 'auto' }}>
          ⬇️ 导出 config.xml
        </button>
        <button className="btn btn-secondary" onClick={markClean} style={{ width: 'auto' }}>
          知道了
        </button>
      </div>
    </div>
  );
}

function AdminApp() {
  const { user, hasPermission } = useAuth();
  const [activePage, setActivePage] = useState<Permission>('dashboard');

  // 当用户角色变化时，确保当前页面有权限
  useEffect(() => {
    if (user && !hasPermission(activePage)) {
      setActivePage('dashboard');
    }
  }, [user, activePage, hasPermission]);

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    if (!hasPermission(activePage)) {
      return (
        <div className="permission-denied">
          <div className="lock-icon">🔒</div>
          <h2>权限不足</h2>
          <p>您当前的角色无法访问此页面</p>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'users':
        return <UserManagement />;
      case 'tags':
        return <TagManagement />;
      case 'background':
        return <BackgroundSettings />;
      case 'images':
        return <ImageManagement />;
      case 'contacts':
        return <ContactManagement />;
      case 'nav':
        return <NavManagement />;
      case 'deploy':
        return <DeploySettings />;
      case 'text':
        return <TextManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar activePage={activePage} onPageChange={setActivePage} />
      <main className="main-content">
        <DeployBanner />
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 加载站点根目录的 config.xml（静态托管配置来源）
    initConfig().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>正在加载站点配置...</p>
      </div>
    );
  }

  return (
    <AuthProvider>
      <ContentProvider>
        <AdminApp />
      </ContentProvider>
    </AuthProvider>
  );
}
