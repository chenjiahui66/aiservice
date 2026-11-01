#!/usr/bin/env bash
# =====================================================================
# 邻里服务管家 —— 服务器自检脚本
#
# 用途：部署完（或怀疑「改了功能却没生效」）时，一条命令看清现状：
#   1. 服务器上跑的 jar 是哪一版（构建时间）
#   2. 容器是不是用最新镜像重建的
#   3. 数据库迁移执行到哪一版了
#   4. 关键数据是否符合预期（注册即通过 / 服务类目）
#   5. 微信小程序码配置状态
#
# 用法：
#   cd /opt/nbservice && bash deploy/diagnose.sh
#
# 只读，不改任何东西。
# =====================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"
COMPOSE="$ROOT/deploy/docker-compose.prod.yml"

info() { echo -e "\033[0;36m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[0;32m[ OK ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
bad()  { echo -e "\033[0;31m[FAIL]\033[0m $*"; }

echo "============================================================"
echo "  邻里服务管家 · 服务器自检"
echo "============================================================"

# ---------------------------------------------------------------------
# 1. 容器状态
# ---------------------------------------------------------------------
echo
info "1. 容器状态"
docker ps --filter name=nb- --format '  {{.Names}}\t{{.Status}}\t{{.Image}}' || bad "docker 不可用"

# ---------------------------------------------------------------------
# 2. 服务器上跑的 jar 是哪一版
# ---------------------------------------------------------------------
echo
info "2. 当前运行的 jar 版本"
VER=$(docker exec nb-backend wget -qO- http://localhost:8080/api/system/version 2>/dev/null || true)
if [ -n "$VER" ]; then
  echo "  $VER"
  BT=$(echo "$VER" | sed -n 's/.*"buildTime":"\([^"]*\)".*/\1/p')
  if [ -n "$BT" ]; then
    ok "构建时间: $BT"
    # 换算成北京时间，方便和本地包对照
    BT_CN=$(date -d "$BT" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null || echo "$BT")
    echo "        北京时间: $BT_CN"
  fi
else
  warn "取不到版本信息 —— 这个 jar 里没有 /api/system/version，说明跑的还是旧版。"
  warn "请按下面第 6 节的步骤换 jar 并重建容器。"
fi

# ---------------------------------------------------------------------
# 3. 容器里的 jar 与磁盘上的 jar 是否一致
# ---------------------------------------------------------------------
echo
info "3. 镜像里的 jar 与磁盘上的 jar 是否一致"
JAR_HOST="$ROOT/backend/target/neighborhood-backend.jar"
if [ -f "$JAR_HOST" ]; then
  H=$(md5sum "$JAR_HOST" | cut -d' ' -f1)
  C=$(docker exec nb-backend md5sum /app/app.jar 2>/dev/null | cut -d' ' -f1)
  echo "  磁盘 jar: $H"
  echo "  容器 jar: $C"
  if [ "$H" = "$C" ]; then
    ok "一致 —— 容器跑的就是磁盘上这个包"
  else
    bad "不一致！容器跑的还是旧 jar。需要重建容器（见第 6 节）"
  fi
else
  warn "磁盘上没有 $JAR_HOST —— 部署包没解压或解压错位置"
fi

# ---------------------------------------------------------------------
# 4. 数据库迁移执行到哪一版
# ---------------------------------------------------------------------
echo
info "4. 数据库迁移记录"
read_env() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}
DB_USERNAME=$(read_env DB_USERNAME)
DB_PASSWORD=$(read_env DB_PASSWORD)
DB_NAME=$(read_env DB_NAME)
DB_NAME=${DB_NAME:-neighborhood}

if [ -z "$DB_USERNAME" ] || [ -z "$DB_PASSWORD" ]; then
  warn "deploy/.env 里读不到 DB_USERNAME / DB_PASSWORD，跳过数据库检查"
else
  run_sql() {
    docker exec -i -e MYSQL_PWD="$DB_PASSWORD" nb-mysql \
      mysql -u"$DB_USERNAME" "$DB_NAME" --default-character-set=utf8mb4 "$@"
  }
  echo "  已执行的迁移:"
  run_sql --batch --skip-column-names -e "SELECT version, applied_at FROM schema_migrations ORDER BY version;" 2>/dev/null \
    | sed 's/^/    /' || echo "    （读不到 schema_migrations 表）"

  echo
  echo "  磁盘上待执行的迁移:"
  ls -1 "$ROOT/deploy/migrations"/*.sql 2>/dev/null | while read -r f; do
    v=$(basename "$f" .sql)
    done=$(run_sql --batch --skip-column-names -e "SELECT COUNT(*) FROM schema_migrations WHERE version='$v';" 2>/dev/null | tr -d '[:space:]')
    if [ "$done" = "1" ]; then
      echo "    [已执行] $v"
    else
      echo "    [未执行] $v   ← 需要跑: cd $ROOT && bash deploy/migrate.sh"
    fi
  done
fi

# ---------------------------------------------------------------------
# 5. 业务数据体检
# ---------------------------------------------------------------------
echo
info "5. 业务数据"
if [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
  run_sql -e "
    SELECT '待审核的服务者' AS 项目, COUNT(*) AS 数量 FROM providers WHERE audit_status = 0 AND deleted = 0
    UNION ALL SELECT '已通过的服务者', COUNT(*) FROM providers WHERE audit_status = 1 AND deleted = 0
    UNION ALL SELECT '服务者自己的服务类目记录', COUNT(*) FROM service_items WHERE provider_id > 0 AND deleted = 0
    UNION ALL SELECT '平台维护的服务类目', COUNT(*) FROM service_items WHERE provider_id = 0 AND deleted = 0
    UNION ALL SELECT '已生成二维码的服务者', COUNT(*) FROM referral_codes WHERE qr_image_key IS NOT NULL AND deleted = 0;
  " 2>/dev/null | sed 's/^/  /' || echo "  （查询失败）"
else
  warn "跳过（读不到数据库凭据）"
fi

# ---------------------------------------------------------------------
# 6. 微信小程序码配置
# ---------------------------------------------------------------------
echo
info "6. 微信小程序凭据"
WXID=$(read_env WX_APP_ID)
if [ -n "$WXID" ]; then
  ok "WX_APP_ID 已配置（$WXID）"
else
  warn "WX_APP_ID 未配置 —— 生产环境要求必填，未配置时后端会拒绝启动"
fi

# ---------------------------------------------------------------------
# 7. 该做什么
# ---------------------------------------------------------------------
echo
echo "------------------------------------------------------------"
info "如果上面提示「不一致」或「未执行」，按这个顺序处理："
cat <<'EOF'

  cd /opt/nbservice
  tar -xzf nbservice-deploy.tar.gz -C /opt/nbservice
  bash deploy/migrate.sh
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env \
      up -d --build --force-recreate backend
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d admin

  # 确认换成功（buildTime 应该和本地刚打的包一致）
  docker exec nb-backend wget -qO- http://localhost:8080/api/system/version

EOF
echo "============================================================"
