#!/usr/bin/env bash
# =====================================================================
# 邻里服务管家 —— 一键部署脚本（community.aindgc.com）
#
# 用法：
#   cd /opt/nbservice
#   chmod +x deploy/deploy.sh
#   ./deploy/deploy.sh
#
# 可覆盖的环境变量：
#   DB_ROOT_PASSWORD   MySQL root 密码（未提供则自动生成）
#   DB_PASSWORD        应用账号密码（未提供则自动生成）
#   JWT_PROVIDER_SECRET / JWT_ADMIN_SECRET   未提供则自动生成
#   WX_APP_ID / WX_APP_SECRET               必填，未提供直接中止
#   SERVER_IP          仅用于提示，不影响逻辑
#
# ⚠️ 本脚本只做部署，不做任何资质判断。
#    上线前请先走完 docs/上线前资质与审核清单.md。
# =====================================================================
set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;36m'; NC='\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"
COMPOSE="$ROOT/deploy/docker-compose.prod.yml"

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

trap 'fail "部署中断，行号 $LINENO"' ERR

# ⚠️ 读 .env 的值必须容错。
#
#    坑：`X=$(grep -E "^X=" .env | cut -d= -f2)` 在 .env 缺 X 这一行时，
#    grep 返回 1 → pipefail + set -e 让脚本**静默退出**（零输出、退出码 1），
#    连本脚本自己写的兜底 `X=${X:-默认值}` 都走不到。
#    migrate.sh 上就是这么定位了两个小时的。
read_env() {
  # tail -1 取最后一次赋值；-f2- 保证值里含 '=' 时不被截断
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

# ---------------------------------------------------------------------
# 0. 环境预检
# ---------------------------------------------------------------------
info "预检运行环境"

command -v docker >/dev/null || fail "未安装 docker，请先安装 Docker Engine"
docker compose version >/dev/null 2>&1 || fail "未安装 docker compose 插件（docker-compose v2）"
ok "docker: $(docker --version)"

[ -f "$COMPOSE" ] || fail "找不到 $COMPOSE"
[ -f "$ROOT/sql/schema.sql" ] || fail "找不到 sql/schema.sql"
[ -d "$ROOT/admin-web/dist" ] || fail "找不到 admin-web/dist，请先在前端执行 npm run build"

# 🔴 预构建 jar 是硬性前置条件。
# 小内存机器上跑 Maven 编译必定 OOM，且失败时可能连带拖垮同机其它服务。
[ -f "$ROOT/backend/target/neighborhood-backend.jar" ] || fail \
  "找不到 backend/target/neighborhood-backend.jar。
  请在本地/CI 执行：
    cd backend && mvn -DskipTests package
  然后把 jar 上传到这里。
  ⚠️ 不要改成在服务器上编译，会 OOM。"

# 内存预检：同机已有其它 Java 容器时，新增 Spring Boot 有 OOM 风险
TOTAL_MB=$(free -m | awk '/Mem:/{print $2}')
AVAIL_MB=$(free -m | awk '/Mem:/{print $7}')
SWAP_MB=$(free -m | awk '/Swap:/{print $2}')
info "内存总量 ${TOTAL_MB}MB，可用 ${AVAIL_MB}MB，Swap ${SWAP_MB}MB"
info "本次部署实测常驻约 550~660MB（backend~400 + mysql~210 + nginx~10）"

if [ "$AVAIL_MB" -lt 700 ]; then
  fail "可用内存仅 ${AVAIL_MB}MB，低于本服务实测所需的 550MB + 安全余量。
  请先释放内存（停掉同机其它服务）或换机器，否则必然 OOM。"
fi
if [ "$AVAIL_MB" -lt 950 ]; then
  warn "可用内存 ${AVAIL_MB}MB 偏紧。能跑，但高峰期可能触及上限，靠 Swap 兜底。"
  warn "建议："
  warn "  1) 保持 Swap ≥ 1GB（当前 ${SWAP_MB}MB）"
  warn "  2) 部署后用 docker stats 观察，若 nb-backend 频繁被杀，调小 -Xmx"
  warn "  3) 若同机 aindgc 服务可下线，停掉它最直接"
fi
if [ "$SWAP_MB" -lt 1024 ]; then
  warn "Swap 不足 1GB，建议先加："
  warn "  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile"
  warn "  sudo mkswap /swapfile && sudo swapon /swapfile"
fi

# 端口占用检查：只提示，不阻断
# 本项目不占用宿主机 80/443（由网关统一对外），因此这里只做冲突预警。
for p in 80 443; do
  if command -v ss >/dev/null && ss -ltn "sport = :$p" | grep -q LISTEN; then
    ok "端口 $p 已被占用 —— 符合预期（由现有 aindgc 网关对外），本项目不抢这两个端口"
  fi
done

echo
ok "预检通过"
echo

# ---------------------------------------------------------------------
# 1. 生成 / 补全环境变量
# ---------------------------------------------------------------------
info "准备环境变量"

gen_secret() { openssl rand -base64 48 | tr -d '\r\n'; }
# 数据库口令用十六进制随机串：纯 [0-9a-f]，不含 base64 的 + / = 等字符。
#
# ⚠️ 不要再用 `openssl rand -base64 N | tr -c 'A-Za-z0-9' '' | head -c 24`：
#    GNU coreutils 的 tr 要求「非 -t 模式下 set2 必须非空」，该写法直接报错
#    且**不输出任何内容**，口令会被静默填成空串，随后 compose 的
#    ${DB_PASSWORD:?必填} 在服务器上才炸。
gen_db_password() { openssl rand -hex 16 | tr -d '\r\n'; }

[ -f "$ENV_FILE" ] || cp "$ROOT/deploy/.env.example" "$ENV_FILE"

# 补全空值（不覆盖已填内容）
# ⚠️ 必须处理「键根本不存在」的情况：
#    旧实现只用 sed 替换已有行，若 .env 里缺该键则 sed 静默无操作，
#    变量依旧是空的，compose 的 ${VAR:?必填} 会在后面炸掉。
fill() {
  local key="$1" val="$2"
  if grep -qE "^${key}=.*[^[:space:]]" "$ENV_FILE"; then
    return 0
  fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    # ⚠️ 开头这个 \n 不能省。
    #    用户手写的 .env（Windows 编辑器保存）最后一行常常没有换行符，
    #    直接 >> 会把新键粘到上一行末尾：
    #        GATEWAY_NETWORK=aitools-netMYSQL_ROOT_PASSWORD=xxx
    #    结果 compose 报「MYSQL_ROOT_PASSWORD is missing」，
    #    而 GATEWAY_NETWORK 的值同时被污染成不存在的网络名。
    #    文件本来就以换行结尾时，这里只多一个空行，dotenv 会忽略。
    printf '\n%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
  # 写完必须回读校验：静默写坏比直接报错难查得多
  grep -qE "^${key}=.*[^[:space:]]" "$ENV_FILE" \
    || fail "写入 ${key} 失败，请检查 ${ENV_FILE} 是否可写"
  info "已生成 ${key}"
}

fill "MYSQL_ROOT_PASSWORD" "${DB_ROOT_PASSWORD:-$(gen_db_password)}"
fill "DB_NAME" "neighborhood"
fill "DB_USERNAME" "app_user"
fill "DB_PASSWORD" "${DB_PASSWORD:-$(gen_db_password)}"
fill "JWT_PROVIDER_SECRET" "${JWT_PROVIDER_SECRET:-$(gen_secret)}"
fill "JWT_ADMIN_SECRET" "${JWT_ADMIN_SECRET:-$(gen_secret)}"
fill "BOOTSTRAP_ADMIN_ENABLED" "true"

# 管理员账号：口令由管理员在 .env 里设置，不自动生成
# —— 账号密码必须由人明确决定，自动生成等于没人知道密码。
#
# ⚠️ 这里用 fill 而不是 sed：fill 同时处理「键存在但值为空」和「键根本不存在」
#    两种情况；sed 只能改已存在的行，键缺失时静默无效，
#    后面 grep ADMIN_USERNAME 会因 set -e 静默退出。
fill "ADMIN_USERNAME" "admin"
if ! grep -qE '^ADMIN_PASSWORD=.+' "$ENV_FILE"; then
  fail "请在 $ENV_FILE 中设置 ADMIN_PASSWORD（管理员登录口令）。
  该口令只存在于服务器本机文件，不会进入任何提交文件。"
fi
ok "管理员账号: $(read_env ADMIN_USERNAME)"

chmod 600 "$ENV_FILE"
ok "deploy/.env 就绪（权限 600）"

# 微信凭据是硬性要求：没有它，后端会以「开发降级二维码」上线，这是不可接受的
if ! grep -qE '^WX_APP_ID=.+' "$ENV_FILE" || ! grep -qE '^WX_APP_SECRET=.+' "$ENV_FILE"; then
  echo
  fail "WX_APP_ID / WX_APP_SECRET 未配置。
  没有微信凭据时后端会拒绝以 prod profile 启动，这是刻意设计——
  宁可启动失败，也不拿带水印的开发降级二维码对外发布。
  请在 deploy/.env 中填入后重试。"
fi
ok "微信小程序凭据已配置"

# ---------------------------------------------------------------------
# 2. TLS 证书（由外部网关统一签发/续期）
# ---------------------------------------------------------------------
# ⚠️ 本项目**不占用**宿主机 80/443 —— 已被同机 aindgc 站点占用。
#    TLS 在 aindgc 的网关 nginx 上终止，因此证书也由网关侧签发。
#
#    本脚本不代签证书，步骤见 deploy/README.md「签发证书」一节：
#      1. 把 deploy/nginx/community-gateway.conf 放进网关容器的 conf.d
#      2. docker restart 网关容器
#      3. 用网关的 certbot webroot 签发 community 证书
#      4. 证书就位后，网关配置里的 443 server 块才会生效
#
# 在此之前，community 站点可通过 HTTP 访问（网关的 80 server 块会反代进来）。
info "TLS 由网关侧统一管理，本脚本不签发证书"
if [ "${SKIP_GATEWAY_HINT:-}" != "1" ]; then
  warn "首次部署请按 deploy/README.md 完成网关接入与证书签发，否则 https 不可用"
fi

# ---------------------------------------------------------------------
# 3. 基础镜像（Docker Hub 在国内通常被墙，必须预拉取）
# ---------------------------------------------------------------------
PULL="$ROOT/deploy/pull-images.sh"
if [ -f "$PULL" ]; then
  info "准备基础镜像"
  bash "$PULL" || fail "基础镜像拉取失败，见上方提示（换网络 / 配加速器 / 离线导入）"
else
  # 没有脚本时至少尝试直接拉，让用户看到真实报错
  warn "找不到 deploy/pull-images.sh，尝试直接拉取（Docker Hub 被墙时会失败）"
fi

# ---------------------------------------------------------------------
# 4. 启动
# ---------------------------------------------------------------------
info "启动服务"

# 先把 MySQL 单独拉起来：迁移必须在库可连之后才能执行
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d mysql
info "等待 MySQL 就绪"
for i in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' nb-mysql 2>/dev/null || echo "")
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 2
done
if [ "$(docker inspect -f '{{.State.Health.Status}}' nb-mysql 2>/dev/null || echo '')" != "healthy" ]; then
  fail "MySQL 未在预期时间内就绪，请检查 docker logs nb-mysql"
fi

# 数据库迁移：schema.sql 只在首次初始化时跑，已部署的环境新增表/列必须靠这一步，
# 否则新功能上线即报表不存在
MIGRATE_SH="$ROOT/deploy/migrate.sh"
MIGRATIONS_DIR="$ROOT/deploy/migrations"
MIGRATION_COUNT=0
[ -d "$MIGRATIONS_DIR" ] && MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | wc -l)

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  # ⚠️ 有迁移文件却没有执行器 = 静默失败：脚本跳过、表建不出来，
  #    后端接口上线即 500，现场还很难联想到「少传了一个文件」。
  #    所以这里必须直接中止，而不是 warning 后继续。
  [ -f "$MIGRATE_SH" ] || fail "deploy/migrations/ 下有 $MIGRATION_COUNT 个迁移脚本，但没有 deploy/migrate.sh。
    两者必须成对上传，否则新表不会被创建，功能上线即报表不存在。
    重新打部署包（node scripts/package-deploy.mjs）即可带上。"
  info "执行数据库迁移（$MIGRATION_COUNT 个）"
  bash "$MIGRATE_SH" || fail "数据库迁移失败，请检查 deploy/migrations/ 下的脚本"
