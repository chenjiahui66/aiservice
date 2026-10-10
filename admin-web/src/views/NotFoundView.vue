<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="nf">
    <el-result icon="warning" title="404" sub-title="页面不存在或已被移除">
      <template #extra>
        <el-button type="primary" @click="router.replace('/dashboard')">返回概览</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.nf {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
