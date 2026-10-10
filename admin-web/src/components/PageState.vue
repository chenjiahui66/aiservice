<script setup lang="ts">
/**
 * 列表页三态容器：加载中 / 请求失败 / 正常内容。
 * 空数据由各表格的 el-table #empty 插槽呈现，保持表头可见。
 */
withDefaults(
  defineProps<{
    loading?: boolean
    error?: string | null
    minHeight?: number
  }>(),
  { loading: false, error: null, minHeight: 160 }
)

defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <div v-loading="loading" :style="{ minHeight: minHeight + 'px' }">
    <el-alert
      v-if="error"
      type="error"
      :title="error"
      show-icon
      :closable="false"
      class="page-state__error"
    >
      <template #default>
        <el-button type="primary" size="small" @click="$emit('retry')">
          重新加载
        </el-button>
      </template>
    </el-alert>
    <slot v-else />
  </div>
</template>

<style scoped>
.page-state__error {
  margin: 4px 0;
}
</style>
