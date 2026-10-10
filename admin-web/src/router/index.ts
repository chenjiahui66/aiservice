import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import AdminLayout from '@/layouts/AdminLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    /** 登录页等无需 token 的路由。 */
    public?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '管理员登录', public: true }
  },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '平台概览' }
      },
      {
        path: 'providers',
        name: 'providers',
        component: () => import('@/views/ProviderListView.vue'),
        meta: { title: '服务者列表' }
      },
      {
        path: 'providers/audit/:id',
        name: 'provider-audit',
        component: () => import('@/views/ProviderAuditView.vue'),
        meta: { title: '服务者审核详情' }
      },
      {
        path: 'provider-status',
        name: 'provider-status',
        component: () => import('@/views/ProviderStatusView.vue'),
        meta: { title: '服务者状态管理' }
      },
      {
        path: 'service-items',
        name: 'service-items',
        component: () => import('@/views/ServiceItemView.vue'),
        meta: { title: '服务项目管理' }
      },
      {
        path: 'service-template',
        name: 'service-template',
        component: () => import('@/views/ServiceTemplateView.vue'),
        meta: { title: '服务主页模板配置' }
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/OrderListView.vue'),
        meta: { title: '全平台订单查询' }
      },
      {
        path: 'complaints',
        name: 'complaints',
        component: () => import('@/views/ComplaintView.vue'),
        meta: { title: '投诉与违规处理' }
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/views/LogView.vue'),
        meta: { title: '操作日志' }
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingView.vue'),
        meta: { title: '系统基础设置' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在', public: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const user = useUserStore()
  if (to.meta.public) {
    if (to.path === '/login' && user.isLoggedIn) {
      return { path: '/dashboard' }
    }
    return true
  }
  if (!user.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  const base = '邻里服务平台 · 管理后台'
  document.title = to.meta.title ? `${to.meta.title} | ${base}` : base
})

export default router
