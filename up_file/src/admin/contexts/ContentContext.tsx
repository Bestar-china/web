import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { SiteContent, Tag, SiteImage, TextContent, BackgroundConfig, ContactInfo, ContactType, NavItem } from '../types';
import {
  getSiteContent,
  saveSiteContent,
  isConfigDirty,
  markConfigClean,
  exportConfigXml,
} from '../utils/storage';
import { pushConfigToGithub, getGithubToken, getGithubSettings } from '../utils/github';
import { useAuth } from './AuthContext';

export type DeployStatus = 'idle' | 'saving' | 'success' | 'error';

interface ContentContextType {
  content: SiteContent;
  updateSiteTitle: (siteTitle: string) => void;
  addNavItem: (item: Omit<NavItem, 'id'>) => void;
  updateNavItem: (id: string, updates: Partial<NavItem>) => void;
  deleteNavItem: (id: string) => void;
  moveNavItem: (id: string, direction: -1 | 1) => void;
  updateText: (text: Partial<TextContent>) => void;
  updateBackground: (bg: Partial<BackgroundConfig>) => void;
  addTag: (name: string, color: string) => void;
  deleteTag: (id: string) => void;
  addImage: (name: string, dataUrl: string) => void;
  deleteImage: (id: string) => void;
  addContact: (type: ContactType, value: string, label?: string, link?: string, enabled?: boolean) => void;
  updateContact: (id: string, updates: Partial<ContactInfo>) => void;
  deleteContact: (id: string) => void;
  dirty: boolean;
  exportXml: () => void;
  markClean: () => void;
  reload: () => void;
  /** 自动部署状态（仅配置 GitHub 后生效） */
  deployStatus: DeployStatus;
  lastDeployMsg: string;
  /** 是否已配置自动部署（有 Token 且仓库合法） */
  autoDeployEnabled: boolean;
  /** 立即推送一次（用于部署设置页测试） */
  deployNow: () => Promise<void>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

const AUTO_PUSH_DEBOUNCE_MS = 3000;

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [content, setContent] = useState<SiteContent>(getSiteContent());
  const [dirty, setDirty] = useState<boolean>(isConfigDirty());
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [lastDeployMsg, setLastDeployMsg] = useState('');
  const [autoDeployEnabled, setAutoDeployEnabled] = useState<boolean>(
    () => !!getGithubToken() && !!getGithubSettings().repo
  );
  const pushTimerRef = useRef<number | null>(null);

  // 实际执行一次推送（内部含 super_admin 权限校验）
  const doPush = useCallback(async (): Promise<void> => {
    setDeployStatus('saving');
    setLastDeployMsg('正在自动推送到 GitHub...');
    const result = await pushConfigToGithub(user);
    setLastDeployMsg(result.message);
    if (result.ok) {
      markConfigClean();
      setDirty(false);
      setDeployStatus('success');
    } else {
      setDeployStatus('error');
    }
  }, [user]);

  // 防抖自动推送：内容变更 3 秒无新操作后执行
  const scheduleAutoPush = useCallback(() => {
    if (!getGithubToken() || !getGithubSettings().repo) {
      setAutoDeployEnabled(false);
      return;
    }
    setAutoDeployEnabled(true);
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      doPush();
    }, AUTO_PUSH_DEBOUNCE_MS);
  }, [doPush]);

  // 手动立即推送
  const deployNow = useCallback(async () => {
    if (pushTimerRef.current) {
      window.clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    await doPush();
  }, [doPush]);

  useEffect(() => {
    return () => {
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    };
  }, []);

  // 统一持久化：更新内存 + 标记未部署 + 触发自动推送
  const persist = useCallback((newContent: SiteContent) => {
    saveSiteContent(newContent);
    setContent(newContent);
    setDirty(isConfigDirty());
    scheduleAutoPush();
  }, [scheduleAutoPush]);

  const reload = useCallback(() => {
    setContent(getSiteContent());
    setDirty(isConfigDirty());
  }, []);

  const updateSiteTitle = useCallback((siteTitle: string) => {
    persist({ ...getSiteContent(), siteTitle: siteTitle.trim() });
  }, [persist]);

  const addNavItem = useCallback((item: Omit<NavItem, 'id'>) => {
    const newItem: NavItem = {
      ...item,
      id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    persist({ ...getSiteContent(), navItems: [...getSiteContent().navItems, newItem] });
  }, [persist]);

  const updateNavItem = useCallback((id: string, updates: Partial<NavItem>) => {
    persist({
      ...getSiteContent(),
      navItems: getSiteContent().navItems.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    });
  }, [persist]);

  const deleteNavItem = useCallback((id: string) => {
    persist({ ...getSiteContent(), navItems: getSiteContent().navItems.filter((n) => n.id !== id) });
  }, [persist]);

  const moveNavItem = useCallback((id: string, direction: -1 | 1) => {
    const items = [...getSiteContent().navItems];
    const idx = items.findIndex((n) => n.id === id);
    if (idx === -1) return;
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    persist({ ...getSiteContent(), navItems: items });
  }, [persist]);

  const updateText = useCallback((text: Partial<TextContent>) => {
    const updated = { ...getSiteContent(), text: { ...getSiteContent().text, ...text } };
    persist(updated);
  }, [persist]);

  const updateBackground = useCallback((bg: Partial<BackgroundConfig>) => {
    const updated = { ...getSiteContent(), background: { ...getSiteContent().background, ...bg } };
    persist(updated);
  }, [persist]);

  const addTag = useCallback((name: string, color: string) => {
    const newTag: Tag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      color,
    };
    persist({ ...getSiteContent(), tags: [...getSiteContent().tags, newTag] });
  }, [persist]);

  const deleteTag = useCallback((id: string) => {
    persist({ ...getSiteContent(), tags: getSiteContent().tags.filter((t) => t.id !== id) });
  }, [persist]);

  const addImage = useCallback((name: string, dataUrl: string) => {
    const newImage: SiteImage = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      dataUrl,
    };
    persist({ ...getSiteContent(), images: [...getSiteContent().images, newImage] });
  }, [persist]);

  const deleteImage = useCallback((id: string) => {
    persist({ ...getSiteContent(), images: getSiteContent().images.filter((i) => i.id !== id) });
  }, [persist]);

  const addContact = useCallback((type: ContactType, value: string, label?: string, link?: string, enabled: boolean = true) => {
    const newContact: ContactInfo = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      value,
      label: label?.trim() || undefined,
      link: link?.trim() || undefined,
      enabled,
    };
    persist({ ...getSiteContent(), contacts: [...getSiteContent().contacts, newContact] });
  }, [persist]);

  const updateContact = useCallback((id: string, updates: Partial<ContactInfo>) => {
    persist({
      ...getSiteContent(),
      contacts: getSiteContent().contacts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  }, [persist]);

  const deleteContact = useCallback((id: string) => {
    persist({ ...getSiteContent(), contacts: getSiteContent().contacts.filter((c) => c.id !== id) });
  }, [persist]);

  const exportXml = useCallback(() => {
    exportConfigXml();
    setDirty(isConfigDirty());
  }, []);

  const markClean = useCallback(() => {
    markConfigClean();
    setDirty(false);
  }, []);

  return (
    <ContentContext.Provider
      value={{
        content, updateSiteTitle, addNavItem, updateNavItem, deleteNavItem, moveNavItem,
        updateText, updateBackground, addTag, deleteTag, addImage, deleteImage,
        addContact, updateContact, deleteContact,
        dirty, exportXml, markClean, reload,
        deployStatus, lastDeployMsg, autoDeployEnabled, deployNow,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContent(): ContentContextType {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
