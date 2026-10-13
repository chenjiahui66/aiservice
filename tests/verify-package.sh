#!/usr/bin/env bash
# =====================================================================
# 部署包落地验证：模拟「上传到服务器 -> 解压 -> 起服务」
#
# 只验能离线验的部分，验不了的会明确列出来，不含糊。
#
# 重点查这几类「本地看不出来、上服务器才炸」的问题：
#   1. CRLF —— .sh 带 CR 会报 bad interpreter: /usr/bin/env bash\r
#   2. 反斜杠路径 —— Windows 压缩的经典坑
#   3. 前端 chunk 缺失 —— index.html 引用的 js 没进包 = 打开白屏
#   4. 编排文件本身能不能过 compose 校验
# =====================================================================
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$REPO/nbservice-deploy.tar.gz"
WORK="${TMPDIR:-/tmp}/nb-pkgcheck"

FAIL=0
ok()   { echo "  [OK] $*"; }
bad()  { echo "  [!!] $*"; FAIL=$((FAIL+1)); }

[ -f "$PKG" ] || { echo "[FAIL] 找不到 $PKG，先跑 scripts/package-deploy.cmd"; exit 1; }

echo "=== 0. 基本信息 ==="
echo "  包: $PKG"
echo "  大小: $(du -h "$PKG" | cut -f1)"

echo
echo "=== 1. 解压 ==="
rm -rf "$WORK"; mkdir -p "$WORK"
tar -xzf "$PKG" -C "$WORK"
echo "  已解压到 $WORK"

echo
echo "=== 2. CRLF 检查（Linux 上最常见的翻车点）==="
# 这些文件会被 Linux 直接执行/解析，带 CR 就炸
CRLF_BAD=0
while IFS= read -r f; do
  if grep -qU $'\r' "$f" 2>/dev/null; then
    bad "含 CR: ${f#$WORK/}"
    CRLF_BAD=$((CRLF_BAD+1))
  fi
done < <(find "$WORK" \( -name '*.sh' -o -name 'Dockerfile*' -o -name '*.yml' -o -name '*.conf' -o -name '*.sql' \) -type f)
[ "$CRLF_BAD" -eq 0 ] && ok "全部 .sh / Dockerfile / .yml / .conf / .sql 均为 LF 行尾"

echo
echo "=== 3. tar 条目路径分隔符与中文文件名 ==="
# ⚠️ 查的是**条目名**，不是文件内容。
#    文件内容里有反斜杠是正常的：deploy.sh 的 ANSI 转义 \033[0;31m、
#    minified JS 的正则转义、Dockerfile 的续行符 \ 都合法。
#    真正要防的是「条目名」用 \ 分隔 —— 那样 Linux 解开会变成畸形文件名。
#
# ⚠️ 用 Python 的 tarfile 直接读压缩包，不用 shell 管道：
#    Windows 控制台按 GBK 解码，中文文件名会显示成乱码并误判。
export PYTHONIOENCODING=utf-8
python - "$PKG" <<'PY'
import sys, tarfile
p = sys.argv[1]
with tarfile.open(p, 'r:gz') as tf:
    names = tf.getnames()
fails = 0
bs = [n for n in names if '\\' in n]
if bs:
    print(f"  [!!] {len(bs)} 个条目用反斜杠分隔:")
    for n in bs[:5]:
        print(f"      {n!r}")
    fails += 1
else:
    print(f"  [OK] {len(names)} 个条目全部使用正斜杠")

# 中文文件名必须以 UTF-8 正确存储，否则 Linux 上解压出来是乱码
cjk = [n for n in names if any(ord(c) > 127 for c in n)]
if not cjk:
    print("  [--] 包内无中文文件名")
else:
    bad = [n for n in cjk if '�' in n]
    if bad:
        print(f"  [!!] {len(bad)} 个条目名含替换字符 U+FFFD（编码损坏）:")
        for n in bad[:5]:
            print(f"      {n!r}")
        fails += 1
    else:
        print(f"  [OK] {len(cjk)} 个中文条目名均为合法 UTF-8:")
        for n in cjk:
            print(f"      {n}")
sys.exit(1 if fails else 0)
PY
[ $? -ne 0 ] && FAIL=$((FAIL+1))

echo
echo "=== 4. 关键文件 ==="
for f in backend/target/neighborhood-backend.jar \
         backend/Dockerfile.prebuilt \
         deploy/deploy.sh \
         deploy/pull-images.sh \
         deploy/docker-compose.prod.yml \
         deploy/.env.example \
         deploy/README.md \
         deploy/nginx/community-gateway.conf \
         deploy/nginx/community-gateway-http.conf \
         deploy/nginx/community-internal.conf \
         sql/schema.sql \
         sql/seed.sql \
         admin-web/dist/index.html ; do
  [ -f "$WORK/$f" ] && ok "$f" || bad "缺失 $f"
done

