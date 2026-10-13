#!/usr/bin/env bash
# =====================================================================
# 离线校验 deploy/ 能否真的起得来（不需要 Docker 引擎、不碰服务器）
#
# 做两件事：
#   1. 从 deploy.sh 里**抽取真实的 fill / gen_secret / gen_db_password**，
#      处理 .env.example，看最终 deploy/.env 是否包含 compose 要求的全部必填变量。
#   2. 把结果喂给 `docker compose config`，让 compose 自己做最终校验。
#
# 背景：这一关已经抓到两个会让部署在服务器上才炸的真 bug ——
#      a) .env.example 缺 MYSQL_ROOT_PASSWORD，旧 fill 只 sed 替换不存在的行，
#         静默无操作；
#      b) `tr -c 'A-Za-z0-9' ''` 在 GNU coreutils 上是错误用法，
#         不输出任何内容，DB 口令被填成空串。
# =====================================================================
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${TMPDIR:-/tmp}/nb-deploy-check"
rm -rf "$WORK"
mkdir -p "$WORK/deploy"

cp "$REPO/deploy/docker-compose.prod.yml" "$WORK/deploy/"
cp "$REPO/deploy/.env.example"        "$WORK/deploy/.env"

# deploy.sh 里定义的日志函数（只是让输出好看）
info() { echo "  $*"; }

echo "=== 1. 从 deploy.sh 抽取真实函数 ==="
# $1 是**字面量**前缀，用 grep -F / awk index() 匹配，避免正则转义地狱
# （sed BRE 里 \{ 是区间开头，fill() { 这种写法会直接报 Unmatched \{ ）
grab() {
  local first rest
  first=$(grep -F -- "$1" "$REPO/deploy/deploy.sh" | head -1)
  [ -z "$first" ] && { echo "  [失败] deploy.sh 里找不到: $1"; exit 1; }
  if [[ "$first" =~ \}[[:space:]]*$ ]]; then
    eval "$first"                                                        # 单行定义
  else
    rest=$(awk -v s="$1" 'index($0,s)==1{f=1} f{print} f && /^\}/{exit}' "$REPO/deploy/deploy.sh")
    eval "$rest"                                                         # 多行定义
  fi
  echo "  已抽取 $1"
}
grab 'gen_secret() {'
grab 'gen_db_password() {'
grab 'fill() {'

echo
echo "=== 2. 模拟 deploy.sh 的环境变量准备阶段 ==="
ENV_FILE="$WORK/deploy/.env"

# ⚠️ 用 tail -1 而不是 head -1：.env 允许重复键，compose dotenv 的语义是
#    「后者覆盖前者」。若 .env 里同一键出现多次，取到的必须是最后一条，
#    否则会读到 .env.example 留下的空值而误判。
env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

# 模拟用户按提示在 .env 里手填的三项（deploy.sh 刻意不自动生成）
# 用 in-place 替换，贴近用户用 vi 编辑的真实行为
sed -i 's|^WX_APP_ID=.*|WX_APP_ID=wxTESTAPPID0001|'          "$ENV_FILE"
sed -i 's|^WX_APP_SECRET=.*|WX_APP_SECRET=0123456789abcdef0123456789abcdef|' "$ENV_FILE"
sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=TestAdminPass123|' "$ENV_FILE"

# 逐条照搬 deploy.sh 里的 fill 调用
sed -n '/^fill "MYSQL_ROOT_PASSWORD"/,/^fill "BOOTSTRAP_ADMIN_ENABLED"/p' "$REPO/deploy/deploy.sh" \
  | grep '^fill ' | while IFS= read -r line; do eval "$line"; done
echo "  已执行 deploy.sh 中全部 fill 调用"

echo
echo "=== 2b. 手写 .env（末行无换行）—— 回归用例 ==="
# ⚠️ 用户在本地写好 .env 再拖上去是常规操作，Windows 编辑器保存的文件
#    最后一行常常没有换行符。旧版 fill 直接 >> 会把新键粘到上一行：
#        GATEWAY_NETWORK=aitools-netMYSQL_ROOT_PASSWORD=xxx
#    表现为 compose 报「MYSQL_ROOT_PASSWORD is missing」，
#    同时 GATEWAY_NETWORK 被污染成一个不存在的网络名。这个坑踩过一次。
printf 'WX_APP_ID=wxTESTAPPID0001\nWX_APP_SECRET=0123456789abcdef0123456789abcdef\nADMIN_USERNAME=admin\nADMIN_PASSWORD=TestAdminPass123\nGATEWAY_NETWORK=aitools-net' > "$ENV_FILE"
if [ "$(tail -c 1 "$ENV_FILE" | wc -l)" -ne 0 ]; then
  bad "测试前提不成立：本用例需要构造一个末行无换行的 .env"
