# 生产部署指南 —— community.aindgc.com

目标：后台管理端（admin-web）+ 后端（Spring Boot）+ MySQL，通过 `community.aindgc.com` 对外。

## 架构

宿主机 80/443 **已被同机 aindgc 站点占用**（其 nginx 容器直绑）。
本项目**不再抢占这两个端口**，改为挂在现有网关之后：

```
宿主机 80/443
     │
┌────▼──────────────────────────────┐
│  aindgc 的 nginx 容器（网关）      │  ← 终止 TLS，按域名分流
└──┬───────────────┬───────────────┘ 
   │ www.aindgc    │ community.aindgc.com
   │ （原样保留）    │
   │                ▼
   │        nb-admin:80
   │        （本项目容器 nginx）
   │          ├─ /        → admin-web 静态资源（SPA）
   │          └─ /api/    → nb-backend:8080
   │
   ▼
nb-backend ──► nb-mysql
```

好处：**完全不动现有 aindgc 部署**，零回归风险；两站共享同一入口，
证书和日志统一管理。代价是需要在网关 nginx 里加一个 server 块。

> ⚠️ 如果给 `nb-admin` 直接映射 `80:80`，Docker 会报
> `port is already allocated`，容器根本起不来。

## ⚠️ 两条硬约束（踩了就部署不上）

### 1. 绝对不要在服务器上构建镜像

目标机内存实测：

```
              total   used   free  buff/cache  available
Mem:           1.6Gi   700Mi  139Mi       945Mi       912Mi
Swap:          2.0Gi      0B  2.0Gi
```

Maven 编译至少要 1GB 堆，而可用只有 912Mi —— **容器里跑 `mvn package` 必定 OOM**，
而且失败时可能连带拖垮同机已在运行的 aindgc 服务。

因此本部署使用 `backend/Dockerfile.prebuilt`：**没有编译阶段，只 COPY 预构建 jar**。
jar 必须在本地打好再上传。

```bash
# 本地
cd backend && mvn -DskipTests package
```

> `backend/Dockerfile`（含编译阶段的多阶段构建）适合 CI，**不要**用于这台机器。

### 2. DNS 必须先生效

`aindgc.com` 的权威 NS 是 `dns13/dns14.hichina.com`。
证书签发走 ACME 校验，域名解析不通就签不下来。

```bash
nslookup community.aindgc.com
# 必须返回服务器 IP；返回 Non-existent domain 就是没生效
```

---

## 内存预算

| 容器 | 实测常驻 | 配置上限 |
|---|---|---|
| `nb-backend` | 350~420 MB（`-Xmx384m`） | 560 MB |
| `nb-mysql` | 180~230 MB（buffer pool 128M） | 400 MB |
| `nb-admin` | ~10 MB | 96 MB |
| **合计** | **550~660 MB** | — |

剩余余量约 250~360 MB，偏紧，靠 2GB Swap 兜底。可选优化：

- 下线同机 aindgc 服务（最直接）
- MySQL 已收紧：`innodb-buffer-pool-size=128M`、`performance-schema=OFF`
- JVM 已显式限堆：`-Xms128m -Xmx384m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC`
- 部署后用 `docker stats` 观察，异常时先调小 `-Xmx`

---

## 前置条件

| 项 | 要求 |
|---|---|
| DNS | `community.aindgc.com` 的 A 记录指向服务器 IP，**且已在权威 NS 生效** |
| 服务器 | Docker + Docker Compose 可用 |
| 网关 | 需知道 aindgc nginx 容器的**名称**与**所在 docker 网络名** |
| 内存 | 可用 ≥ 700MB（本机实测 912MB，见上方预算表） |
| 微信 | 已有小程序 AppID / AppSecret（生产 profile 下缺失会**启动失败**） |

### 先查清网关信息

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
# 找到占用 80/443 的 nginx 容器，记下它的名字，比如 aindgc-web

docker inspect aindgc-web --format '{{json .NetworkSettings.Networks}}'
# 记下网络名，比如 aitools-net

