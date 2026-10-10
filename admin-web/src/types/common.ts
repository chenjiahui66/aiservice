/** 通用响应包装，与后端 com.neighborhood.service.common.Result 对齐。 */
export interface ApiResult<T> {
  code: number
  message: string
  data: T
  success: boolean
}

/** 分页结果，与后端 com.neighborhood.service.common.PageResult 对齐。 */
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
  pages: number
}

/** axios 查询参数取值范围。undefined / null 会被 axios 自动剔除，不会拼进 query。 */
export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>
