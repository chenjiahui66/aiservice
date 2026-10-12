# 测试与校验脚本

三个脚本，用途不同，都**不使用假数据、不内置凭据**。

| 脚本 | 需要什么 | 作用 |
|---|---|---|
| `smoke.mjs` | 运行中的后端 + MySQL | 核心闭环 50 项真实 HTTP 冒烟 |
| `check-entity-cols.mjs` | MySQL + `sql/schema.sql` | 实体字段 ↔ 表列**双向**比对（12 表） |
| `check-deploy-config.sh` | Docker CLI（**不需要引擎**） | 离线校验 `deploy/` 能否起得来（29 项） |
| `verify-package.sh` | Docker CLI + Node/Python | 部署包落地验证：解压后逐项复验 |

---

## 1. `smoke.mjs` —— 核心闭环冒烟测试

真实 HTTP 调用后端接口，**不 mock、不使用假数据**。所有断言都打到运行中的服务。

### 前置条件

1. MySQL 8 已启动，已执行 `sql/schema.sql` 与 `sql/seed.sql`
2. 已创建 `deploy/.env` 并填入 `DB_USERNAME` / `DB_PASSWORD` / `JWT_*`
3. 后端已启动：`scripts\start-backend.cmd`
4. 把凭据导入当前 shell 后再运行测试。

```bat
:: Windows
set DB_USERNAME=app_user
set DB_PASSWORD=<你的值>
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=<你的值>

node tests\smoke.mjs
```

退出码 `0` 表示全部通过。

> 脚本**不内置任何凭据**。缺 `ADMIN_PASSWORD` 会直接报错退出，不会用默认值蒙混过关。

### 覆盖的用例

| 组 | 用例 |
|---|---|
| 1 | 平台管理员登录 |
| 2 | 两个服务者注册，新注册默认「待审核」 |
| 3 | 不存在的推广码返回 41001 |
| 4 | 管理员审核通过服务者 |
| 5 | 各服务者生成**互不相同**的 16 位随机推广码 |
| 6 | 开启个人服务主页 |
| 7 | 两个推广码分别打开**对应**服务者的主页 |
| 8 | 客户提交预约，初始状态为「待确认」 |
| 9 | 订单归属正确，A 只看到客户甲，B 只看到客户乙 |
| 10 | 今日工作台账统计与任务列表一致 |
| 11 | **数据隔离**：A 读/改 B 的订单被拒；A 搜不到 B 的客户；前端传 `providerId` 无法越权；不存在的订单与越权返回同一错误码 |
| 12 | **身份分区**：管理员 token 访问服务者接口被拒（HTTP 403），服务者 token 访问管理接口被拒 |
| 13 | **状态机**：待确认直接跳已完成被拒、重复确认被拒、正常流转、已完成不可取消、详情含完整流转记录 |
| 14 | 推广统计为真实计数 |
| 15 | **停用的服务者不能继续接收新预约**（主页 41007、下单被拒） |
| 16 | 平台概览数字来自真实统计，并标注小程序码模式 |

## 响应约定（测试里体现）

- 业务失败 → HTTP 200 + `code != 0`
- 服务层越权 → HTTP 200 + `code = 40300`
- 安全过滤器链越权（跨身份分区）→ HTTP 403 + `code = 40300`

## 已知限制

- 当前小程序码为**开发降级模式**（未配置 `WX_APP_ID`），脚本会断言 `qrMode === 'DEV'`。
  配置真实凭据后需同步调整该断言。
- 测试会产生真实数据（服务者、客户、订单），重复执行会累积；
  脚本用时间戳手机号避免冲突，不会互相干扰。

---

## 2. `check-entity-cols.mjs` —— 实体 ↔ 表列双向比对

只查一个方向会漏问题，所以双向都查：

- 实体有、表中无 → 运行时 `Unknown column`
- 表中有、实体无 → 幽灵列，`@TableLogic` / 复合主键表尤其容易踩

