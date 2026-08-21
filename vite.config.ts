import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // 相对路径，兼容 GitHub Pages 子路径部署（user.github.io/repo/）
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin/admin.html'),
        apiManage: path.resolve(__dirname, 'admin/api_manage.html'),
      },
    },
  },
})
