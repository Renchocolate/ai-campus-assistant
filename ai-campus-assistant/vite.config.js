import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 使用 '.cpolar.top' 可以放行所有 cpolar 分配的子域名
    // 或者直接写 'all' 放行所有请求（仅限本地开发时使用，生产环境不要这么配）
    allowedHosts: ['.cpolar.top', '.cpolar.io'] 
  }
})
