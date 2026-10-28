<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createServiceItem, fetchServiceItems, updateServiceItem } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import { ENABLED_LABEL, ENABLED_TAG } from '@/constants/dict'
import type { ServiceItemSaveRequest, ServiceItemVO } from '@/types/admin'

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<ServiceItemVO[]>([])

const dialog = reactive({
  visible: false,
  submitting: false,
  editingId: null as number | null
})

const formRef = ref<FormInstance>()

/**
 * 服务项目表单。
 *
 * ⚠️ formFields / bookingRules 是库表里的 **JSON 列**，提交空串会让后端直接报
 * 「Invalid JSON text: The document is empty.」。这两个字段归「服务主页模板配置」页维护，
 * 这里既不展示也不提交，省得再踩 JSON 列的坑。
 */
type ServiceItemForm = {
  name: string
  description: string
  iconUrl: string
  unitDesc: string
  priceDesc: string
  notes: string
  sortOrder: number
  enabled: boolean
}

const form = reactive<ServiceItemForm>({
  name: '',
  description: '',
  iconUrl: '',
  unitDesc: '',
  priceDesc: '',
  notes: '',
  sortOrder: 0,
  enabled: true
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入服务名称', trigger: 'blur' },
    { max: 50, message: '服务名称不能超过 50 字', trigger: 'blur' }
  ],
  description: [{ max: 500, message: '描述不能超过 500 字', trigger: 'blur' }],
  priceDesc: [{ max: 100, message: '价格说明不能超过 100 字', trigger: 'blur' }],
  unitDesc: [{ max: 50, message: '单位不能超过 50 字', trigger: 'blur' }]
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    rows.value = await fetchServiceItems()
  } catch {
    rows.value = []
    error.value = '服务项目加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  dialog.editingId = null
  Object.assign(form, {
    name: '',
    description: '',
    iconUrl: '',
    unitDesc: '',
    priceDesc: '',
    notes: '',
    sortOrder: 0,
    enabled: true
  })
  dialog.visible = true
}

function openEdit(row: ServiceItemVO): void {
  dialog.editingId = row.id
  Object.assign(form, {
    name: row.name ?? '',
    description: row.description ?? '',
    iconUrl: row.iconUrl ?? '',
    unitDesc: row.unitDesc ?? '',
    priceDesc: row.priceDesc ?? '',
    notes: row.notes ?? '',
    sortOrder: row.sortOrder ?? 0,
    enabled: row.enabled !== 'DISABLED'
  })
  dialog.visible = true
}

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // 只提交本表单拥有的字段：JSON 列（formFields / bookingRules）不碰，
  // 交由「服务主页模板配置」页维护，避免把 JSON 字段提交成空串。
  const payload: ServiceItemSaveRequest = {
    name: form.name.trim(),
    description: form.description,
    iconUrl: form.iconUrl,
    unitDesc: form.unitDesc,
    priceDesc: form.priceDesc,
    notes: form.notes,
    sortOrder: form.sortOrder,
    enabled: form.enabled
  }

  dialog.submitting = true
  try {
    if (dialog.editingId === null) {
      await createServiceItem(payload)
      ElMessage.success('服务项目已创建')
    } else {
      await updateServiceItem(dialog.editingId, payload)
      ElMessage.success('服务项目已更新')
    }
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
        <h2 class="page__title">服务项目管理</h2>
        <p class="page__desc">
          平台级服务项目模板。服务者在主页中引用这些模板；主页表单与预约规则模板请到「服务主页模板配置」维护。
        </p>
      </div>
      <div>
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="openCreate">新增服务项目</el-button>
      </div>
    </div>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="240" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="name" label="服务名称" min-width="130" />
          <el-table-column prop="description" label="描述" min-width="240" show-overflow-tooltip />
          <el-table-column prop="unitDesc" label="单位" width="90">
            <template #default="{ row }: { row: ServiceItemVO }">{{ row.unitDesc || '—' }}</template>
          </el-table-column>
          <el-table-column prop="priceDesc" label="价格说明" min-width="170" show-overflow-tooltip />
          <el-table-column prop="sortOrder" label="排序" width="70" align="right" />
          <el-table-column label="状态" width="96">
            <template #default="{ row }: { row: ServiceItemVO }">
              <el-tag v-if="row.enabled" size="small" :type="ENABLED_TAG[row.enabled]">
                {{ ENABLED_LABEL[row.enabled] }}
              </el-tag>
              <el-tag v-else size="small" type="info">已停用</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }: { row: ServiceItemVO }">
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="尚未配置任何服务项目" :image-size="72" />
          </template>
        </el-table>
      </PageState>
    </section>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.editingId === null ? '新增服务项目' : '编辑服务项目'"
      width="620px"
      top="6vh"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="服务名称" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="如：上门代扔垃圾" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="说明服务内容与不含项"
          />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="单位" prop="unitDesc">
              <el-input v-model="form.unitDesc" maxlength="50" placeholder="如：次" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="form.sortOrder" :min="0" :max="9999" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="价格说明" prop="priceDesc">
          <el-input v-model="form.priceDesc" maxlength="100" placeholder="如：参考价 10~30 元/次" />
        </el-form-item>
        <el-form-item label="图标地址" prop="iconUrl">
          <el-input v-model="form.iconUrl" maxlength="500" placeholder="可选，图片 URL" />
        </el-form-item>
        <el-form-item label="备注" prop="notes">
          <el-input v-model="form.notes" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
