#!/usr/bin/env bash
# =====================================================================
# 预拉取基础镜像（解决 Docker Hub 在国内被墙 / DNS 污染的问题）
#
# 典型报错：
#   failed to resolve reference "docker.io/library/mysql:8.0":
#   dial tcp 157.240.12.36:443: i/o timeout
#
#   157.240.12.36 是 Facebook 的 IP 段 —— registry-1.docker.io 被 DNS 污染了，
#   请求根本没发到 Docker Hub。换镜像源无效，必须换**拉取入口**。
#
# 本脚本的做法：逐个试国内公共源，拉到后 docker tag 重打成标准名。
# 因为重打成了 `mysql:8.0`，compose 和 Dockerfile **一个字都不用改**。
#
# 幂等：本地已有镜像直接跳过，中断后重跑安全。
#
# 用法：
#   chmod +x deploy/pull-images.sh
#   ./deploy/pull-images.sh
# =====================================================================
set -Eeuo pipefail

# compose 与 Dockerfile 里用到的全部基础镜像
IMAGES=(
  "mysql:8.0"                       # deploy/docker-compose.prod.yml -> mysql 服务
  "nginx:alpine"                    # deploy/docker-compose.prod.yml -> admin 服务
  "eclipse-temurin:17-jre-alpine"   # backend/Dockerfile.prebuilt 的 FROM
)

# 按可靠性排序的国内公共源
# （这批在 47.98.253.138 上实际验证过；aindgc 站点当初也是这么拉下来的）
MIRRORS=(
  "docker.m.daocloud.io"
  "dockerproxy.net"
  "hub.rat.dev"
  "docker.1ms.run"
  "docker.nju.edu.cn"
  "mirror.baidubce.com"
)

info() { printf '\033[1;34m[img]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail "未安装 docker"
docker info >/dev/null 2>&1 || fail "Docker 引擎没运行（systemctl start docker）"

# ---------------------------------------------------------------------
# 诊断：先确认到底是 DNS 污染还是完全不通
# ---------------------------------------------------------------------
info "诊断 Docker Hub 连通性"
for h in registry-1.docker.io docker.m.daocloud.io; do
  ip=$(getent hosts "$h" 2>/dev/null | awk '{print $1}' | head -1 || true)
  if [ -n "$ip" ]; then
    info "  $h -> $ip"
  else
    warn "  $h 解析失败"
  fi
done
IP=$(getent hosts registry-1.docker.io 2>/dev/null | awk '{print $1}' | head -1 || true)
if [ -n "$IP" ] && [[ "$IP" =~ ^(31\.|34\.|13\.|52\.|54\.|104\.|142\.|157\.240\.) ]]; then
  warn "  registry-1.docker.io 解析到 $IP，看起来是被 DNS 污染了（正常应是 AWS/Cloudflare 段）"
  warn "  这是本脚本存在的原因：换源才能解决，换 DNS 解析器通常没用"
fi

# ---------------------------------------------------------------------
# 拉取
# ---------------------------------------------------------------------
pull_one() {
  local img="$1"
  if docker image inspect "$img" >/dev/null 2>&1; then
    ok "$img 本地已存在，跳过"
    return 0
  fi

  # official images 在 registry 里位于 library/ 下，两种写法都试
  for m in "${MIRRORS[@]}"; do
    for ref in "$m/library/$img" "$m/$img"; do
      info "  尝试 $ref"
      if timeout 300 docker pull "$ref" >/dev/null 2>&1; then
        # 重打成标准名，这样 compose / Dockerfile 完全不用改
        docker tag "$ref" "$img"
        ok "$img <- $m"
        return 0
      fi
    done
    warn "  $m 不可用，换下一个"
  done
  return 1
}

echo
info "开始拉取 ${#IMAGES[@]} 个基础镜像"
FAILED=""
for img in "${IMAGES[@]}"; do
  echo
  info "── $img ──"
  pull_one "$img" || FAILED="$FAILED $img"
done

echo
if [ -n "$FAILED" ]; then
  fail "以下镜像拉取失败：$FAILED

可选处理方式：
  1) 换网络环境重试（公司网/校园网通常全断）
  2) 配置云厂商镜像加速器（阿里云 ECS 控制台 -> 容器镜像服务 -> 镜像工具）
  3) 本地拉取后离线导入：
       docker save mysql:8.0 nginx:alpine eclipse-temurin:17-jre-alpine -p images.tar
       scp images.tar root@<IP>:/opt/
       docker load -i /opt/images.tar
  4) 代理：给 dockerd 配 HTTP_PROXY（重启 dockerd 生效）"
fi

ok "全部镜像就绪：${IMAGES[*]}"
echo
info "可以继续部署："
info "  cd \$(pwd) && ./deploy/deploy.sh"
