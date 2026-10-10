# 邻里服务管家

多服务者上门服务管理系统。多个个人服务者共用同一个微信小程序，各自拥有独立的
服务主页与**专属推广二维码**；客户扫码进入对应服务者主页并提交预约，订单自动归属
该服务者，进入其今日工作台账与客户档案。

> 平台首期只提供工具：不代替服务者履约、不抽取佣金、不接入在线支付。
> 第一阶段以「上门代扔垃圾」为演示业务，但服务名称、表单字段、时间规则、价格说明
> 全部配置化，不与该业务强绑定。

---

## 当前进度

| 模块 | 目录 | 状态 |
|---|---|---|
| 后端核心闭环 | `backend/` | ✅ 编译通过、真实启动、50 项冒烟 + 25 项单元测试全绿 |
| 后台管理端 | `admin-web/` | ✅ Vue3+TS+Element Plus，11 个页面，`npm run build` 退出码 0，真实登录联调通过 |
| 微信小程序 | `miniapp/` | ✅ Taro4+React+TS，14 个页面，`npm run build:weapp` 退出码 0 |
| 数据库 | `sql/` | ✅ 12 张表已建，实体与表列双向校验一致 |
| 接口文档 | `docs/API.md` | ✅ 35 个接口，从运行中后端导出 |
| Docker 部署 | `deploy/` | ⚠️ 编排已写好，**未实际跑过**（本机 Docker 引擎未启动） |
| 上线资质清单 | `docs/上线前资质与审核清单.md` | ⚠️ 已列全，**结论全部待人工核实** |
| 测试 | `tests/` + `backend/src/test` | ✅ HTTP 冒烟 50 项 + JUnit 25 项 |

已跑通的核心链路：

```
管理员审核服务者 → 服务者生成专属推广码 → 客户扫码进入对应主页 → 提交预约
→ 订单归属后端反查确定 → 服务者台账看到订单 → 确认/开始/完成
→ 客户档案与复购计划更新 → 推广统计为真实计数 → 后台操作留痕
```

### 尚未验证的项（不粉饰）

- Docker 部署编排**未实际启动验证**——本机 Docker Desktop 引擎未运行。
- 小程序端**未在微信开发者工具中真机/模拟器运行过**，仅完成构建与逻辑层验证。
- 小程序码目前是 **DEV 降级码**（未配置 `WX_APP_ID`），真实小程序码链路未验证。
- 后台「服务主页模板配置」页**没有对应的后端管理接口**，当前基于 `service_items` 的
  `formFields` / `bookingRules` 实现，属于产品假设，需要你确认。
- 面向客户的**投诉提交入口**尚未实现（当前只有后台处理端）。

---

## 目录结构

```
aiservice/
├─ backend/            Spring Boot 3.3 + MyBatis-Plus + Spring Security + MySQL 8
├─ admin-web/          Vue 3 + TS + Vite + Element Plus + Pinia（后台管理端）
├─ miniapp/            Taro 4 + React + TS + TDesign + Zustand（微信小程序）
├─ deploy/             docker-compose / nginx / 环境变量示例
├─ sql/                schema.sql 建表、seed.sql 参考数据、后续迁移脚本
└─ docs/               API 文档、部署文档、测试用例、资质核查清单
```

---

## 数据库

```bash
mysql -u root -p < sql/schema.sql   # 建库建表
mysql -u root -p < sql/seed.sql     # 平台默认服务项目模板 + 系统设置
```

设计约定：

- 所有服务者业务数据表（`service_pages` / `service_items` / `referral_codes` /
  `customers` / `orders` / `order_logs` / `complaints`）一律带 `provider_id`，作为数据隔离维度。
- 统一 `created_at` / `updated_at` / `deleted`（逻辑删除）。
- `orders` 建有复合索引 `(provider_id, booking_date, status)`，直接支撑「今日工作台账」核心查询。
- `customers` 唯一键 `(provider_id, phone)`：同一手机号可在不同服务者下各存一份，
  符合「按服务者—客户关系维护」，且彼此不可见。

---

## 本地启动

### 1. 环境要求

| 依赖 | 版本 |
|---|---|
| JDK | 17+ |
| Maven | 3.9+ |
| Node.js | 20+ |
| MySQL | 8.0+ |

> ⚠️ 若 Maven 的 `platform encoding` 不是 UTF-8，务必确认 `backend/pom.xml` 中的
> `project.build.sourceEncoding` 为 UTF-8，否则中文源码与资源会乱码。

### 2. 配置环境变量

```bat
copy deploy\.env.example deploy\.env
```

`deploy\.env` 已被 `.gitignore` 忽略。必填项：

| 变量 | 说明 |
|---|---|
| `DB_USERNAME` / `DB_PASSWORD` | 应用账号（生产请用最小权限账号） |
| `JWT_PROVIDER_SECRET` | 服务者端签名密钥，≥32 字节 |
| `JWT_ADMIN_SECRET` | 管理员端签名密钥，≥32 字节，**必须与上面不同** |
| `WX_APP_ID` / `WX_APP_SECRET` | 微信小程序凭据，留空则小程序码走开发降级模式 |
| `ADMIN_PASSWORD` | 仅 dev profile，用于首次创建管理员账号 |

