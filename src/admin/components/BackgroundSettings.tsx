import { useState } from 'react';
import { useContent } from '../contexts/ContentContext';
import { BackgroundType } from '../types';

const COLOR_OPTIONS = [
  '#4f46e5', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#1e293b', '#0f172a', '#7c3aed', '#db2777',
];

const GRADIENT_OPTIONS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
  'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
];

export function BackgroundSettings() {
  const { content, updateBackground } = useContent();
  const { background } = content;
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const setType = (type: BackgroundType) => {
    updateBackground({ type });
    showToast('背景类型已更新');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片大小不能超过 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateBackground({ imageDataUrl: reader.result as string, type: 'image' });
      showToast('背景图片已设置');
    };
    reader.readAsDataURL(file);
  };

  const getPreviewStyle = (): React.CSSProperties => {
    switch (background.type) {
      case 'color':
        return { background: background.color };
      case 'gradient':
        return { background: background.gradient };
      case 'image':
        return background.imageDataUrl
          ? { backgroundImage: `url(${background.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: '#e5e7eb' };
      default:
        return { background: '#e5e7eb' };
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🎨 背景设置</h1>
        <p>设置主网站首页的背景样式</p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700 }}>背景类型</h3>
        <div className="bg-type-selector">
          <div
            className={`bg-type-option ${background.type === 'color' ? 'active' : ''}`}
            onClick={() => setType('color')}
          >
            🎨 纯色背景
          </div>
          <div
            className={`bg-type-option ${background.type === 'gradient' ? 'active' : ''}`}
            onClick={() => setType('gradient')}
          >
            🌈 渐变背景
          </div>
          <div
            className={`bg-type-option ${background.type === 'image' ? 'active' : ''}`}
            onClick={() => setType('image')}
          >
            🖼️ 图片背景
          </div>
        </div>

        {/* 纯色选择 */}
        {background.type === 'color' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>选择颜色</label>
            <div className="color-picker-grid">
              {COLOR_OPTIONS.map((c) => (
                <div
                  key={c}
                  className={`color-swatch ${background.color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => { updateBackground({ color: c }); showToast('颜色已更新'); }}
                />
              ))}
            </div>
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>自定义颜色</label>
              <input
                type="color"
                value={background.color}
                onChange={(e) => updateBackground({ color: e.target.value })}
                style={{ width: '60px', height: '40px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        {/* 渐变选择 */}
        {background.type === 'gradient' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>选择渐变</label>
            <div className="gradient-grid">
              {GRADIENT_OPTIONS.map((g) => (
                <div
                  key={g}
                  className={`gradient-option ${background.gradient === g ? 'active' : ''}`}
                  style={{ background: g }}
                  onClick={() => { updateBackground({ gradient: g }); showToast('渐变已更新'); }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 图片上传 */}
        {background.type === 'image' && (
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>上传背景图片</label>
            <div className="upload-zone" onClick={() => document.getElementById('bg-upload')?.click()}>
              <div className="upload-icon">📤</div>
              <p>点击上传图片（建议 1920×1080，最大 2MB）</p>
              <input
                id="bg-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>
            {background.imageDataUrl && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '14px', color: 'var(--success)', marginBottom: '8px' }}>✅ 已上传背景图片</p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => { updateBackground({ imageDataUrl: '' }); showToast('背景图片已清除'); }}
                  style={{ width: 'auto' }}
                >
                  移除图片
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 预览 */}
      <div className="card">
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>👁️ 实时预览</h3>
        <div className="bg-preview" style={getPreviewStyle()}>
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '18px',
            fontWeight: 700,
            textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}>
            背景预览效果
          </div>
        </div>
      </div>
      {toast && <div className="toast success">✅ {toast}</div>}
    </div>
  );
}
