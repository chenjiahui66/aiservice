# API 接口文档

> 权威来源：后端运行时导出的 OpenAPI。启动后访问 <http://localhost:8080/doc.html> 可交互查看。
> 本文档是给前端与联调用的速查表，**与代码不一致时以 `/v3/api-docs` 为准**。

Base URL：`http://localhost:8080`

---

## 通用约定

### 响应结构

所有接口返回同一结构：

```json
{ "code": 0, "message": "操作成功", "data": { } }
```

- `code = 0` 表示成功；非 0 为业务错误码。
- 业务失败统一返回 **HTTP 200** + 非 0 `code`。
- 仅两处使用非 200：**未认证 HTTP 401**、**跨身份分区越权 HTTP 403**，body 结构一致。

### 认证

```
Authorization: Bearer <token>
```

- 服务者端 `/api/provider/**`、`/api/auth/provider/*` → 服务者 token
- 管理端 `/api/admin/**`、`/api/auth/admin/login` → 管理员 token
- 两端由**不同签名密钥 + 不同 issuer** 签发，token 无法跨端使用。

### 分页

```json
{ "records": [], "total": 0, "page": 1, "size": 20, "pages": 0 }
```

### 业务错误码

| 区间 | 含义 | 常用码 |
|---|---|---|
| 400xx | 通用 | `40000` 参数错误 |
| 401xx | 认证 | `40100` 未登录、`40101` token 无效、`40102` 账号密码错、`40103` 账号停用 |
| 403xx | 权限 | `40300` 无权访问 |
| 410xx | 推广码 / 服务者 | `41001` 码不存在、`41002` 码停用、`41005` 未过审、`41006` 审核驳回、`41007` 服务者已停用、`41008` 主页已关闭 |
| 420xx | 订单 | `42001` 订单不存在、`42002` 状态不允许、`42003` 流转非法、`42004` 时间段不可用、`42005` 超预约范围 |
| 430xx | 客户 | `43001` 客户不存在 |
| 440xx | 服务项目 | `44001` 不存在、`44002` 已停用 |
| 450xx | 微信 | `45002` 小程序码生成失败 |

---

## 一、认证 `/api/auth`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/auth/provider/register` | 匿名 | 服务者注册，注册后默认「待审核」 |
| POST | `/api/auth/provider/login` | 匿名 | 服务者登录 |
| POST | `/api/auth/admin/login` | 匿名 | 管理员登录 |

**注册请求**
```json
{ "phone": "13800138000", "password": "test123456", "realName": "张师傅", "serviceArea": "阳光小区" }
```

**登录响应**
```json
{
  "token": "eyJ...", "tokenType": "Bearer",
  "providerId": 1, "displayName": "张师傅", "username": "13800138000",
  "auditStatus": "PENDING", "auditRemark": null, "expiresInSeconds": 604800
}
```

> 管理员登录响应中 `providerId` / `auditStatus` 为 `null`。

---

## 二、公开接口（客户扫码）`/api/public`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/public/provider/home?referralCode=xxx` | 匿名 | 按推广码查主页 |
| POST | `/api/public/bookings` | 匿名 | 提交预约 |

**主页响应 `ProviderHomeVO`**
```json
{
  "referralCode": "k7Rt2mQx9Lp4BdWn",
  "providerId": 1,
  "displayName": "张师傅 · 上门代扔垃圾",
  "avatarUrl": null, "intro": "...", "serviceArea": "阳光小区",
  "availableTime": "每天 9:00-18:00", "priceDesc": "10~30 元/次",
  "serviceRules": "...", "contactVisible": true, "contactPhone": "13800138000",
  "serviceItems": [
    { "id": 1, "name": "上门代扔垃圾", "description": "...", "iconUrl": null,
      "unitDesc": "次", "priceDesc": "10~30 元/次",
      "formFields": "[{\"key\":\"customerName\",...}]",
      "bookingRules": "{\"advanceDays\":7,\"slots\":[...]}" }
  ],
  "disclaimer": "张师傅 为个人服务者，本平台仅提供预约工具……"
}
```

