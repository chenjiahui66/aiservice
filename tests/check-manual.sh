#!/usr/bin/env bash
# 从 docs/部署手册.md 里抽出所有 bash 代码块，逐个做语法检查
# 目的：手册里的命令用户要照着敲，语法错了就是真坑。
set -uo pipefail

DOC="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docs/部署手册.md}"
TMP=$(mktemp -d)
python - "$DOC" "$TMP" <<'PY'
import re, sys, os, pathlib
doc, out = sys.argv[1], sys.argv[2]
text = open(doc, encoding='utf-8').read()
# 只取 ```bash ... ``` 块
blocks = re.findall(r'```bash\n(.*?)```', text, re.S)
for i, b in enumerate(blocks):
    pathlib.Path(out, f'block{i:02d}.sh').write_text(b, encoding='utf-8')
print(f'抽出 {len(blocks)} 个 bash 代码块')
PY

echo
echo "=== 逐块 bash -n 语法检查 ==="
FAIL=0
for f in "$TMP"/*.sh; do
  n=$(basename "$f" .sh)
  if bash -n "$f" 2>"$TMP/err"; then
    echo "  [OK]   $n"
  else
    echo "  [!!]   $n"
    sed 's/^/         /' "$TMP/err"
    FAIL=$((FAIL+1))
  fi
done

echo
echo "=== 检查引用的命令是否自洽 ==="
export PYTHONIOENCODING=utf-8
python - "$DOC" <<'PY'
import re, sys
doc = sys.argv[1]
text = open(doc, encoding='utf-8').read()

problems = []
# 占位符未解释 = 用户照抄会失败
placeholders = sorted(set(re.findall(r'<([A-Z_]{2,})>', text)))
print(f"  尖括号占位符: {placeholders}   (<GW> 是留给用户替换的变量名，不是笔误)")

# 变量是否先赋值后使用
for var in ('GW', 'CONFD', 'SSLDIR', 'WEBROOT', 'COMPOSE'):
    assign = [m.start() for m in re.finditer('^' + var + '=', text, re.M)]
    # $VAR  和  ${VAR}  两种写法都算使用
    uses = [m.start() for m in re.finditer(re.escape('${' + var + '}'), text)]
    uses += [m.start() for m in re.finditer(re.escape('$' + var), text)]
    uses = [u for u in uses if u not in assign]      # 排除赋值行右侧
    if not uses:
        print(f"  [--] ${var} 未被使用")
        continue
    first_use = min(uses)
    if not assign:
        print(f"  [!!] ${var} 被使用但从未赋值 -> 用户照抄会得到空值")
        problems.append(var)
    elif assign[0] > first_use:
        print(f"  [!!] ${var} 先用后定义（首次使用在第 {first_use} 字符，赋值在 {assign[0]}）")
        problems.append(var)
    else:
        print(f"  [OK] ${var} 先赋值后使用")

# 关键变量必须有赋值
for var in ('GW', 'CONFD'):
    if not re.search('^' + var + '=', text, re.M):
        problems.append(var)

sys.exit(1 if problems else 0)
PY
[ $? -ne 0 ] && FAIL=$((FAIL+1))

echo
echo "=== 检查文档里承诺的章节是否都存在 ==="
for s in "上传并解压" "查清网关信息" "填环境变量" "执行部署" "网关接入" "签发证书" "验收" "出问题了怎么办"; do
  if grep -q "$s" "$DOC"; then echo "  [OK] $s"; else echo "  [!!] 缺章节: $s"; FAIL=$((FAIL+1)); fi
done

rm -rf "$TMP"
echo
echo "============================================================"
[ "$FAIL" -eq 0 ] && echo "[PASS] 手册命令语法全部通过" || echo "[FAIL] $FAIL 项有问题"
echo "============================================================"
exit "$FAIL"
