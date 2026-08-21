import React from 'react'
import ReactDOM from 'react-dom/client'
import { ApiKeyManage } from './components/ApiKeyManage'
import '../styles/index.css'

// 独立页面：API 密钥管理（由 admin.html 跳转进入，仅超级管理员可访问）
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApiKeyManage />
  </React.StrictMode>,
)
