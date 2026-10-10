<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchProviders } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import {
  AUDIT_STATUS_LABEL,
  AUDIT_STATUS_OPTIONS,
  AUDIT_STATUS_TAG,
  ENABLED_LABEL,
  ENABLED_OPTIONS,
  ENABLED_TAG
} from '@/constants/dict'
import type { AuditStatus, EnabledStatus, ProviderListVO } from '@/types/admin'

const router = useRouter()

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<ProviderListVO[]>([])
const total = ref(0)

const query = reactive<{
  keyword: string
  auditStatus: AuditStatus | ''
  enabled: EnabledStatus | ''
  page: number
  size: number
}>({
  keyword: '',
  auditStatus: '',
  enabled: '',
  page: 1,
  size: 20
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await fetchProviders({ ...query })
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

function onReset(): void {
  query.keyword = ''
  query.auditStatus = ''
  query.enabled = ''
  query.page = 1
  void load()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">服务者列表</h2>
        <p class="page__desc">按姓名 / 手机号 / 推广码检索，审核与启停动作在各自页面完成。</p>
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
        <el-select v-model="query.auditStatus" placeholder="审核状态" clearable @change="onSearch">
          <el-option
            v-for="o in AUDIT_STATUS_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-select v-model="query.enabled" placeholder="启停状态" clearable @change="onSearch">
          <el-option
            v-for="o in ENABLED_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </section>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="260" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="realName" label="姓名" min-width="110" />
          <el-table-column prop="phone" label="手机号" min-width="120" />
          <el-table-column prop="serviceArea" label="服务区域" min-width="110">
            <template #default="{ row }: { row: ProviderListVO }">
              {{ row.serviceArea || '—' }}
            </template>
          </el-table-column>
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
          <el-table-column label="推广码" min-width="150">
            <template #default="{ row }: { row: ProviderListVO }">
              <span class="mono">{{ row.referralCode || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="orderCount" label="订单数" width="86" align="right" />
          <el-table-column prop="customerCount" label="客户数" width="86" align="right" />
          <el-table-column label="注册时间" width="160">
            <template #default="{ row }: { row: ProviderListVO }">
              <span class="text-muted nowrap">{{ (row.createdAt || '').replace('T', ' ') || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="190" fixed="right">
            <template #default="{ row }: { row: ProviderListVO }">
              <el-button link type="primary" @click="router.push(`/providers/audit/${row.id}`)">
                审核详情
              </el-button>
              <el-button link type="primary" @click="router.push('/provider-status')">
                状态管理
              </el-button>
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
  </div>
</template>