生成 JWT 密钥：`openssl rand -base64 48`

> 🔴 **任何脚本、代码、文档里都不要写密钥兜底默认值。**
> `application-prod.yml` 依赖 `${JWT_PROVIDER_SECRET:?}` 在缺配置时**启动失败**，
> 这是防止生产环境用上弱密钥的关键防线。若某个启动脚本先塞一个写死的默认值，
> 这道校验就会被架空——生产环境会悄悄用上公开可查的签名密钥。
> `scripts/start-backend.cmd` 因此在 `.env` 缺失或关键项为空时**直接拒绝启动**。

### 3. 启动后端

```bat
:: 首次先打包
cd backend && mvn -DskipTests package && cd ..

:: 启动（独立后台进程，日志在 backend/logs/app.log）
scripts\start-backend.cmd

:: 停止
scripts\stop-backend.cmd
```

开发时也可用 `scripts\run-local.cmd`（前台 Maven 运行，改代码需手动重启）。

接口文档：<http://localhost:8080/doc.html>

> ⚠️ **Windows 注意事项**：`.cmd` 脚本必须是 **CRLF 行尾**。若写成 LF，
> `cmd.exe` 会把整行拆成碎片执行，报出「文件名、目录名或卷标语法不正确」之类
> 与真实问题毫无关系的错误，很有误导性。

### 4. 运行测试

```bat
:: 单元测试
cd backend && mvn test

:: 实体 ↔ 表结构双向校验（需先启动 MySQL 并导入 schema）
node tests\check-entity-cols.mjs

:: 核心闭环冒烟测试（需后端已启动）
node tests\smoke.mjs
```

测试脚本同样**不内置凭据**，从环境变量读取（`DB_USERNAME` / `DB_PASSWORD` / `ADMIN_PASSWORD`）。

---

## 核心设计：服务者专属推广码

这是整个系统的第一优先功能，设计上做了以下硬约束：

1. **推广码不暴露自增 ID** —— 由 `ReferralCodeGenerator` 用 `SecureRandom`
   从 56 字符字母表生成 16 位随机串，不使用任何自增/哈希(id) 方案。
2. **唯一映射由后端维护** —— `referral_codes.referral_code` 建唯一索引，
   code → provider 的映射只认后端。
3. **预约归属由后端反查** —— 预约接口只接收 `referralCode`，**不接受前端传入的
   providerId**。后端依据推广码反查服务者，并在下单时二次校验服务者审核状态。
4. **二维码只存 Key** —— `qr_image_key` 存相对文件名，二进制不落库；
   存储实现集中在 `QrStorage`，换对象存储只需替换该类。
5. **失效码给明确提示** —— 不存在 / 已停用 / 服务者未过审 / 服务者已停用 / 主页已关闭
   分别对应不同错误码（41001~41008），前端可直接据此展示文案。
6. **统计必须真实** —— `visit_count` / `booking_count` 只由后端实际行为累加，
   没有任何伪造入口。

### 小程序码模式

| 模式 | 条件 | 行为 |
|---|---|---|
| `REAL` | 配置了 `WX_APP_ID` + `WX_APP_SECRET` | 调用微信官方 `wxa/getwxacodeunlimit`，`scene` = 推广码 |
| `DEV` | 未配置凭据 | 本地生成**带醒目水印「开发占位码·非小程序码」**的二维码，接口返回 `mode=DEV` |

> 开发降级码**不可对外使用**。前端子拿到 `mode=DEV` 时必须展示提示。
> 生产环境 `application-prod.yml` 已通过 `${WX_APP_ID:?}` 强制要求配置凭据，
> 未配置直接启动失败，不会静默降级。

---

## 数据隔离与越权防护

| 防线 | 实现 |
|---|---|
| 身份来源 | `providerId` 只来自服务端签发的 JWT，不采信任何请求参数 |
| 列表过滤 | 所有列表查询强制 `provider_id = SecurityUtils.requireProviderId()` |
| 详情/更新/删除 | 先按 id 查，再比对 `providerId`，不匹配抛 `BizException.accessDenied()` |
| 越权探测 | 越权与不存在返回同一错误，避免用错误码探测他人资源 |
| 身份分区 | 服务者端与管理端使用**不同签名密钥 + 不同 issuer**，token 无法跨端使用 |
| 状态机 | 订单状态变更统一走 `OrderStatus.assertCanTransitTo`，非法流转直接拒绝 |
| SQL 注入 | 全量使用 MyBatis-Plus 参数化查询，无字符串拼接 SQL |

---

## 首期明确不做

微信支付、平台抽佣、资金托管、入驻收费、会员等级、多级分销、优惠券、
自由交易市场、AI 排单、营销自动化、多租户装修引擎。

---

## ⚠️ 合规声明（尚未核实）

以下事项在正式发布前必须人工核实，代码与文档**不声称已合规**：

- 微信小程序**个人主体**可选择的服务类目、所需资质、隐私政策与平台审核规则；
- 「不接入支付」不等于所有预约服务都可直接上线；
- 服务者审核流程不得成为绕过平台经营资质要求的通道；
- 手机号、详细地址仅用于必要的预约与履约场景，不采集通讯录、精确定位。

详见 `docs/上线前资质与审核清单.md`（待补）。