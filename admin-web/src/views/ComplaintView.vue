<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchComplaints, handleComplaint } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  COMPLAINT_STATUS_TAG,
  COMPLAINT_TYPE_LABEL
} from '@/constants/dict'
import type {
  ComplaintRecord,
  ComplaintStatus,
  ComplaintType
} from '@/types/admin'

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<ComplaintRecord[]>([])
const total = ref(0)

const query = reactive<{ status: ComplaintStatus | ''; page: number; size: number }>({
  status: '',
  page: 1,
  size: 20
})

const dialog = reactive({
  visible: false,
  submitting: false,
  target: null as ComplaintRecord | null,
  status: 'PROCESSING' as ComplaintStatus,
  remark: ''
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const page = await fetchComplaints({
      status: query.status,
      page: query.page,
      size: query.size
    })
    rows.value = page.records
    total.value = page.total
  } catch {
    rows.value = []
    total.value = 0
    error.value = '投诉列表加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function openHandle(row: ComplaintRecord): void {
  dialog.target = row
  dialog.status = row.status === 'PENDING' ? 'PROCESSING' : 'CLOSED'
  dialog.remark = ''
  dialog.visible = true
}

async function onSubmit(): Promise<void> {
  const target = dialog.target
  if (!target) return

  dialog.submitting = true
  try {
    await handleComplaint(target.id, dialog.status, dialog.remark)
    ElMessage.success('处理结果已保存')
    dialog.visible = false
    await load()
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    dialog.submitting = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">投诉与违规处理</h2>
        <p class="page__desc">
          汇总客户投诉、用户反馈与违规举报。处理动作会记录处理人、处理时间与备注，并写入操作日志。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <section class="panel">
      <div class="filter-bar">
        <el-select v-model="query.status" placeholder="处理状态" clearable @change="onSearch">
          <el-option
            v-for="o in COMPLAINT_STATUS_OPTIONS"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
        <el-button type="primary" @click="onSearch">查询</el-button>
      </div>
    </section>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="280" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }: { row: ComplaintRecord }">
              <el-tag size="small" effect="plain">
                {{ (row.type && COMPLAINT_TYPE_LABEL[row.type as ComplaintType]) || row.type || '—' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" min-width="100" />
          <el-table-column prop="customerPhone" label="手机号" width="120" />
          <el-table-column prop="providerId" label="服务者 ID" width="100" align="right">
            <template #default="{ row }: { row: ComplaintRecord }">{{ row.providerId ?? '—' }}</template>
          </el-table-column>
          <el-table-column prop="orderId" label="订单 ID" width="96" align="right">
            <template #default="{ row }: { row: ComplaintRecord }">{{ row.orderId ?? '—' }}</template>
          </el-table-column>
          <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <el-table-column label="状态" width="92">
            <template #default="{ row }: { row: ComplaintRecord }">
              <el-tag v-if="row.status" size="small" :type="COMPLAINT_STATUS_TAG[row.status]">
                {{ COMPLAINT_STATUS_LABEL[row.status] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="handleRemark" label="处理备注" min-width="160" show-overflow-tooltip />
          <el-table-column label="提交时间" width="160">
            <template #default="{ row }: { row: ComplaintRecord }">
              <span class="text-muted nowrap">
                {{ (row.createdAt || '').replace('T', ' ') || '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }: { row: ComplaintRecord }">
              <el-button link type="primary" @click="openHandle(row)">处理</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无投诉 / 反馈 / 违规记录" :image-size="72" />
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

    <el-dialog v-model="dialog.visible" title="处理投诉记录" width="520px">
      <el-descriptions v-if="dialog.target" :column="1" border size="small" class="cp__desc">
        <el-descriptions-item label="记录 ID">{{ dialog.target.id }}</el-descriptions-item>
        <el-descriptions-item label="客户">
          {{ dialog.target.customerName || '—' }} · {{ dialog.target.customerPhone || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="内容">
          {{ dialog.target.content || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          {{ dialog.target.status ? COMPLAINT_STATUS_LABEL[dialog.target.status] : '—' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form label-width="80px" class="cp__form">
        <el-form-item label="处理为">
          <el-select v-model="dialog.status" style="width: 100%">
            <el-option
              v-for="o in COMPLAINT_STATUS_OPTIONS"
              :key="o.value"
              :label="o.label"
              :value="o.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input
            v-model="dialog.remark"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="记录核实情况与处置结论"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="onSubmit">
          提交处理
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cp__desc {
  margin-bottom: 14px;
}

.cp__form {
  margin-bottom: 4px;
}
</style>
