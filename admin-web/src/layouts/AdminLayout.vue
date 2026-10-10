<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const collapsed = ref(false)

interface NavItem {
  path: string
  title: string
}
interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '概览',
    items: [{ path: '/dashboard', title: '平台概览' }]
  },
  {
    title: '服务者',
    items: [
      { path: '/providers', title: '服务者列表' },
      { path: '/provider-status', title: '状态管理' }
    ]
  },
  {
    title: '服务配置',
    items: [
      { path: '/service-items', title: '服务项目' },
      { path: '/service-template', title: '主页模板配置' }
    ]
  },
  {
    title: '运营',
    items: [
      { path: '/orders', title: '全平台订单' },
      { path: '/complaints', title: '投诉与违规' }
    ]
  },
  {
    title: '系统',
    items: [
      { path: '/logs', title: '操作日志' },
      { path: '/settings', title: '基础设置' }
    ]
  }
]

const currentTitle = computed(() => route.meta.title ?? '')

async function onLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('确认退出管理后台？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  user.logout()
  void router.replace('/login')
}
</script>

<template>
  <div class="layout">
    <aside class="layout__aside" :class="{ 'is-collapsed': collapsed }">
      <div class="brand">
        <span class="brand__mark">邻</span>
        <span v-show="!collapsed" class="brand__text">邻里服务平台</span>
      </div>

      <nav class="nav">
        <div v-for="group in navGroups" :key="group.title" class="nav__group">
          <div v-show="!collapsed" class="nav__group-title">{{ group.title }}</div>
          <RouterLink
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="nav__item"
          >
            {{ item.title }}
          </RouterLink>
        </div>
      </nav>
    </aside>

    <div class="layout__main">
      <header class="topbar">
        <div class="topbar__left">
          <el-button text @click="collapsed = !collapsed">
            {{ collapsed ? '展开' : '收起' }}
          </el-button>
          <span class="topbar__title">{{ currentTitle }}</span>
        </div>
        <div class="topbar__right">
          <el-tag size="small" type="info" effect="plain">管理员</el-tag>
          <span class="topbar__user">{{ user.accountLabel }}</span>
          <el-button text type="primary" @click="onLogout">退出登录</el-button>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component }">
          <component :is="Component" />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}

.layout__aside {
  width: 208px;
  flex: 0 0 208px;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  transition: width 0.18s ease, flex-basis 0.18s ease;
}

.layout__aside.is-collapsed {
  width: 64px;
  flex-basis: 64px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  color: #fff;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  overflow: hidden;
}

.brand__mark {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border-radius: 6px;
  background: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.brand__text {
  font-size: 14.5px;
  letter-spacing: 0.2px;
}

.nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px 20px;
}

.nav__group + .nav__group {
  margin-top: 12px;
}

.nav__group-title {
  padding: 6px 10px;
  font-size: 11.5px;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.35);
}

.nav__item {
  display: block;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 6px;
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav__item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav__item.router-link-active {
  background: rgba(47, 111, 237, 0.18);
  color: var(--sidebar-active);
  font-weight: 500;
}

.layout__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 56px;
  flex: 0 0 56px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 4px;
}

.topbar__left,
.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__title {
  font-size: 15px;
  font-weight: 600;
}

.topbar__user {
  font-size: 13px;
  color: var(--text-sub);
}

.content {
  flex: 1;
  overflow: auto;
}
</style>
