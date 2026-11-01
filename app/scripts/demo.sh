#!/usr/bin/env bash
# 사용: scripts/demo.sh [BASE_URL] [USER] [CHARACTER] [TURNS]
set -euo pipefail
BASE=${1:-http://localhost:3000}; USER_NAME=${2:-demo}; CHAR=${3:-baekho}; TURNS=${4:-5}
H=(-s -H 'content-type: application/json' -H 'ngrok-skip-browser-warning: 1')
CID=$(curl "${H[@]}" -XPOST "$BASE/api/conversations" -d "{\"user_name\":\"$USER_NAME\",\"character_id\":\"$CHAR\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).conversation_id')
echo "conversation $CID"
for i in $(seq 1 "$TURNS"); do
  curl "${H[@]}" -XPOST "$BASE/api/conversations/$CID/messages" -d "{\"text\":\"테스트 메시지 $i 번째야\"}"; echo
done
curl "${H[@]}" -XPOST "$BASE/api/conversations/$CID/end"; echo
