#!/usr/bin/env bash
# 按环境启动后端：./run.sh dev | prod
# 读取 .env.<profile> 注入环境变量，并以 SPRING_PROFILES_ACTIVE=<profile> 启动 mvn spring-boot:run
set -euo pipefail

PROFILE="${1:-dev}"
ENV_FILE=".env.${PROFILE}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "错误：找不到环境文件 $ENV_FILE" >&2
  exit 1
fi

# 读取 .env.<profile> 并导出为环境变量（兼容 # 注释与 export 前缀，自动去引号）
set -a
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"                       # 去掉注释
  line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  line="${line#export }"                   # 去掉可选 export 前缀
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    export "$name=$value"
  fi
done < "$ENV_FILE"
set +a

export SPRING_PROFILES_ACTIVE="$PROFILE"
echo "▶ 以 profile=$PROFILE 启动后端（已加载 $ENV_FILE）"
cd backend
exec mvn spring-boot:run