docker inspect aindgc-web --format '{{json .Mounts}}'
# 看它的 /etc/nginx 配置是从宿主机哪个目录挂进去的
```

查到的网络名填到 `deploy/.env`：

```
GATEWAY_NETWORK=查到的网络名
```

---

## 部署步骤

最省事的做法：本地执行 `scripts\package-deploy.cmd` 生成 `nbservice-deploy.tar.gz`，
上传解压后跑 `deploy/deploy.sh`（自动预检、补全密钥、启动、验收），
**再按「网关接入」一节把站点挂到现有 nginx 上**。


### 1. 打包（本地执行）

```bat
scripts\package-deploy.cmd
```

产物 `nbservice-deploy.tar.gz`，已包含后端 jar、后台 dist、SQL、全部部署配置。
**不含 `deploy/.env`**，脚本会校验并拒绝打包。

### 2. 上传并解压

```bash
scp nbservice-deploy.tar.gz root@<IP>:/opt/
ssh root@<IP>
mkdir -p /opt/nbservice
tar -xzf /opt/nbservice-deploy.tar.gz -C /opt/nbservice
cd /opt/nbservice
```

### 3. 填环境变量

```bash
cp deploy/.env.example deploy/.env
vi deploy/.env
```

必填 5 项：

```
WX_APP_ID=你的AppID
WX_APP_SECRET=你的AppSecret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的管理口令
GATEWAY_NETWORK=查到的网关网络名
```

> MySQL 密码、两个 JWT 密钥由 `deploy.sh` 自动生成并写入 `.env`（权限 600）。
> **不要**手写默认值——那会架空 `application-prod.yml` 的 `${JWT_...:?}` 启动校验。

### 4. 执行部署

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

脚本会依次完成：环境预检（含内存水位）→ 生成/校验 `.env` → 启动容器 → 等待就绪 → 输出验收命令。
**不签发证书**（80/443 不归本项目管）。

### 5. 网关接入（必做，否则外网访问不到）

> 🔴 **这一步会动到承载 `www.aindgc.com` 的那个 nginx 容器。**
> 任何一步失败都可能导致线上站点中断，所以下面每条命令都先 `-t` 再重启。

```bash
# 5.1 先装「仅 HTTP」版本（不引用任何证书文件，随时可装）
#     路径由 docker inspect <网关容器> --format '{{json .Mounts}}' 决定
cp deploy/nginx/community-gateway-http.conf <网关 conf.d 挂载目录>/community.conf

# 5.2 测配置（-t 只做语法检查，不会中断现有站点）
docker exec <网关容器> nginx -t

# 5.3 只有 5.2 通过才重启；不通过就跳过并排查，**不要**硬来
docker restart <网关容器>

# 5.4 确认旧站点没受影响
curl -I https://www.aindgc.com

# 5.5 容器间连通性自检：网关能否按容器名找到 nb-admin
docker exec <网关容器> wget -qO- http://nb-admin/v3/api-docs | head -c 200
```

> 5.5 报 `bad address 'nb-admin'` 说明两者不在同一 docker 网络，
> 回到 `deploy/.env` 核对 `GATEWAY_NETWORK`。

> ⚠️ **此时不要装 `community-gateway.conf`**。它含 443 块并引用了尚未签发的
> 证书，`nginx -t` 会报 `cannot load certificate`；此时重启会让网关容器
> 起不来，`www.aindgc.com` 一起挂。等第 6 步换。

> ⚠️ **两个文件不要同时在 conf.d 里**。它们的 `server_name` 都是
> `community.aindgc.com`、都监听 80，同时存在会让 `nginx -t` 报
> `conflicting server name "community.aindgc.com" on 0.0.0.0:80`，
> 结果一样是网关起不来。第 6 步是**覆盖同名文件**，不是新增一个。

```bash
# 确认 conf.d 里只有一份（应该只输出 community.conf）
docker exec <网关容器> ls /etc/nginx/conf.d/ | grep -i community
```

### 6. 签发证书

DNS 生效且第 5 步完成后：

```bash
# 6.1 先用 HTTP 校验签发（走网关的 ACME webroot，即 community-gateway-http.conf
#     里的 /.well-known/acme-challenge/）
certbot certonly --webroot -w <网关的 certbot webroot> \
  -d community.aindgc.com --agree-tos -m <你的邮箱> --non-interactive

# 6.2 把证书放到网关能读到的位置
#     路径要与下面 community-gateway.conf 里的 ssl_certificate 一致
cp /etc/letsencrypt/live/community.aindgc.com/fullchain.pem <网关ssl目录>/community.aindgc.com.pem
cp /etc/letsencrypt/live/community.aindgc.com/privkey.pem   <网关ssl目录>/community.aindgc.com.key

# 6.3 确认证书文件真的在容器里能读到（宿主机有 ≠ 容器里有）
docker exec <网关容器> ls -l /etc/nginx/ssl/community.aindgc.com.*

# 6.4 换成完整版网关配置（HTTP + HTTPS）
cp deploy/nginx/community-gateway.conf <网关 conf.d 挂载目录>/community.conf

# 6.5 测配置 -> 通过才重启
docker exec <网关容器> nginx -t && docker restart <网关容器>

# 6.6 验收：HTTPS 可用 + 旧站点未受影响，两个都要看
curl -I https://community.aindgc.com
curl -I https://www.aindgc.com
```

> 证书路径要与 `community-gateway.conf` 里的 `ssl_certificate` 一致。
> 续期：certbot 配好定时任务后，证书更新时需重跑 6.2 + 6.3。

### 7. 验收

```bash
curl -I  https://community.aindgc.com                      # 首页 200
curl     https://community.aindgc.com/api/admin/dashboard   # 接口有 JSON 响应
curl -I  https://www.aindgc.com                            # 确认旧站点未受影响
```

浏览器打开 `https://community.aindgc.com`，用管理员账号登录。