```bat
node tests\check-entity-cols.mjs
```

---

## 3. `check-deploy-config.sh` —— 部署配置离线校验

**不需要 Docker 引擎**，不需要服务器。它会：

1. 从 `deploy/deploy.sh` 里**抽取真实的 `fill` / `gen_secret` / `gen_db_password`**，
   用测试值跑一遍环境变量准备流程
2. 检查 compose 声明的必填变量是否都落盘且非空、两个 JWT 密钥是否不同
3. 执行 `docker compose config`，让 compose 自己做最终校验
4. 对解析结果做 21 项结构化断言（端口、网络、profile、内存、密钥泄漏…）

```bash
bash tests/check-deploy-config.sh     # Git Bash / Linux
```

### 它抓到过的真实 bug

留档用，这几个都是「本地看不出来、上服务器才炸」的类型：

| Bug | 后果 |
|---|---|
| `.env.example` 缺 `MYSQL_ROOT_PASSWORD`，而 `fill` 只 `sed` 替换**已存在**的行 | 静默无操作 → compose 的 `${MYSQL_ROOT_PASSWORD:?必填}` 失败 |
| `openssl rand -base64 N \| tr -c 'A-Za-z0-9' '' \| head -c 24` | GNU `tr` 报 `string2 must be non-empty` 且**不输出任何内容** → 口令被填成空串 |
| 同一份 `deploy/` 里留着旧版 `docker-compose.yml` | 裸跑 `docker compose up -d` 会**自动选中旧文件**，映射错端口 |

> ⚠️ `tr -c SET ''` 在 GNU coreutils 上是错误用法。删除补集要用 `tr -dc SET`，
> 但更稳妥的是直接 `openssl rand -hex 16`（纯 `[0-9a-f]`，不含 base64 的 `+ / =`）。

### 它**验不了**的部分

- `external` 网关网络是否真实存在（填错 → 网关侧 502 `host not found`）
- 1.6G 内存机器上 `docker compose` 能否真跑起来
- 镜像能否拉取（国内服务器 / 公司网可能被墙）

这三项只能在服务器上确认。

---

## 4. `verify-package.sh` —— 部署包落地验证

「打包命令退出码 0」不等于「服务器上能用」。这个脚本模拟
**上传 → 解压 → 起服务**，逐项复验：

| 步骤 | 查什么 | 不通过的后果 |
|---|---|---|
| 2 | `.sh` / `Dockerfile` / `.yml` / `.conf` / `.sql` 是否 LF | `bad interpreter: /usr/bin/env bash\r` |
| 3 | tar 条目是否用正斜杠、中文名是否合法 UTF-8 | 解压出畸形文件名 |
| 4 | 12 个关键文件齐全 | 启动即失败 |
| 5 | 3 份 nginx 配置花括号配对；http 版不含 443；完整版含 443+证书 | **网关起不来，`www.aindgc.com` 一起挂** |
| 6 | 包内无 `deploy/.env` | 密钥泄漏 |
| 7 | 无旧版 `docker-compose.yml` 残留 | 裸跑 `docker compose` 选中错文件 |
| 8 | jar CRC + 含 `application-prod.yml` | 镜像里是坏的 |
| 9 | `index.html` 引用的 chunk 都存在 | 打开后台白屏 |
| 10 | 用**包内解出来的** `deploy/` 再跑一遍第 3 节的校验 | 发出去的配置本身有问题 |

```bash
scripts\package-deploy.cmd          # Windows
bash tests/verify-package.sh         # Git Bash / Linux
```

> 第 5 步是重点：`deploy/nginx/*.conf` 会被塞进承载 `www.aindgc.com` 的那个
> 网关容器。花括号不配对、或 443 块引用了还没签发的证书，
> `nginx -t` 都会失败，重启后**整个网关起不来，线上站点一起中断**。
> 这类问题必须在上传前离线拦掉。