else
  echo "  已构造末行无换行的 4 行 .env"
  sed -n '/^fill "MYSQL_ROOT_PASSWORD"/,/^fill "BOOTSTRAP_ADMIN_ENABLED"/p' "$REPO/deploy/deploy.sh" \
    | grep '^fill ' | while IFS= read -r line; do eval "$line"; done
  # 每个键都必须独立成行、值非空
  STUCK=0
  for k in MYSQL_ROOT_PASSWORD DB_USERNAME DB_PASSWORD \
           JWT_PROVIDER_SECRET JWT_ADMIN_SECRET GATEWAY_NETWORK; do
    v=$(env_get "$k")
    if [ -z "$v" ]; then
      echo "  [空]  $k"
      STUCK=1
    elif [ "$k" = "GATEWAY_NETWORK" ] && [ "$v" != "aitools-net" ]; then
      echo "  [污染] GATEWAY_NETWORK 被改成 [$v]"
      STUCK=1
    else
      echo "  [OK]  $k = ${v:0:10}...(${#v} 字符)"
    fi
  done
  # 还要确认没有出现「粘行」痕迹
  if grep -qE '^GATEWAY_NETWORK=aitools-net[A-Z]' "$ENV_FILE"; then
    echo "  [粘行] GATEWAY_NETWORK 行尾还有别的键：$(grep '^GATEWAY_NETWORK=' "$ENV_FILE")"
    STUCK=1
  fi
  if [ "$STUCK" -eq 0 ]; then
    echo "  [OK]  末行无换行也能正确写入，未污染其它键"
    # 回到基于 .env.example 的完整场景继续后续校验
    cp "$REPO/deploy/.env.example" "$ENV_FILE"
    sed -i 's|^WX_APP_ID=.*|WX_APP_ID=wxTESTAPPID0001|' "$ENV_FILE"
    sed -i 's|^WX_APP_SECRET=.*|WX_APP_SECRET=0123456789abcdef0123456789abcdef|' "$ENV_FILE"
    sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=TestAdminPass123|' "$ENV_FILE"
    sed -n '/^fill "MYSQL_ROOT_PASSWORD"/,/^fill "BOOTSTRAP_ADMIN_ENABLED"/p' "$REPO/deploy/deploy.sh" \
      | grep '^fill ' | while IFS= read -r line; do eval "$line"; done
    echo "  已恢复完整 .env 场景并重跑 fill"
  else
    echo; echo "[FAIL] fill() 在「末行无换行」的文件上会写坏 .env"; exit 1
  fi
fi

echo
echo "=== 3. 检查 compose 声明的必填变量是否都已落盘且非空 ==="
MISSING=0
for k in MYSQL_ROOT_PASSWORD DB_USERNAME DB_PASSWORD \
         JWT_PROVIDER_SECRET JWT_ADMIN_SECRET \
         WX_APP_ID WX_APP_SECRET ADMIN_PASSWORD; do
  v=$(env_get "$k")
  if [ -z "$v" ]; then
    echo "  [空]  $k  <-- compose 的 \${$k:?必填} 会直接失败"
    MISSING=$((MISSING+1))
  elif [ "${#v}" -lt 16 ] && [ "$k" != "DB_USERNAME" ] && [ "$k" != "WX_APP_ID" ]; then
    echo "  [短]  $k = [$v] 仅 ${#v} 字符，疑似生成失败"
    MISSING=$((MISSING+1))
  else
    echo "  [OK]  $k = ${v:0:10}...(${#v} 字符)"
  fi
done
[ "$MISSING" -eq 0 ] || { echo; echo "[FAIL] $MISSING 个必填变量有问题"; exit 1; }

# JWT 两个密钥必须不同，否则服务者 token 和管理员 token 可互相冒用
JP=$(env_get JWT_PROVIDER_SECRET)
JA=$(env_get JWT_ADMIN_SECRET)
echo
if [ "$JP" = "$JA" ]; then echo "[FAIL] 两个 JWT 密钥相同"; exit 1; fi
echo "  [OK]  两个 JWT 密钥互不相同"

echo
echo "=== 4. docker compose config（compose 自己的最终校验）==="
cd "$WORK"
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env config > compose-resolved.yml
echo "  compose config 通过"

echo
echo
echo "=== 5. 关键点复核（结构化断言 compose 解析结果）==="
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env config --format json > compose.json
export PYTHONIOENCODING=utf-8
python - <<'PY'
import json, re, sys
d = json.load(open('compose.json', encoding='utf-8'))
svc = d['services']
ok = True

