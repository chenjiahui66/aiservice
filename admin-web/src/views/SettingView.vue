<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchSettings, updateSetting } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import type { SystemSetting } from '@/types/admin'

const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<SystemSetting[]>([])

const dialog = ref({
  visible: false,
  submitting: false,
  target: null as SystemSetting | null,
  value: ''
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    rows.value = await fetchSettings()
  } catch {
    rows.value = []
    error.value = '系统设置加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function openEdit(row: SystemSetting): void {
  dialog.value.target = row
  dialog.value.value = row.settingValue ?? ''
  dialog.value.visible = true
}

async function onSubmit(): Promise<void> {
  const target = dialog.value.target
  if (!target) return

  dialog.value.submitting = true
  try {
    const updated = await updateSetting(target.settingKey, dialog.value.value)
    const idx = rows.value.findIndex((r) => r.settingKey === updated.settingKey)
    if (idx >= 0) rows.value.splice(idx, 1, updated)
    ElMessage.success('设置已保存')
    dialog.value.visible = false
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    dialog.value.submitting = false
  }
}

/** 仅对布尔型取值给出切换按钮，其余按文本输入，避免误改。 */
function isBooleanValue(value: string): boolean {
  return value === 'true' || value === 'false'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">系统基础设置</h2>
        <p class="page__desc">
          平台级运行参数。修改会立即生效并记录到操作日志，请谨慎调整标注合规要求的配置项。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <section class="panel">
      <PageState :loading="loading" :error="error" :min-height="280" @retry="load">
        <el-table :data="rows" size="small" stripe style="width: 100%">
          <el-table-column label="配置项" min-width="240">
            <template #default="{ row }: { row: SystemSetting }">
              <span class="mono">{{ row.settingKey }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="300" show-overflow-tooltip />
          <el-table-column label="当前值" min-width="180">
            <template #default="{ row }: { row: SystemSetting }">
              <el-tag
                v-if="row.settingValue === 'true'"
                size="small"
                type="success"
                effect="plain"
              >
                true
              </el-tag>
              <el-tag
                v-else-if="row.settingValue === 'false'"
                size="small"
                type="info"
                effect="plain"
              >
                false
              </el-tag>
              <span v-else class="mono">{{ row.settingValue ?? '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="170">
            <template #default="{ row }: { row: SystemSetting }">
              <span class="text-muted nowrap">
                {{ (row.updatedAt || '').replace('T', ' ') || '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }: { row: SystemSetting }">
              <el-button link type="primary" @click="openEdit(row)">修改</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无系统设置项" :image-size="72" />
          </template>
        </el-table>
      </PageState>
    </section>

    <el-dialog v-model="dialog.visible" title="修改设置" width="460px">
      <template v-if="dialog.target">
        <el-descriptions :column="1" border size="small" class="set__desc">
          <el-descriptions-item label="配置项">
            <span class="mono">{{ dialog.target.settingKey }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="说明">
            {{ dialog.target.description || '—' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-form label-width="70px" class="set__form">
          <el-form-item label="取值">
            <el-radio-group
              v-if="isBooleanValue(dialog.target.settingValue ?? '')"
              v-model="dialog.value"
            >
              <el-radio value="true">true</el-radio>
              <el-radio value="false">false</el-radio>
            </el-radio-group>
            <el-input v-else v-model="dialog.value" placeholder="请输入新的取值" />
          </el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="onSubmit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.set__desc {
  margin-bottom: 14px;
}

.set__form {
  margin-bottom: 4px;
}
</style>
