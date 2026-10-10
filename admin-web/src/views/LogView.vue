<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { fetchLogs } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import { OPERATOR_TYPE_LABEL } from '@/constants/dict'
import type { OperationLogVO } from '@/types/admin'

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<OperationLogVO[]>([])
const total = ref(0)

const query = reactive<{ page: number; size: number }>({ page: 1, size: 20 })

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await fetchLogs({ page: query.page, size: query.size })
    rows.value = page.records
    total.value = page.total
  } catch {
    rows.value = []
    total.value = 0
    error.value = '操作日志加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function onSizeChange(): void {
  query.page = 1
  void load()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">操作日志</h2>
        <p class="page__desc">
          记录管理员在服务者审核、启停、投诉处理与系统设置上的关键动作，用于事后追溯。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="300" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column label="操作人类型" width="100">
            <template #default="{ row }: { row: OperationLogVO }">
              {{ (row.operatorType && OPERATOR_TYPE_LABEL[row.operatorType]) || row.operatorType || '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="operatorName" label="操作人" min-width="110" />
          <el-table-column prop="module" label="模块" width="120" />
          <el-table-column prop="action" label="动作" width="100" />
          <el-table-column prop="targetId" label="目标 ID" width="110">
            <template #default="{ row }: { row: OperationLogVO }">
              <span class="mono">{{ row.targetId || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="detail" label="详情" min-width="260" show-overflow-tooltip />
          <el-table-column prop="ip" label="IP" width="150">
            <template #default="{ row }: { row: OperationLogVO }">
              <span class="mono">{{ row.ip || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="170">
            <template #default="{ row }: { row: OperationLogVO }">
              <span class="text-muted nowrap">
                {{ (row.createdAt || '').replace('T', ' ') || '—' }}
              </span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无操作日志" :image-size="72" />
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
            @size-change="onSizeChange"
          />
        </div>
      </PageState>
    </section>
  </div>
</template>
