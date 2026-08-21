import { useState, useEffect, useCallback } from 'react';
import { parseConfigXml } from '../admin/utils/config';
import { SiteContent, DEFAULT_CONTENT, CONTACT_TYPE_META } from '../admin/types';
import { sanitizeHref } from '../admin/utils/security';

function buildContactHref(type: string, value: string, link?: string): string | undefined {
  if (link) return link;
  const meta = CONTACT_TYPE_META[type as keyof typeof CONTACT_TYPE_META];
  if (!meta?.linkPrefix) return undefined;
  return meta.linkPrefix + value;
}

// 图片 src 只允许 data:image/ 前缀（后台 FileReader 生成的合法格式），
// 防止恶意 config.xml 注入任意 data URL
const isSafeImageSrc = (src: string): boolean => /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(src);

export function MainSite() {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);

  // 从站点根目录加载 config.xml（静态托管配置的唯一来源）
  const loadContent = useCallback(() => {
    fetch('config.xml', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((xml) => setContent(parseConfigXml(xml).content))
      .catch(() => setContent(DEFAULT_CONTENT));
  }, []);

  useEffect(() => {
    loadContent();

    // 切回本标签页时自动重新加载（后台部署新 config.xml 后立即生效）
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadContent();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // 定期轮询兜底（30 秒，避免长时间挂起时内容过期）
    const timer = window.setInterval(loadContent, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [loadContent]);

  // 浏览器标签页标题 = 后台配置的网站标题
  useEffect(() => {
    document.title = content.siteTitle || '企业门户';
  }, [content.siteTitle]);

  const { text, tags, background, images, contacts, navItems } = content;

  // 渲染导航菜单：启用项；自定义页面项自动生成区块锚点
  const visibleNav = navItems.filter((n) => n.enabled);
  const customPages = navItems.filter((n) => n.enabled && n.page);

  const isExternal = (href: string) => /^https?:\/\//.test(href);

  const heroBg = (): React.CSSProperties => {
    switch (background.type) {
      case 'color':
        return { background: background.color };
      case 'gradient':
        return { background: background.gradient };
      case 'image':
        return background.imageDataUrl
          ? { backgroundImage: `url(${background.imageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
      default:
        return { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };
    }
  };

  return (
    <div className="main-site">
      {/* 导航栏 */}
      <nav className="site-nav">
        <div className="site-nav-logo">{text.navLogo}</div>
        <div className="site-nav-links">
          {visibleNav.map((nav) => {
            const safeHref = sanitizeHref(nav.href);
            return isExternal(safeHref) ? (
              <a key={nav.id} href={safeHref} target="_blank" rel="noreferrer">
                {nav.label}
              </a>
            ) : (
              <a key={nav.id} href={safeHref}>
                {nav.label}
              </a>
            );
          })}
          <a href="admin/admin.html" className="site-nav-admin-link">管理后台</a>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section id="hero" className="hero-section" style={heroBg()}>
        <div className="hero-content">
          <h1>{text.heroTitle}</h1>
          <p>{text.heroSubtitle}</p>
          <a href="#features" className="hero-cta">了解更多 →</a>
        </div>
      </section>

      {/* 标签区域 */}
      {tags.length > 0 && (
        <section className="section" style={{ paddingBottom: '20px' }}>
          <div className="tags-section">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="tag-chip"
                style={{ background: tag.color + '15', color: tag.color, border: `1px solid ${tag.color}40` }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 核心服务 */}
      <section id="features" className="section">
        <h2 className="section-title">{text.featuresTitle}</h2>
        <p className="section-subtitle">为您提供全方位的专业服务</p>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>{text.feature1Title}</h3>
            <p>{text.feature1Desc}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>{text.feature2Title}</h3>
            <p>{text.feature2Desc}</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>{text.feature3Title}</h3>
            <p>{text.feature3Desc}</p>
          </div>
        </div>
      </section>

      {/* 图片画廊 */}
      {images.length > 0 && (
        <section id="gallery" className="section">
          <h2 className="section-title">图库展示</h2>
          <p className="section-subtitle">精彩图片一览</p>
          <div className="gallery-grid">
            {images.map((img) => (
              <div key={img.id} className="gallery-item">
                <img src={isSafeImageSrc(img.dataUrl) ? img.dataUrl : ''} alt={img.name} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 关于我们 */}
      <section id="about" className="section">
        <div className="about-section">
          <h2>{text.aboutTitle}</h2>
          <p>{text.aboutText}</p>
        </div>
      </section>

      {/* 自定义页面区块（后台导航菜单添加的板块） */}
      {customPages.map((page) => (
        <section key={page.id} id={`page-${page.id}`} className="section">
          <h2 className="section-title">{page.pageTitle || page.label}</h2>
          {page.pageContent && (
            <div className="custom-page-content">
              {page.pageContent.split('\n').map((line, i) => (
                <p key={i} style={line.trim() === '' ? { height: '12px' } : undefined}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* 联系方式 */}
      {contacts.some((c) => c.enabled) && (
        <section id="contact" className="section">
          <h2 className="section-title">联系我们</h2>
          <p className="section-subtitle">欢迎随时与我们取得联系</p>
          <div className="contact-grid">
            {contacts
              .filter((c) => c.enabled)
              .map((contact) => {
                const meta = CONTACT_TYPE_META[contact.type];
                const href = buildContactHref(contact.type, contact.value, contact.link);
                const safeHref = href ? sanitizeHref(href) : undefined;
                const inner = (
                  <>
                    <span className="contact-icon">{meta.icon}</span>
                    <span className="contact-label">{contact.label || meta.label}</span>
                    <span className="contact-value">{contact.value}</span>
                  </>
                );
                return safeHref ? (
                  <a
                    key={contact.id}
                    className="contact-card"
                    href={safeHref}
                    target={safeHref.startsWith('mailto:') || safeHref.startsWith('tel:') ? undefined : '_blank'}
                    rel="noreferrer"
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={contact.id} className="contact-card">
                    {inner}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* 页脚 */}
      <footer className="site-footer">
        <p>{text.footerText}</p>
        <p style={{ marginTop: '8px' }}>
          <a href="admin/admin.html">管理后台</a>
        </p>
      </footer>
    </div>
  );
}