> `formFields` / `bookingRules` 是 **JSON 字符串**，前端需 `JSON.parse` 后按配置渲染表单。
> `contactVisible=false` 时 `contactPhone` 为 `null`（后端已脱敏，不下发号码）。

**预约请求 `BookingRequest`** —— ⚠️ **没有 providerId 字段**，订单归属由后端依据推广码反查。

```json
{
  "referralCode": "k7Rt2mQx9Lp4BdWn",
  "serviceItemId": 1,
  "customerName": "客户甲",
  "customerPhone": "13511110001",
  "community": "阳光小区",
  "address": "阳光小区 3 栋 501",
  "bookingDate": "2026-10-12",
  "bookingSlot": "09:00-11:00",
  "serviceDesc": "两袋生活垃圾",
  "remark": "放在门口即可",
  "privacyAccepted": true,
  "channel": "WECHAT_MOMENTS"
}
```

---

## 三、服务者端 `/api/provider`（需服务者 token）

### 资料与主页

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/PUT | `/api/provider/profile` | 我的资料（含 `auditStatus` / `auditRemark`） |
| GET/PUT | `/api/provider/page` | 我的服务主页配置 |
| GET | `/api/provider/service-items` | 我可提供的服务项目 |

### 推广中心

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/provider/referral` | 我的专属推广码信息 |
| POST | `/api/provider/referral/qr` | 生成 / 重新生成小程序码 |
| GET | `/api/provider/referral/qr/{imageKey}` | 取二维码 PNG |
| GET | `/api/provider/referral/stats` | 推广统计 |

**`ReferralInfoVO`**
```json
{
  "referralCodeId": 1,
  "referralCode": "k7Rt2mQx9Lp4BdWn",
  "status": "ENABLED",
  "qrImageKey": "k7Rt2mQx9Lp4BdWn_430_dev.png",
  "qrImageUrl": "/api/provider/referral/qr/k7Rt2mQx9Lp4BdWn_430_dev.png",
  "qrMode": "DEV",
  "qrModeLabel": "开发降级二维码（非真实小程序码）",
  "qrNotice": "⚠️ 当前为开发降级模式，这不是真实微信小程序码，请勿对外使用……",
  "qrScenePage": "pages/provider/index",
  "visitCount": 3, "bookingCount": 1,
  "shareText": "张师傅 的上门服务主页……"
}
```

> 🔴 **`qrMode === 'DEV'` 时前端必须展示 `qrNotice` 警示**，不得当作真实小程序码使用。

`POST /api/provider/referral/qr` 响应：
```json
{ "imageKey": "...", "mode": "DEV", "notice": "...", "imageUrl": "/api/provider/referral/qr/..." }
```

### 今日工作台账

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/provider/board?date=2026-10-12` | 省略 date 为今天；支持未来日期 |

**`BoardVO`**
```json
{
  "date": "2026-10-12",
  "pendingConfirmCount": 1, "pendingServiceCount": 2,
  "completedCount": 3, "cancelledCount": 0, "totalCount": 6,
  "tasks": [ /* OrderVO[]，按 bookingSlot 升序 */ ]
}
```

### 订单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/provider/orders` | 列表。查询参数 `dateFrom` `dateTo` `status` `keyword` `serviceItemId` `page` `size` |
| GET | `/api/provider/orders/{id}` | 详情，含 `logs` 流转记录 |
| POST | `/api/provider/orders` | 手动记单 |
| POST | `/api/provider/orders/{id}/confirm` | 待确认 → 已预约 |
| POST | `/api/provider/orders/{id}/start` | 已预约 → 服务中 |
| POST | `/api/provider/orders/{id}/complete` | 服务中 → 已完成 |
| POST | `/api/provider/orders/{id}/cancel` | 取消，必填 `{ "reason": "..." }` |
| PUT | `/api/provider/orders/{id}/note` | 更新服务备注 `{ "providerNote": "..." }` |