echo
echo "=== 5. nginx 配置结构检查 ==="
# ⚠️ 这几个文件会被塞进承载 www.aindgc.com 的网关容器。
#    花括号不配对 -> nginx -t 失败 -> 重启后整个网关起不来 -> 线上站点中断。
#    所以离线先验一遍。
for f in "$WORK"/deploy/nginx/*.conf; do
  name=$(basename "$f")
  open=$(tr -cd '{' < "$f" | wc -c)
  close=$(tr -cd '}' < "$f" | wc -c)
  servers=$(grep -c '^\s*server\s*{' "$f" || true)
  if [ "$open" -ne "$close" ]; then
    bad "$name 花括号不配对（{ $open 个 vs } $close 个）"
  elif [ "$servers" -lt 1 ]; then
    bad "$name 里没有 server 块"
  else
    ok "$name 花括号配对（$servers 个 server 块，{ $open / } $close）"
  fi
done

# 只 HTTP 版必须不含 443，否则又回到「证书未签发就起不来」的老问题
HTTPCONF="$WORK/deploy/nginx/community-gateway-http.conf"
if grep -qE '^\s*listen\s+.*443' "$HTTPCONF"; then
  bad "community-gateway-http.conf 里出现了 443 监听（应只含 80，证书未签发时会导致网关起不来）"
else
  ok "community-gateway-http.conf 只监听 80（证书未签发阶段可安全安装）"
fi
# 完整版必须含 443 和证书路径，否则装上去也提供不了 HTTPS
FULLCONF="$WORK/deploy/nginx/community-gateway.conf"
grep -qE '^\s*listen\s+.*443' "$FULLCONF" \
  && ok "community-gateway.conf 含 443 块（证书就位后使用）" \
  || bad "community-gateway.conf 缺 443 块"
grep -q 'ssl_certificate ' "$FULLCONF" \
  && ok "community-gateway.conf 引用了 ssl_certificate" \
  || bad "community-gateway.conf 缺 ssl_certificate"

echo
echo "=== 5b. 两个网关文件不可同时安装 ==="
cat <<'EOF'
  ⚠️ community-gateway-http.conf 和 community-gateway.conf 的
     server_name 都是 community.aindgc.com、都监听 80。
     同时放进 conf.d 会让 nginx -t 报
       conflicting server name "community.aindgc.com" on 0.0.0.0:80
     同样导致网关起不来、www.aindgc.com 一起挂。
     正确做法：先装 http 版，证书就位后【覆盖】同名文件，不是新增。
EOF

echo
echo "=== 6. deploy/.env 绝不能在包里 ==="
[ -f "$WORK/deploy/.env" ] && bad "包里存在 deploy/.env（含密钥）" || ok "包内无 deploy/.env"

echo
echo "=== 7. 旧版编排文件不该残留 ==="
[ -f "$WORK/deploy/docker-compose.yml" ] \
  && bad "包内仍有旧版 deploy/docker-compose.yml（裸跑 docker compose 会选中它）" \
  || ok "无旧版 docker-compose.yml"

echo
echo "=== 8. jar 完整性 ==="
export PYTHONIOENCODING=utf-8
python - "$WORK/backend/target/neighborhood-backend.jar" <<'PY'
import sys, zipfile
p = sys.argv[1]
try:
    z = zipfile.ZipFile(p)
    bad = z.testzip()
    names = z.namelist()
    must = ['BOOT-INF/classes/application-prod.yml', 'BOOT-INF/classes/application.yml']
    print(f"  [OK] jar 可解压，条目 {len(names)} 个，CRC 全部通过" if bad is None
          else f"  [!!] jar 内损坏条目: {bad}")
    missing = [m for m in must if m not in names]
    for m in must:
        print(f"  [OK] 含 {m}" if m in names else f"  [!!] 缺 {m}")
    sys.exit(1 if (bad or missing) else 0)
except Exception as e:
    print(f"  [!!] jar 无法打开: {e}")
    sys.exit(1)
PY
[ $? -ne 0 ] && FAIL=$((FAIL+1))

echo
echo "=== 9. 前端产物自洽（chunk 缺失 = 打开白屏）==="
python - "$WORK" <<'PY'
import os, re, sys
root = sys.argv[1]
html = open(os.path.join(root, 'admin-web/dist/index.html'), encoding='utf-8').read()
refs = re.findall(r'(?:src|href)="([^"]+)"', html)
refs = [r for r in refs if r.startswith('/')]
if not refs:
    print("  [!!] index.html 里没有任何本地资源引用"); sys.exit(1)
missing = [r for r in refs if not os.path.isfile(os.path.join(root, 'admin-web/dist', r.lstrip('/')))]
print(f"  [OK] index.html 引用 {len(refs)} 个资源，全部存在" if not missing
      else f"  [!!] 缺失 {len(missing)} 个: {missing}")
sys.exit(1 if missing else 0)
PY
[ $? -ne 0 ] && FAIL=$((FAIL+1))

echo
echo "=== 10. 用包里的编排文件再跑一遍 compose 校验 ==="
# 把校验脚本放进包内，让 REPO 指向解压目录，验的是「真正要发出去的那份」
mkdir -p "$WORK/tests"
cp "$REPO/tests/check-deploy-config.sh" "$WORK/tests/"
if bash "$WORK/tests/check-deploy-config.sh" > "$WORK/../nb-pkgcheck.log" 2>&1; then
  ok "解压出来的 deploy/ 通过全部 compose 校验"
  grep -c '\[OK\]' "$WORK/../nb-pkgcheck.log" | sed 's/^/        通过断言数: /'
else
  bad "解压出来的 deploy/ 未通过 compose 校验，详见："
  tail -25 "$WORK/../nb-pkgcheck.log" | sed 's/^/    /'
fi

echo
echo "============================================================"
if [ "$FAIL" -eq 0 ]; then
  echo "[PASS] 部署包落地验证全部通过"
else
  echo "[FAIL] $FAIL 项未通过"
fi
echo "============================================================"
echo
echo "本脚本验不了的（必须在服务器上确认）："
echo "  1) external 网关网络是否存在 -> docker network ls"
echo "  2) 1.6G 机器上 docker compose 能否真起来 -> 首次实测"
echo "  3) 镜像能否拉取 -> 国内/公司网可能被墙"
exit "$FAIL"
