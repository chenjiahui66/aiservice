import Taro from '@tarojs/taro'

/**
 * token 存取。
 *
 * 为什么单独成文件（而不是留在 utils/request.ts 里）：
 *   请求层需要在「登录失效」时同步清掉 zustand 里的登录态，
 *   而 store/auth.ts 又需要读 token —— 如果两边互相 import 就成了循环依赖。
 *   把最底层的 token 存取抽出来，请求层和 store 都只依赖它，环就没了。
 */

export const TOKEN_STORAGE_KEY = 'nsm_token'

export function getToken(): string {
  try {
    return Taro.getStorageSync(TOKEN_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_STORAGE_KEY, token)
  } catch {
    /* 存储失败不阻断业务流程 */
  }
}

export function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
