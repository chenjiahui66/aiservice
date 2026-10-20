<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { auditProvider, fetchProviderDetail } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import {
  AUDIT_STATUS_LABEL,
  AUDIT_STATUS_TAG,
  ENABLED_LABEL,
  ENABLED_TAG
} from '@/constants/dict'
import type { ProviderListVO } from '@/types/admin'

const route = useRoute()
const router = useRouter()

const providerId = computed(() => Number(route.params.id))
const validId = computed(() => Number.isFinite(providerId.value) && providerId.value > 0)

const loading = ref(false)
const error = ref<string | null>(null)
const detail = ref<ProviderListVO | null>(null)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  approved: true as boolean,
  remark: '',
  /** '' = 不改动账号状态（后端 toggleEnabled=null），true/false 分别启用/停用。 */
  toggleEnabled: '' as '' | 'enable' | 'disable'
})

function toToggleEnabled(): boolean | undefined {
  if (form.toggleEnabled === 'enable') return true
  if (form.toggleEnabled === 'disable') return false
  return undefined
}

const rules: FormRules = {
  approved: [{ required: true, message: '请选择审核结果', trigger: 'change' }],
  remark: [{ max: 500, message: '审核意见不能超过 500 字', trigger: 'blur' }]
}

async function load(): Promise<void> {
  if (!validId.value) {
    error.value = '服务者 ID 无效。'
    return
  }
  loading.value = true
  error.value = null
  try {
    detail.value = await fetchProviderDetail(providerId.value)
  } catch {
    detail.value = null
    error.value = '服务者详情加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !detail.value) return

  submitting.value = true
  try {
    const updated = await auditProvider(detail.value.id, {
      approved: form.approved,
      remark: form.remark,
      toggleEnabled: toToggleEnabled()
    })
    detail.value = updated
    ElMessage.success('审核已提交')
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">服务者审核详情</h2>
        <p class="page__desc">
          审核结论会写入服务者的 auditStatus，并记录到操作日志。审核通过会同时开启该服务者的服务主页 ——
          客户扫码走的是推广码，主页没开的话客户只会看到「该服务主页已关闭」。服务者自己关掉主页的，可在「服务者状态管理」里重新开启。
        </p>
      </div>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <PageState :loading="loading" :error="error" :min-height="280" @retry="load">
      <template v-if="detail">
        <section class="panel">
          <h3 class="panel__title">基础资料</h3>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="服务者 ID">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="用户 ID">{{ detail.userId }}</el-descriptions-item>
            <el-descriptions-item label="姓名">{{ detail.realName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ detail.phone || '—' }}</el-descriptions-item>
            <el-descriptions-item label="服务区域">{{ detail.serviceArea || '—' }}</el-descriptions-item>
            <el-descriptions-item label="推广码">
              <span class="mono">{{ detail.referralCode || '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="累计订单">{{ detail.orderCount }}</el-descriptions-item>
            <el-descriptions-item label="服务客户">{{ detail.customerCount }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">
              {{ (detail.createdAt || '').replace('T', ' ') || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="审核时间">
              {{ (detail.auditedAt || '').replace('T', ' ') || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="审核状态">
              <el-tag
                v-if="detail.auditStatus"
                size="small"
                :type="AUDIT_STATUS_TAG[detail.auditStatus]"
              >
                {{ detail.auditStatusLabel || AUDIT_STATUS_LABEL[detail.auditStatus] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </el-descriptions-item>
            <el-descriptions-item label="启停状态">
              <el-tag v-if="detail.enabled" size="small" :type="ENABLED_TAG[detail.enabled]">
                {{ ENABLED_LABEL[detail.enabled] }}
              </el-tag>
              <span v-else class="text-muted">—</span>
            </el-descriptions-item>
            <el-descriptions-item label="服务主页">
              <el-tag v-if="detail.pageEnabled" size="small" type="success">开放中</el-tag>
              <el-tag v-else size="small" type="info">已关闭</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="panel">
          <h3 class="panel__title">审核操作</h3>
          <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
            <el-form-item label="审核结果" prop="approved">
              <el-radio-group v-model="form.approved">
                <el-radio :value="true">通过</el-radio>
                <el-radio :value="false">驳回</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="审核意见" prop="remark">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit
                placeholder="记录审核依据，会写入操作日志"
              />
            </el-form-item>
            <el-form-item label="账号状态">
              <el-radio-group v-model="form.toggleEnabled">
                <el-radio value="">不改动</el-radio>
                <el-radio value="enable">同步启用</el-radio>
                <el-radio value="disable">同步停用</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="onSubmit">
                提交审核
              </el-button>
            </el-form-item>
          </el-form>
        </section>
      </template>
    </PageState>
  </div>
</template>