def check(cond, msg):
    global ok
    print(('  [OK] ' if cond else '  [!!] ') + msg)
    if not cond: ok = False

admin, backend, mysql = svc['admin'], svc['backend'], svc['mysql']
env = backend.get('environment', {})

# ── 端口：绝不能映射宿主机端口（同机 80/443 已被 aindgc 占用）──
check('ports' not in admin, 'nb-admin 未映射宿主机端口（不与 aindgc 抢 80/443）')
check(admin.get('container_name') == 'nb-admin', '容器名 nb-admin 固定（网关按此反代）')

# ── 网络：必须同时加入内部网和外部网关网 ──
# JSON 输出里 networks 是 dict（值为 null），不是 list
nets = admin.get('networks', {})
check(set(nets) >= {'gateway', 'nb-net'},
      f'nb-admin 同时加入内部网+网关网: {sorted(nets)}')
check(d['networks'].get('gateway', {}).get('external') is True,
      '网关网络 external=true（复用 aindgc 现有网络，不新建）')
check('nb-net' in backend.get('networks', {}) and 'nb-net' in mysql.get('networks', {}),
      '后端与 mysql 同处内部网络 nb-net（按容器名互访）')

# ── 后端：必须是 prod profile + 容器服务名寻址 ──
check(env.get('SPRING_PROFILES_ACTIVE') == 'prod',
      '后端 SPRING_PROFILES_ACTIVE=prod（不会发布开发降级二维码）')
check(env.get('DB_HOST') == 'mysql', 'DB_HOST=mysql（容器服务名，不是 127.0.0.1）')
check(backend.get('build', {}).get('dockerfile') == 'Dockerfile.prebuilt',
      '后端用 Dockerfile.prebuilt（服务器不跑 Maven，避免 1.6G 机器 OOM）')

# ── 内存上限 ──
# compose 会把 96M 规范化成字节字符串 "100663296"，不是数字
def mem(s):
    v = s.get('deploy', {}).get('resources', {}).get('limits', {}).get('memory')
    return int(v) if v is not None else 0
for name, s, want in (('mysql', mysql, 400), ('backend', backend, 560), ('admin', admin, 96)):
    m = mem(s)
    check(m == want * 1024 * 1024, f'{name} 内存上限 {want}M（解析为 {m} 字节）')
total = sum(mem(s) for s in (mysql, backend, admin)) / 1024 / 1024
check(total <= 1100, f'三个服务内存上限合计 {total:.0f}M（宿主仅 1.6G，需留余量）')

# ── 微信凭据必须来自 .env，不能有硬编码兜底 ──
check(env.get('WX_APP_ID') == 'wxTESTAPPID0001', 'WX_APP_ID 来自 .env')
check(env.get('WX_APP_SECRET') == '0123456789abcdef0123456789abcdef', 'WX_APP_SECRET 来自 .env')

# ── MySQL 必须收紧，且 schema.sql 走 entrypoint 初始化 ──
cmd = ' '.join(mysql.get('command', []))
check('innodb-buffer-pool-size=128M' in cmd, 'MySQL buffer pool 收紧到 128M')
check('performance-schema=OFF' in cmd, 'MySQL performance_schema 关闭（省内存）')
vols = [v.get('source', v) for v in mysql.get('volumes', [])]
check(any('schema.sql' in str(v) for v in vols), 'schema.sql 挂载到 entrypoint 初始化目录')

# ── 解析结果里不能出现字面量密钥 ──
raw = json.dumps(d, ensure_ascii=False)
leaks = re.findall(r'(NbLocal2026Dev|AdminDev123456|change-me)', raw)
check(not leaks, f'解析结果无密钥字面量（发现 {len(leaks)} 处）')

# ── 健康检查 ──
check('healthcheck' in mysql, 'mysql 配置了 healthcheck')
check(backend.get('depends_on', {}).get('mysql', {}).get('condition') == 'service_healthy',
      'backend 等 mysql healthy 后才启动')

sys.exit(0 if ok else 1)
PY

echo
echo "=== 6. compose 无法离线验证的部分（必须在服务器上确认）==="
echo "  1) external 网关网络是否存在；填错 -> 网关侧 502 (host not found)"
echo "     docker network ls"
echo "     docker inspect <aindgc-nginx 容器名> --format '{{json .NetworkSettings.Networks}}'"
echo "  2) 1.6G 内存机器上 docker compose 能否真跑起来（从未实测过）"
echo "  3) 镜像能否拉取（公司网/国内服务器可能被墙）"