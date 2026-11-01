#!/usr/bin/env bash
# =====================================================================
# 线上 50000 定位：/api/provider/service-items/manage
#
# 一次跑完，输出四段：
#   1. 后端日志里这次请求的完整堆栈 —— 真正的根因在这
#   2. 当前运行的 jar 版本（排除「跑的还是旧包」）
#   3. service_items 表结构（列齐不齐）
#   4. 把接口跑的那两条 SELECT 原样打出来（能复现就是数据/结构问题）
#
# 用法：
#   cd /opt/nbservice && bash deploy/diagnose-50000.sh
#
# 只读，不改任何东西。
# =====================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/deploy/.env"

read_env() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true
}
DB_USERNAME=$(read_env DB_USERNAME)
DB_PASSWORD=$(read_env DB_PASSWORD)
DB_NAME=$(read_env DB_NAME)
DB_NAME=${DB_NAME:-neighborhood}

run_sql() {
  docker exec -i -e MYSQL_PWD="$DB_PASSWORD" nb-mysql \
    mysql -u"$DB_USERNAME" "$DB_NAME" --default-character-set=utf8mb4 "$@" 2>&1
}

echo "============================================================"
echo "  1. 后端错误堆栈（真正的根因）"
echo "============================================================"
# 后端的异常日志会带上请求 URI，紧接着就是完整堆栈。
# 优先看容器 stdout；容器重启过的话再翻卷里的文件日志。
echo "--- 容器日志 ---"
docker logs nb-backend --since 72h 2>&1 \
  | grep -B2 -A 45 'service-items/manage' | tail -70 \
  || echo "（容器日志里没有匹配记录）"

echo
echo "--- 文件日志（跨重启保留） ---"
docker exec nb-backend sh -c \
  "grep -B2 -A 45 'service-items/manage' /data/logs/neighborhood-backend.log 2>/dev/null | tail -70" \
  || echo "（读不到文件日志）"

echo
echo "============================================================"
echo "  2. 当前运行的 jar 版本"
echo "============================================================"
docker exec nb-backend wget -qO- http://localhost:8080/api/system/version 2>/dev/null \
  || echo "（取不到 —— 这个 jar 里没有 /api/system/version，跑的是旧版）"

echo
echo "============================================================"
echo "  3. service_items 表结构"
echo "============================================================"
if [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
  run_sql -e "SHOW CREATE TABLE service_items\G" | tail -30
else
  echo "读不到 deploy/.env 里的数据库凭据"
fi

echo
echo "============================================================"
echo "  4. 把接口跑的两条 SELECT 原样打出来"
echo "============================================================"
if [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
  echo "--- 4.1 平台模板（接口第二条查询：provider_id = 0） ---"
  run_sql -e "SELECT id, provider_id, template_id, name, enabled, sort_order, deleted FROM service_items WHERE provider_id = 0 AND deleted = 0 ORDER BY sort_order ASC, id DESC;" | tail -25

  echo
  echo "--- 4.2 某个服务者自己的记录（接口第一条查询：provider_id = <me>） ---"
  run_sql -e "SELECT id, provider_id, template_id, name, enabled, sort_order, deleted FROM service_items WHERE provider_id > 0 AND deleted = 0 ORDER BY provider_id, sort_order LIMIT 20;" | tail -25

  echo
  echo "--- 4.3 数据分布 + 迁移记录 ---"
  run_sql -e "SELECT provider_id, COUNT(*) AS c, SUM(template_id IS NULL) AS 无模板引用 FROM service_items GROUP BY provider_id ORDER BY provider_id LIMIT 20;" | tail -25
  run_sql -e "SELECT version, applied_at FROM schema_migrations ORDER BY version;" | tail -20
else
  echo "跳过"
fi

echo "============================================================"
echo "  把上面第 1 段的堆栈发回来，就能定位到具体哪一行出的问题。"
echo "============================================================"