> ⚠️ 务必同时验证 `www.aindgc.com` 仍然正常——网关配置改错会同时影响两个站点。

---

---

## 不使用一键脚本时的手动分步

正常情况直接用 `./deploy/deploy.sh` 即可（它只是把下面的步骤串起来并加上预检）。
只有在需要自定义流程时才手动来：

```bash
cd /opt/nbservice

# 1) 准备环境变量
cp deploy/.env.example deploy/.env
vi deploy/.env                    # 填 WX_APP_ID / WX_APP_SECRET / ADMIN_PASSWORD / GATEWAY_NETWORK

# 2) 补齐自动生成的密钥（deploy.sh 平时会替你做）
for k in MYSQL_ROOT_PASSWORD DB_PASSWORD JWT_PROVIDER_SECRET JWT_ADMIN_SECRET; do
  grep -qE "^$k=.+[^[:space:]]" deploy/.env || echo "$k=$(openssl rand -hex 16)" >> deploy/.env
done
chmod 600 deploy/.env

# 3) 启动全部服务（--build 不会跑 Maven，Dockerfile.prebuilt 里没有编译阶段）
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build

# 4) 等后端就绪（约 40~90 秒，首次需拉镜像 + 初始化数据库）
docker compose -f deploy/docker-compose.prod.yml ps
docker logs -f nb-backend      # Ctrl+C 退出，不影响容器

# 5) 回到上面「网关接入」和「签发证书」两节
```

> ⚠️ 证书**不在这里签发**。80/443 归现有网关管，ACME 校验也走网关的 webroot，
> 签发步骤见「签发证书」一节。在本项目里签证书属于架构错误。

---

## 小程序端对接

构建时把接口地址指向线上域名：

```bat
cd miniapp
set TARO_APP_API_BASE=https://community.aindgc.com
npm run build:weapp
```

小程序后台还需配置 **request 合法域名**：`https://community.aindgc.com`
（本地开发时在开发者工具勾选「不校验合法域名」）。

---

## 更新

```bash
cd /opt/nbservice

# 后端
cp new/neighborhood-backend.jar backend/target/
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build backend

# 前端
rm -rf admin-web/dist && cp -r new/dist admin-web/dist
docker compose -f deploy/docker-compose.prod.yml restart admin
```

---

## 运维

```bash
# 查看状态 / 日志
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs -f backend
docker logs -f nb-backend

# 重启 / 停止
docker compose -f deploy/docker-compose.prod.yml restart backend
docker compose -f deploy/docker-compose.prod.yml down          # 保留数据卷
docker compose -f deploy/docker-compose.prod.yml down -v       # ⚠️ 连数据一起删

# 证书续期
# TLS 在网关 nginx 上终止，续期后要：
#   1) 重新拷贝到 .pem/.key 路径
#   2) 重启【网关容器】（不是 nb-admin）
certbot renew --dry-run
cp /etc/letsencrypt/live/community.aindgc.com/fullchain.pem <网关ssl目录>/community.aindgc.com.pem
cp /etc/letsencrypt/live/community.aindgc.com/privkey.pem   <网关ssl目录>/community.aindgc.com.key
docker exec <网关容器> nginx -t && docker restart <网关容器>
```

建议加 crontab 每天试续期，并把续期后的证书同步成 `community.aindgc.com.pem/.key`，
再重启网关容器。

---

## 行尾注意事项（Windows 开发 + Linux 部署）

Windows 的两类脚本要求**相反**的行尾，仓库已用 `.gitattributes` 固化：

| 文件 | 必须 | 错了会怎样 |
|---|---|---|
| `*.cmd` `*.bat` | CRLF | cmd.exe 把整行拆成碎片，报「文件名、目录名或卷标语法不正确」 |
| `*.sh` | LF | Linux 报 `bad interpreter: /usr/bin/env bash\r`，直接拒绝执行 |

新增脚本后可用 `node <脚本目录>/fix-crlf.mjs .` 校正。

部署包用 **tar.gz** 而非 zip：PowerShell 的 `Compress-Archive` 在 Windows 上
生成的条目用反斜杠做分隔符，Linux 解压后会得到 `admin-web\dist\index.html`
这种畸形文件名，nginx 找不到首页。

---

## 回滚

```bash
# 保留上一个 backend 镜像标签，切回去即可
docker compose -f deploy/docker-compose.prod.yml up -d backend:previous
```

**上线前请务必执行** `docs/上线前资质与审核清单.md`——其中的主体资质与微信类目审核项
**尚未核实**，本项目的部署不代表已具备经营资质。
