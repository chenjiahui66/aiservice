#!/usr/bin/env bash
# =====================================================================
# 数据库迁移 —— 按序执行 deploy/migrations/*.sql
#
# 为什么需要这个脚本：
#   sql/schema.sql 挂在 MySQL 容器的 docker-entrypoint-initdb.d 下，
#   **只在数据卷首次初始化时执行一次**。已经部署过的环境不会再跑它，
#   之后新增的表和列就永远补不上 —— 功能上线即报错，且现场无从查起。
#   所以所有「改表」都必须走这个目录。
#
# 去重：已执行过的版本记在 schema_migrations 表里，重复部署不会重复跑。
# 幂等：迁移脚本本身也必须可重复执行（执行到一半失败后重跑要能自愈）。
#
# 用法：
#   bash deploy/migrate.sh
# =====================================================================
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"
MIGRATIONS_DIR="$ROOT/deploy/migrations"
CONTAINER="nb-mysql"

info() { echo -e "\033[0;36m[INFO]\033[0m $*"; }
ok()   { echo -e "\033[0;32m[ OK ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
fail() { echo -e "\033[0;31m[FAIL]\033[0m $*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || fail "找不到 $ENV_FILE"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  warn "没有迁移目录，跳过"
  exit 0
fi

# ⚠️ 这三行必须容错，否则 .env 缺任何一个键都会让脚本**静默死掉**。
#
#    坑：原来写的是
#        DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2)
#    .env 里没有 DB_NAME 这一行时，grep 返回 1 →
#    脚本第 17 行的 `set -Eeuo pipefail` 里 pipefail 把这个 1 冒泡成整条管道失败 →
#    set -e 立刻退出 —— **一行输出都没有，退出码 1**。
#    更坑的是紧跟着的 `DB_NAME=${DB_NAME:-neighborhood}` 兜底根本走不到，
#    因为脚本已经死在上一行的赋值里了。现场只能靠 bash -x 才看得出断在哪。
#
#    现在用 read_env 统一兜住，缺键交给下面的显式检查报错（能看懂、能修）。
read_env() {
  # tail -1 取最后一次赋值（后写的覆盖先写的）
  # cut -d= -f2- 而不是 -f2：值里含 '=' 时（base64 补位）不会被截断
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

DB_USERNAME=$(read_env DB_USERNAME)
DB_PASSWORD=$(read_env DB_PASSWORD)
DB_NAME=$(read_env DB_NAME)
DB_NAME=${DB_NAME:-neighborhood}

[ -n "$DB_USERNAME" ] || fail "deploy/.env 里没有 DB_USERNAME"
[ -n "$DB_PASSWORD" ] || fail "deploy/.env 里没有 DB_PASSWORD"

docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" \
  || fail "容器 $CONTAINER 没在跑，请先 docker compose up -d mysql"

# ⚠️ 密码走 MYSQL_PWD 环境变量，不要写成 mysql -pXXX：
#    命令行参数会出现在 ps 输出里，任何能看进程的人都能拿到数据库口令。
run_sql() {
  docker exec -i -e MYSQL_PWD="$DB_PASSWORD" "$CONTAINER" \
    mysql -u"$DB_USERNAME" "$DB_NAME" --default-character-set=utf8mb4 "$@"
}

# 迁移记录表
run_sql <<'SQL'
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version`    VARCHAR(64) NOT NULL,
  `applied_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  warn "没有待执行的迁移"
  exit 0
fi

for f in "${files[@]}"; do
  version=$(basename "$f" .sql)
  # ⚠️ 同样要兜住：查记录失败时 set -e 会让脚本静默退出。
  #    这里宁可把 applied 当成「没执行过」（下面的 run_sql 会给出**可见**报错），
  #    也好过在 30 行之前悄无声息地死掉、只留一个退出码 1。
  applied=$(run_sql --batch --skip-column-names \
    -e "SELECT COUNT(*) FROM schema_migrations WHERE version = '${version}';" \
    | tr -d '[:space:]' || true)
  if [ "$applied" = "1" ]; then
    echo "    跳过 ${version}（已执行）"
    continue
  fi
  info "执行迁移 ${version}"
  run_sql < "$f"
  run_sql -e "INSERT IGNORE INTO schema_migrations (version) VALUES ('${version}');"
  ok "迁移 ${version} 完成"
done

ok "数据库迁移完成"
