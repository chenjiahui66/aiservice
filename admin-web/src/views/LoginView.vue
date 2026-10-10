<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({ username: '', password: '' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入管理员账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await user.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = route.query.redirect
    const target = typeof redirect === 'string' && redirect ? redirect : '/dashboard'
    await router.replace(target)
  } catch {
    // 失败提示统一由 axios 拦截器输出，这里只保持停留当前页。
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <div class="login__brand">
        <span class="login__mark">邻</span>
        <div>
          <h1 class="login__title">邻里服务平台</h1>
          <p class="login__sub">平台管理后台</p>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="管理员账号" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          class="login__submit"
          size="large"
          :loading="submitting"
          @click="onSubmit"
        >
          登 录
        </el-button>
      </el-form>

      <p class="login__tip">账号由平台统一分配，登录态基于管理员 token 生效。</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sidebar-bg);
}

.login__card {
  width: 380px;
  background: #fff;
  border-radius: 10px;
  padding: 32px 34px 24px;
}

.login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.login__mark {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: var(--brand);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  font-weight: 600;
}

.login__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.login__sub {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-muted);
}

.login__submit {
  width: 100%;
}

.login__tip {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
</style>
