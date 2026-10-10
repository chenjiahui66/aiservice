<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchServiceItems, updateServiceItem } from '@/api/admin'
import PageState from '@/components/PageState.vue'
import type { ServiceItemVO } from '@/types/admin'

/**
 * 服务主页模板配置。
 *
 * 平台侧可配置的主页模板即服务项目下的 formFields（主页表单字段模板）与
 * bookingRules（预约时段规则模板）——二者由后端以 JSON 字符串下发，
 * 服务者主页按其渲染。这里提供校验、格式化与回写。
 */

interface FieldNode {
  key?: unknown
  type?: unknown
  label?: unknown
}

const loading = ref(false)
const error = ref<string | null>(null)
const items = ref<ServiceItemVO[]>([])

const activeId = ref<number | null>(null)
const formFieldsText = ref('')
const bookingRulesText = ref('')
const saving = ref(false)
const formFieldsError = ref<string | null>(null)
const bookingRulesError = ref<string | null>(null)

const activeItem = computed(
  () => items.value.find((i) => i.id === activeId.value) ?? null
)

/** 统计主页表单字段数量，用于给配置一个直观概览。 */
const fieldSummary = computed(() => {
  const raw = formFieldsText.value.trim()
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.length
  } catch {
    return null
  }
})

function validateJson(text: string, label: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return `${label}不能为空`
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed === null || typeof parsed !== 'object') {
      return `${label}必须是 JSON 对象或数组`
    }
    return null
  } catch (e) {
    return `${label}JSON 解析失败：${e instanceof Error ? e.message : '格式错误'}`
  }
}

function format(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    items.value = await fetchServiceItems()
    if (activeId.value === null && items.value.length > 0) {
      activeId.value = items.value[0].id
    }
  } catch {
    items.value = []
    error.value = '主页模板加载失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

watch(activeItem, (item) => {
  formFieldsText.value = item?.formFields ?? ''
  bookingRulesText.value = item?.bookingRules ?? ''
  formFieldsError.value = null
  bookingRulesError.value = null
})

function onFormat(): void {
  if (validateJson(formFieldsText.value, '表单字段') === null) {
    formFieldsText.value = format(formFieldsText.value)
  }
  if (validateJson(bookingRulesText.value, '预约规则') === null) {
    bookingRulesText.value = format(bookingRulesText.value)
  }
}

async function onSave(): Promise<void> {
  const item = activeItem.value
  if (!item) return

  formFieldsError.value = validateJson(formFieldsText.value, '表单字段')
  bookingRulesError.value = validateJson(bookingRulesText.value, '预约规则')
  if (formFieldsError.value || bookingRulesError.value) {
    ElMessage.error('模板 JSON 校验未通过，请先修正')
    return
  }

  saving.value = true
  try {
    const updated = await updateServiceItem(item.id, {
      formFields: formFieldsText.value,
      bookingRules: bookingRulesText.value
    })
    const idx = items.value.findIndex((i) => i.id === updated.id)
    if (idx >= 0) items.value.splice(idx, 1, updated)
    ElMessage.success('主页模板已保存')
  } catch {
    // 错误提示由拦截器统一处理
  } finally {
    saving.value = false
  }
}

/** 仅用于提示：formFields 首项字段名，帮助管理员确认模板是否被正确读取。 */
function firstFieldKey(): string | null {
  const raw = formFieldsText.value.trim()
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const head = parsed[0] as FieldNode
    return typeof head.key === 'string' ? head.key : null
  } catch {
    return null
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div>
        <h2 class="page__title">服务主页模板配置</h2>
        <p class="page__desc">
          配置服务主页的表单字段模板（formFields）与预约时段规则（bookingRules）。保存后服务者主页按新模板渲染。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <PageState :loading="loading" :error="error" :min-height="420" @retry="load">
      <div class="tpl">
        <aside class="panel tpl__side">
          <h3 class="panel__title">服务项目</h3>
          <el-empty v-if="items.length === 0" description="暂无服务项目" :image-size="60" />
          <ul v-else class="tpl__list">
            <li
              v-for="item in items"
              :key="item.id"
              class="tpl__item"
              :class="{ 'is-active': item.id === activeId }"
              @click="activeId = item.id"
            >
              <span class="tpl__item-name">{{ item.name || `模板 #${item.id}` }}</span>
              <span class="tpl__item-meta">{{ item.unitDesc || '未设置单位' }}</span>
            </li>
          </ul>
        </aside>

        <section class="panel tpl__main">
          <template v-if="activeItem">
            <h3 class="panel__title">
              {{ activeItem.name || `模板 #${activeItem.id}` }}
              <span class="text-muted" style="font-weight: 400; font-size: 12px">
                <template v-if="fieldSummary !== null">
                  共 {{ fieldSummary }} 个表单字段<template v-if="firstFieldKey()">，首个字段 {{ firstFieldKey() }}</template>
                </template>
              </span>
            </h3>

            <el-form label-width="120px">
              <el-form-item
                label="表单字段模板"
                :error="formFieldsError"
                required
              >
                <el-input
                  v-model="formFieldsText"
                  type="textarea"
                  :rows="14"
                  class="mono"
                  spellcheck="false"
                  placeholder='[{"key":"customerName","type":"text","label":"客户称呼","required":true}]'
                />
              </el-form-item>

              <el-form-item label="预约规则模板" :error="bookingRulesError" required>
                <el-input
                  v-model="bookingRulesText"
                  type="textarea"
                  :rows="8"
                  class="mono"
                  spellcheck="false"
                  placeholder='{"advanceDays":7,"slots":["09:00-11:00"]}'
                />
              </el-form-item>

              <el-form-item>
                <el-button @click="onFormat">格式化 JSON</el-button>
                <el-button type="primary" :loading="saving" @click="onSave">
                  保存模板
                </el-button>
              </el-form-item>
            </el-form>
          </template>

          <el-empty v-else description="请先在「服务项目管理」中创建服务项目" />
        </section>
      </div>
    </PageState>
  </div>
</template>

<style scoped>
.tpl {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 14px;
  align-items: start;
}

.tpl__side {
  padding: 14px;
}

.tpl__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tpl__item {
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tpl__item:hover {
  background: #f5f7fa;
}

.tpl__item.is-active {
  background: var(--brand-soft);
}

.tpl__item-name {
  font-size: 13.5px;
  color: var(--text);
}

.tpl__item-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.tpl__main {
  min-width: 0;
}

:deep(.mono textarea) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .tpl {
    grid-template-columns: 1fr;
  }
}
</style>
