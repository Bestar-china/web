import { useState, useEffect } from 'react';
import { useContent } from '../contexts/ContentContext';
import { TextContent } from '../types';

export function TextManagement() {
  const { content, updateText } = useContent();
  const [form, setForm] = useState<TextContent>(content.text);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(content.text);
  }, [content.text]);

  const handleChange = (key: keyof TextContent, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateText(form);
    setDirty(false);
    showToast('内容已保存，导出 config.xml 部署后全站生效');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h1>📝 文字内容管理</h1>
        <p>编辑网站各处显示的文字内容</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>🧭 导航栏</h3>
        <div className="text-editor-section">
          <h3>网站 Logo 文字</h3>
          <input
            type="text"
            value={form.navLogo}
            onChange={(e) => handleChange('navLogo', e.target.value)}
            placeholder="如：企业门户"
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>🌟 首页 Hero 区域</h3>
        <div className="text-editor-section">
          <h3>主标题</h3>
          <input
            type="text"
            value={form.heroTitle}
            onChange={(e) => handleChange('heroTitle', e.target.value)}
            placeholder="如：创新科技 · 筑梦未来"
          />
        </div>
        <div className="text-editor-section">
          <h3>副标题</h3>
          <textarea
            value={form.heroSubtitle}
            onChange={(e) => handleChange('heroSubtitle', e.target.value)}
            placeholder="如：专业的企业级解决方案提供商"
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>📋 关于我们</h3>
        <div className="text-editor-section">
          <h3>标题</h3>
          <input
            type="text"
            value={form.aboutTitle}
            onChange={(e) => handleChange('aboutTitle', e.target.value)}
            placeholder="如：关于我们"
          />
        </div>
        <div className="text-editor-section">
          <h3>正文内容</h3>
          <textarea
            value={form.aboutText}
            onChange={(e) => handleChange('aboutText', e.target.value)}
            placeholder="企业介绍文字..."
            style={{ minHeight: '120px' }}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>⚡ 核心服务区域</h3>
        <div className="text-editor-section">
          <h3>区域标题</h3>
          <input
            type="text"
            value={form.featuresTitle}
            onChange={(e) => handleChange('featuresTitle', e.target.value)}
            placeholder="如：核心服务"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <div className="text-editor-section">
              <h3>特性 1 标题</h3>
              <input type="text" value={form.feature1Title} onChange={(e) => handleChange('feature1Title', e.target.value)} />
            </div>
            <div className="text-editor-section">
              <h3>特性 1 描述</h3>
              <textarea value={form.feature1Desc} onChange={(e) => handleChange('feature1Desc', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-editor-section">
              <h3>特性 2 标题</h3>
              <input type="text" value={form.feature2Title} onChange={(e) => handleChange('feature2Title', e.target.value)} />
            </div>
            <div className="text-editor-section">
              <h3>特性 2 描述</h3>
              <textarea value={form.feature2Desc} onChange={(e) => handleChange('feature2Desc', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="text-editor-section">
          <h3>特性 3 标题</h3>
          <input type="text" value={form.feature3Title} onChange={(e) => handleChange('feature3Title', e.target.value)} />
        </div>
        <div className="text-editor-section">
          <h3>特性 3 描述</h3>
          <textarea value={form.feature3Desc} onChange={(e) => handleChange('feature3Desc', e.target.value)} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>📄 页脚</h3>
        <div className="text-editor-section">
          <h3>页脚文字</h3>
          <input
            type="text"
            value={form.footerText}
            onChange={(e) => handleChange('footerText', e.target.value)}
            placeholder="如：© 2026 企业门户. 保留所有权利."
          />
        </div>
      </div>

      <div className="save-bar">
        {dirty && <span style={{ color: 'var(--warning)', fontSize: '14px', alignSelf: 'center' }}>● 有未保存的修改</span>}
        <button className="btn btn-secondary" onClick={() => { setForm(content.text); setDirty(false); }} style={{ width: 'auto' }}>
          重置
        </button>
        <button className="btn btn-success" onClick={handleSave} style={{ width: 'auto' }}>
          💾 保存所有修改
        </button>
      </div>
      {toast && <div className="toast success">✅ {toast}</div>}
    </div>
  );
}
