import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminLogin } from '@/api/auth'
import { tokenStorage } from '@/utils/request'
import type { LoginResponse } from '@/types/admin'

export const useUserStore = defineStore('admin-user', () => {
  const token = ref<string | null>(tokenStorage.get())
  const username = ref<string>('')
  const displayName = ref<string>('')
  const expiresInSeconds = ref<number>(0)

  const isLoggedIn = computed(() => Boolean(token.value))
  const accountLabel = computed(() => displayName.value || username.value || '管理员')

  function applyLogin(data: LoginResponse): void {
    tokenStorage.set(data.token)
    token.value = data.token
    username.value = data.username
    displayName.value = data.displayName ?? ''
    expiresInSeconds.value = data.expiresInSeconds
  }

  async function login(usernameInput: string, password: string): Promise<void> {
    const data = await adminLogin({ username: usernameInput, password })
    applyLogin(data)
  }

  function logout(): void {
    tokenStorage.clear()
    token.value = null
    username.value = ''
    displayName.value = ''
    expiresInSeconds.value = 0
  }

  return { token, username, displayName, expiresInSeconds, isLoggedIn, accountLabel, login, logout }
})
