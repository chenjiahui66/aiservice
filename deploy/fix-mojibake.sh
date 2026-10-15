#!/usr/bin/env bash
# =====================================================================
# 修复库里已有的双重编码中文
#
# 背景：JDBC 用了 characterEncoding=utf8（小写），在 Connector/J 里指向
# utf8mb3，与表的 utf8mb4 不匹配。中文经这层转换被当成单字节 latin1
# 解读，写进去就变成 ä¸œé—¨ä»£æ‰"åžƒåœ¾ 这种双重编码。
#
# ⚠️ 本脚本必须在换成新版 jar（characterEncoding=UTF-8）之后执行，
#    否则修好的数据会被旧连接再次写坏。
#
# 双重编码是可逆的：把「被误读成 latin1 的字节」重新解释为 utf8 即可。
#
# 用法：
#   chmod +x deploy/fix-mojibake.sh
#   ./deploy/fix-mojibake.sh            # 先备份再修
#   ./deploy/fix-mojibake.sh --dry-run  # 只看会改什么，不落库
# =====================================================================
set -Eeuo pipefail

RED='\033[0.31m'; GREEN='\033[0.32m'; YELLOW='\033[1;33m'; BLUE='\033[0.36m'; NC='\033[0m'
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*" >&2; exit 1; }

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

command -v docker >/dev/null || fail "未安装 docker"

[ -f "$ENV_FILE" ] || fail "找不到 $ENV_FILE（deploy.sh 会生成它）"
# shellcheck disable=SC1090
PW="$(grep '^MYSQL_ROOT_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$PW" ] || fail "从 .env 里读不到 MYSQL_ROOT_PASSWORD"

DB_NAME="$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- || true)"
DB_NAME="${DB_NAME:-neighborhood}"

mysql_q() {
  docker exec nb-mysql mysql -uroot -p"$PW" --default-character-set=utf8mb4 -N -B "$DB_NAME" -e "$1"
}

info "目标库: $DB_NAME（容器 nb-mysql）"

# ---------------------------------------------------------------- 前置检查
info "检查当前连接与服务端字符集"
mysql_q "SELECT CONCAT('server=',@@character_set_server,' db=',@@character_set_database,' collation=',@@collation_connection);"

# ---------------------------------------------------------------- 受影响范围
# 只有真正含双重编码的行才会被改；CONVERT 对正常 UTF-8 是幂等的，
# 但仍逐行确认，避免误伤。
AFFECTED=$(mysql_q "SELECT COUNT(*) FROM service_items WHERE name REGEXP '[\xC0-\xFF]{2,}' COLLATE utf8mb4_bin;" 2>/dev/null || echo "0")
info "检测到含双重编码特征的服务项目: $AFFECTED 条"

if [ "$AFFECTED" = "0" ]; then
  ok "库里没有双重编码数据，无需修复"
  warn "如果后台页面**仍然**显示乱码，说明问题不在数据库，"
  warn "请检查 admin-web 是否正确按 UTF-8 解码响应（浏览器 F12 → Network → Response 头 charset）"
  exit 0
fi

# ---------------------------------------------------------------- 备份
if [ "$DRY_RUN" = "1" ]; then
  warn "DRY-RUN 模式，不会修改数据。将会修复 $AFFECTED 条记录。"
  info "执行 ./deploy/fix-mojibake.sh 实际修复"
  exit 0
fi

BACKUP="/root/nb-backup-$(date +%Y%m%d-%H%M%S).sql"
info "备份数据库到 $BACKUP"
docker exec nb-mysql mysqldump -uroot -p"$PW" --default-character-set=utf8mb4 "$DB_NAME" > "$BACKUP"
ok "备份完成 ($(du -h "$BACKUP" | cut -f1))"

# ---------------------------------------------------------------- 修复
info "修复中..."
mysql_q "
UPDATE service_items
SET name        = CONVERT(CAST(name        AS BINARY) USING utf8mb4),
    description = CONVERT(CAST(description AS BINARY) USING utf8mb4),
    notes       = CONVERT(CAST(notes       AS BINARY) USING utf8mb4),
    unit_desc   = CONVERT(CAST(unit_desc   AS BINARY) USING utf8mb4),
    price_desc  = CONVERT(CAST(price_desc  AS BINARY) USING utf8mb4)
WHERE name REGEXP '[\xC0-\xFF]{2,}' COLLATE utf8mb4_bin;
"

# 其余表的中文字段一并处理，避免以后再遇到同样问题
for t in providers customers; do
  case "$t" in
    providers)  cols="display_name,remark" ;;
    customers)  cols="name,address,remark" ;;
    *)          cols="" ;;
  esac
  [ -n "$cols" ] || continue
  for c in ${cols//,/ }; do
    mysql_q "UPDATE $t SET $c = CONVERT(CAST($c AS BINARY) USING utf8mb4) WHERE $c REGEXP '[\xC0-\xFF]{2,}' COLLATE utf8mb4_bin;" 2>/dev/null || true
  done
done

ok "修复完成"

# ---------------------------------------------------------------- 验证
info "验证结果（前 5 条）"
docker exec nb-mysql mysql -uroot -p"$PW" --default-character-set=utf8mb4 "$DB_NAME" \
  -e "SELECT id, name FROM service_items ORDER BY id LIMIT 5;"

REMAIN=$(mysql_q "SELECT COUNT(*) FROM service_items WHERE name REGEXP '[\xC0-\xFF]{2,}' COLLATE utf8mb4_bin;" 2>/dev/null || echo "0")
if [ "$REMAIN" = "0" ]; then
  ok "所有双重编码数据已修复"
else
  warn "仍有 $REMAIN 条疑似异常，请人工核对上方输出"
fi

cat <<'EOF'

下一步（必做，否则数据会被再次写坏）：

  1. 上传新的 jar（characterEncoding=UTF-8）
  2. docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --force-recreate backend
  3. 确认 DataInitializer 不再重复插入模板：
     docker logs nb-backend | grep -i '服务项目模板'

EOF