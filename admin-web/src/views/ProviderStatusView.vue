<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchProviders, setProviderPage, setProviderStatus } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import {
  AUDIT_STATUS_LABEL,
  AUDIT_STATUS_TAG,
  ENABLED_LABEL,
  ENABLED_OPTIONS,
  ENABLED_TAG
} from '@/constants/dict'
import type { EnabledStatus, ProviderListVO } from '@/types/admin'

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<ProviderListVO[]>([])
const total = ref(0)

const query = reactive<{
  keyword: string
  enabled: EnabledStatus | ''
  page: number
  size: number
}>({ keyword: '', enabled: '', page: 1, size: 20 })

const dialog = reactive({
  visible: false,
  submitting: false,
  target: null as ProviderListVO | null,
  nextEnabled: true,
  reason: ''
})

/** 正在切换主页状态的服务者 id，用于按钮 loading */
const pageBusyId = ref<number | null>(null)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await fetchProviders({
      keyword: query.keyword,
      auditStatus: '',
      enabled: query.enabled,
      page: query.page,
      size: query.size
    })
    rows.value = page.records
    total.value = page.total
  } catch {
    rows.value = []
    total.value = 0
    error.value = '服务者列表加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function openDialog(row: ProviderListVO, nextEnabled: boolean): void {
  dialog.target = row
  dialog.nextEnabled = nextEnabled
  dialog.reason = ''
  dialog.visible = true
}

async function onConfirm(): Promise<void> {
  const target = dialog.target
  if (!target) return

  dialog.submitting = true
  try {
    const updated = await setProviderStatus(target.id, {
      enabled: dialog.nextEnabled,
      reason: dialog.reason
    })
    // 用接口返回的最新状态就地更新，避免整表重载。
    const idx = rows.value.findIndex((r) => r.id === updated.id)
    if (idx >= 0) rows.value.splice(idx, 1, updated)
    ElMessage.success(dialog.nextEnabled ? '已启用该服务者' : '已停用该服务者')
    dialog.visible = false
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    dialog.submitting = false
  }
}

/**
 * 开启 / 关闭服务主页。
 *
 * 主页关闭时，客户扫推广码只会拿到 41008「该服务主页已关闭」。
 * 服务者自己在小程序里可以关（暂时不干了），这里只是管理员的兜底入口。
 */
async function togglePage(row: ProviderListVO, enable: boolean): Promise<void> {
  if (pageBusyId.value != null) return
  if (!enable) {
    try {
      await ElMessageBox.confirm(
        '关闭后该服务者主页不再对外展示，客户扫码会提示「该服务主页已关闭」，确认关闭？',
        '关闭服务主页',
        { confirmButtonText: '确认关闭', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  }
  pageBusyId.value = row.id
  try {
    const updated = await setProviderPage(row.id, { enabled: enable })
    const idx = rows.value.findIndex((r) => r.id === updated.id)
    if (idx >= 0) rows.value.splice(idx, 1, updated)
    ElMessage.success(enable ? '已开启该服务者主页' : '已关闭该服务者主页')
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    pageBusyId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">服务者状态管理</h2>
        <p class="page__desc">
          停用会同步禁用其登录账号并立即失效推广码，客户无法再访问主页与下单；操作原因会写入审核备注与操作日志。
          「服务主页」列控制的是客户扫码能不能看到内容：正常由服务者自己在小程序里开关，这里是管理员的兜底入口。
        </p>
      </div>
    </div>

    <section class="panel">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          placeholder="姓名 / 手机号 / 推广码"
          clearable
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-select v-model="query.enabled" placeholder="启停状态" clearable @change="onSearch">
          <el-option
            v-for="o in ENABLED_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </section>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="260" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="realName" label="姓名" min-width="110" />
          <el-table-column prop="phone" label="手机号" min-width="120" />
          <el-table-column label="审核状态" width="100">
            <template #default="{ row }: { row: ProviderListVO }">
              <el-tag
                v-if="row.auditStatus"
                size="small"
                :type="AUDIT_STATUS_TAG[row.auditStatus]"
              >
                {{ row.auditStatusLabel || AUDIT_STATUS_LABEL[row.auditStatus] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="启停状态" width="96">
            <template #default="{ row }: { row: ProviderListVO }">
              <el-tag v-if="row.enabled" size="small" :type="ENABLED_TAG[row.enabled]">
                {{ ENABLED_LABEL[row.enabled] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="服务主页" width="150">
            <template #default="{ row }: { row: ProviderListVO }">
              <div class="page-cell">
                <el-tag v-if="row.pageEnabled" size="small" type="success">开放中</el-tag>
                <el-tag v-else size="small" type="info">已关闭</el-tag>
                <el-button
                  link
                  type="primary"
                  size="small"
                  :loading="pageBusyId === row.id"
                  @click="togglePage(row, !row.pageEnabled)"
                >
                  {{ row.pageEnabled ? '关闭' : '开启' }}
                </el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="推广码" min-width="150">
            <template #default="{ row }: { row: ProviderListVO }">
              <span class="mono">{{ row.referralCode || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" width="86" align="right" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }: { row: ProviderListVO }">
              <el-button
                v-if="row.enabled === 'ENABLED'"
                link
                type="danger"
                @click="openDialog(row, false)"
              >
                停用
              </el-button>
              <el-button
                v-else-if="row.enabled === 'DISABLED'"
                link
                type="primary"
                @click="openDialog(row, true)"
              >
                启用
              </el-button>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="没有符合条件的服务者" :image-size="72" />
          </template>
        </el-table>

        <div class="pager">
          <el-pagination
            v-model:current-page="query.page"
            v-model:page-size="query.size"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="load"
            @size-change="onSearch"
          />
        </div>
      </PageState>
    </section>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.nextEnabled ? '启用服务者' : '停用服务者'"
      width="440px"
    >
      <el-descriptions v-if="dialog.target" :column="1" border size="small" class="status__desc">
        <el-descriptions-item label="服务者">
          {{ dialog.target.realName || '—' }}（{{ dialog.target.phone || '—' }}）
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          {{ dialog.target.enabled ? ENABLED_LABEL[dialog.target.enabled] : '—' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form label-width="70px" class="status__form">
        <el-form-item label="原因">
          <el-input
            v-model="dialog.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            :placeholder="dialog.nextEnabled ? '可选，记录恢复原因' : '必填，将写入审核备注与操作日志'"
          />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="!dialog.nextEnabled"
        type="warning"
        :closable="false"
        show-icon
        title="停用后该服务者将无法登录，客户也无法通过其推广码访问主页与下单。"
      />

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button
          :type="dialog.nextEnabled ? 'primary' : 'danger'"
          :loading="dialog.submitting"
          @click="onConfirm"
        >
          确认{{ dialog.nextEnabled ? '启用' : '停用' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.status__desc {
  margin-bottom: 14px;
}

.status__form {
  margin-bottom: 12px;
}

.page-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