**`OrderVO`**
```json
{
  "id": 12, "orderNo": "NB20261012103000A1B2C3",
  "customerId": 3, "customerName": "客户甲", "customerPhone": "13511110001",
  "community": "阳光小区", "address": "阳光小区 3 栋 501",
  "serviceName": "上门代扔垃圾", "quantity": 1,
  "serviceDesc": "两袋生活垃圾", "customerRemark": "", "providerNote": null,
  "bookingDate": "2026-10-12", "bookingSlot": "09:00-11:00",
  "status": "CONFIRMED", "statusLabel": "已预约",
  "source": "QR_CODE", "channel": "WECHAT_MOMENTS",
  "cancelReason": null,
  "confirmedAt": "2026-10-11 09:00:00", "startedAt": null,
  "completedAt": null, "createdAt": "2026-10-11 08:59:00",
  "logs": [
    { "action": "CREATE", "actionLabel": "创建订单", "fromStatus": null,
      "toStatus": "PENDING_CONFIRM", "remark": "客户通过推广码提交预约",
      "operatorType": "CUSTOMER", "operatorName": "客户甲",
      "createdAt": "2026-10-11 08:59:00" }
  ]
}
```

**订单状态机**
```
待确认 PENDING_CONFIRM ──► 已预约 CONFIRMED ──► 服务中 SERVING ──► 已完成 COMPLETED
     │                        │                    │
     └────────────────────────┴────────────────────┴──────────► 已取消 CANCELLED
```
非法流转后端返回 `42003`；已完成/已取消为终态。

**手动记单请求**
```json
{
  "customerName": "客户丁", "customerPhone": "13511110004",
  "community": "阳光小区", "address": "3 栋 502",
  "serviceItemId": 1, "bookingDate": "2026-10-12",
  "bookingSlot": "14:00-16:00", "quantity": 1,
  "serviceDesc": "一袋", "confirmed": true
}
```

### 客户台账

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/provider/customers` | 列表，参数 `keyword` `page` `size` |
| GET | `/api/provider/customers/{id}` | 详情，含历史 `orders` |
| PUT | `/api/provider/customers/{id}` | 更新资料与 `nextServiceAt` 复购计划 |

---

## 四、平台管理端 `/api/admin`（需管理员 token）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/dashboard` | 平台概览，数字均来自真实统计 |
| GET | `/api/admin/providers` | 服务者列表，参数 `keyword` `auditStatus` `enabled` |
| GET | `/api/admin/providers/{id}` | 服务者详情 |
| POST | `/api/admin/providers/{id}/audit` | 审核 `{ "approved": true, "remark": "..." }` |
| POST | `/api/admin/providers/{id}/status` | 启停 `{ "enabled": false, "reason": "..." }` |
| GET/POST | `/api/admin/service-items` | 服务项目模板列表 / 新增 |
| PUT | `/api/admin/service-items/{id}` | 更新模板 |
| GET | `/api/admin/orders` | 全平台订单（**只读**） |
| GET | `/api/admin/complaints` | 投诉 / 反馈 / 违规 |
| POST | `/api/admin/complaints/{id}/handle` | 处理投诉 |
| GET | `/api/admin/logs` | 操作日志 |
| GET | `/api/admin/settings` | 系统设置 |
| PUT | `/api/admin/settings/{key}?value=xxx` | 更新设置 |

**`DashboardVO`**（全部为真实 count，无固定值）
```json
{
  "totalProviders": 5, "pendingAuditProviders": 1, "approvedProviders": 4, "disabledProviders": 0,
  "totalUsers": 5, "totalOrders": 12,
  "pendingConfirmOrders": 2, "servingOrders": 1, "completedOrders": 8, "cancelledOrders": 1,
  "totalCustomers": 9, "pendingComplaints": 0, "totalVisits": 17,
  "orderTrend": [ { "date": "2026-10-06", "count": 2 } ],
  "wechatCodeMode": "DEV"
}
```

---

## 五、平台能力限制说明

1. **小程序码依赖微信官方接口**，属于微信专属能力。跨端（H5/其它小程序）访问时不假设可直接打开微信小程序，需另行提供落地页方案。
2. `formFields` / `bookingRules` 当前以 JSON 字符串下发，尚未提供可视化表单设计器；数据结构已为后续扩展预留。
3. 首版**不接入支付**，因此没有支付订单、没有「已支付」状态，也不存在退款相关接口。
4. 订单的归属、状态流转、客户可见范围**全部由后端裁决**，前端传任何 `providerId` 都不生效。