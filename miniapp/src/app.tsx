import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import './app.scss'

/**
 * 应用入口。
 * 启动时从本地存储恢复登录态（token + 展示资料），供各页面做登录守卫。
 */
function App({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return <>{children}</>
}

export default App