elif [ -f "$MIGRATE_SH" ]; then
  info "执行数据库迁移"
  bash "$MIGRATE_SH" || fail "数据库迁移失败，请检查 deploy/migrations/ 下的脚本"
fi

# ⚠️ --build 只做「组装镜像」，Dockerfile.prebuilt 里没有编译阶段，不会跑 Maven。
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --build
ok "容器已启动"

info "等待后端就绪（约 40~90 秒，首次需拉取镜像与初始化数据库）"
for i in $(seq 1 60); do
  if docker exec nb-admin wget -qO- http://localhost/v3/api-docs >/dev/null 2>&1 \
     || docker exec nb-backend wget -qO- http://localhost:8080/v3/api-docs >/dev/null 2>&1; then
    ok "后端已就绪"
    break
  fi
  [ "$i" = "60" ] && warn "等待超时，请执行 docker compose -f $COMPOSE logs -f backend 查看日志"
  sleep 10
done

# ---------------------------------------------------------------------
# 4. 结果
# ---------------------------------------------------------------------
echo
echo "============================================================"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" ps
echo "------------------------------------------------------------"
ADMIN_U=$(read_env ADMIN_USERNAME)
echo "  管理后台: http://community.aindgc.com  (网关接入后可用)"
echo "  HTTPS:    需完成网关证书签发后才可用"
echo "  自检:     docker exec nb-admin wget -qO- http://localhost/v3/api-docs"
echo
echo "  管理员账号: $ADMIN_U"
echo "  口令:      见 $ENV_FILE 中的 ADMIN_PASSWORD（首次启动时已自动创建）"
echo
echo "  小程序端对接："
echo "    set TARO_APP_API_BASE=https://community.aindgc.com && npm run build:weapp"
echo "    并在微信后台配置 request 合法域名 https://community.aindgc.com"
echo
echo "  建议登录后立即在后台修改管理员口令。"
echo "============================================================"
echo
warn "上线前请逐项确认 docs/上线前资质与审核清单.md —— 部署成功不代表已具备经营资质。"