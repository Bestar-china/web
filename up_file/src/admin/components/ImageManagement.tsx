import { useState, useRef } from 'react';
import { useContent } from '../contexts/ContentContext';

export function ImageManagement() {
  const { content, addImage, deleteImage } = useContent();
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        showToast(`${file.name} 超过 2MB，已跳过`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        addImage(file.name, reader.result as string);
      };
      reader.readAsDataURL(file);
    });

    showToast(`正在上传 ${files.length} 张图片...`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定删除图片 "${name}" 吗？`)) {
      deleteImage(id);
      showToast('图片已删除');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>🖼️ 图片管理</h1>
        <p>上传和管理网站展示的图片</p>
      </div>

      <div className="card">
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
          <div className="upload-icon">📤</div>
          <p>点击上传图片（支持多选，每张最大 2MB）</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>图片列表 ({content.images.length})</h3>
        </div>

        {content.images.length > 0 ? (
          <div className="image-grid">
            {content.images.map((img) => (
              <div key={img.id} className="image-card">
                <img src={img.dataUrl} alt={img.name} />
                <div className="image-card-info">
                  <div className="image-card-name" title={img.name}>{img.name}</div>
                </div>
                <button
                  className="image-card-delete"
                  onClick={() => handleDelete(img.id, img.name)}
                  title="删除图片"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🖼️</div>
            <p>暂无图片，点击上方区域上传</p>
          </div>
        )}
      </div>
      {toast && <div className="toast success">✅ {toast}</div>}
    </div>
  );
}
