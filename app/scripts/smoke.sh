#!/usr/bin/env bash
# 앱 스모크: 짧은 stair 설정 서버를 따로 띄워 대화 → 종료 없이 닫기 → 새 대화에서 창 이월·정리 추출 확인.
# 사용: scripts/smoke.sh   (next build 가 끝난 상태에서, 앱 디렉터리 기준)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=3102; B=localhost:$PORT/api
APP_STAIR_MAX=4 APP_RECENT_TURNS=2 npx next start -p $PORT > /dev/null 2>&1 &
SRV=$!; trap 'pkill -P $SRV 2>/dev/null; kill $SRV 2>/dev/null' EXIT
until curl -sf $B/characters > /dev/null; do sleep 0.5; done

U="smoke-$(date +%s)"; fail=0
start() { curl -sf -XPOST $B/conversations -H 'content-type: application/json' -d "{\"user_name\":\"$U\",\"character_id\":\"baekho\"}" | sed -E 's/.*"conversation_id":([0-9]+).*/\1/'; }
say() { curl -sf -XPOST $B/conversations/$1/messages -H 'content-type: application/json' -d "{\"text\":\"$2\"}" > /dev/null || { echo "FAIL 턴 $2"; fail=1; }; }

A=$(start); say $A "안녕 나 지훈이야"; say $A "나 다음 달에 제주도 간다"; say $A "강아지 이름은 콩이야"
C=$(start); say $C "오늘 날씨 좋다"   # 이월 3턴 + 1턴 = 4턴 → 정리
mem=$(curl -sf -G $B/memory --data-urlencode "user=$U")
echo "$mem" | grep -q '"conversation_id":'"$A" && echo "OK 이월 턴이 정리 추출됨(출처 대화 $A)" || { echo "FAIL 이월 정리 추출 없음"; fail=1; }
rep=$(curl -sf -XPOST $B/conversations/$C/end)
echo "$rep" | grep -q '"failed_calls":0' && echo "OK 실패 호출 0" || { echo "FAIL 실패 호출 있음"; fail=1; }
echo "$rep" | grep -q '"turns":1,' && echo "OK 리포트 턴 수는 이 대화 것만(1)" || { echo "FAIL 리포트 턴 수"; fail=1; }

# /end: 정리 안 된 창을 바로 추출(end_flush) → 다음 대화로 이월되지 않음
U="smoke-end-$(date +%s)"
E=$(start); say $E "나 고양이 키워, 이름은 보리야"; say $E "요즘 회사 일이 바빠"
curl -sf -XPOST $B/conversations/$E/end > /dev/null
curl -sf -G $B/memory --data-urlencode "user=$U" | grep -q '"conversation_id":'"$E" && echo "OK 종료 시 남은 창 추출됨(대화 $E)" || { echo "FAIL 종료 시 추출 없음"; fail=1; }
left=$(sqlite3 data/app.db "SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id, stair_windows w
  WHERE w.user_id=c.user_id AND w.character_id=c.character_id AND c.user_id='$U' AND m.id>=w.start_msg_id")
[ "$left" = 0 ] && echo "OK 종료한 대화는 다음 창으로 이월 안 됨" || { echo "FAIL 종료 후 창에 $left 개 남음"; fail=1; }
exit $fail
