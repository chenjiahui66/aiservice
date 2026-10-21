import { request } from '@/utils/request'
import type { FeedbackRequest, FeedbackResult } from '@/types/domain'

/**
 * 提交意见反馈（功能意见箱 / 投诉 / 违规举报）。
 *
 * ⚠️ 接口契约说明（重要）：
 * 当前后端 `complaints` 表与 `GET /api/admin/complaints`、`POST /api/admin/complaints/{id}/handle`
 * 都已存在，管理后台也已完成展示与处理；**唯独缺少用户侧提交入口**。
 * 本函数按下列契约实现，后端补上后即可直接联通，无需改动前端其它代码：
 *
 *   POST /api/public/feedback
 *   权限：匿名（若请求头带有效 provider token，后端可据此填 provider_id）
 *   请求：{ type, content, customerName?, customerPhone?, referralCode?, privacyAccepted, policyVersion }
 *   响应：{ id, status: 'PENDING', statusLabel: '待处理', createdAt }
 *
 * ⚠️ privacyAccepted / policyVersion 是合规留证字段：反馈里可能带称呼与电话，
 *   属于个人信息，服务端强制要求明示同意后才受理。
 *
 * 字段与 complaints 表列一一对应，后端实现就是一次 insert。
 * 若最终路径或字段名不同，只需改本文件，页面无需改动。
 */
export function submitFeedback(data: FeedbackRequest) {
  return request<FeedbackResult>({
    url: '/api/public/feedback',
    method: 'POST',
    data: data as unknown as Record<string, unknown>,
    // 登录了就把 token 带上（后端据此填 provider_id），未登录也能匿名提交
    auth: true,
    silent: true
  })
}
