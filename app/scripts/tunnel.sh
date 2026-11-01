#!/bin/zsh
# 데모 서버(3000)를 ngrok 으로 연다. 주소·계정은 레포 루트 .env 의 TUNNEL_URL·TUNNEL_AUTH 고정값을 쓴다(매번 바뀌지 않게).
set -e
ENV=${0:A:h}/../../.env
AUTH=$(grep '^TUNNEL_AUTH=' $ENV | cut -d= -f2-)
URL=$(grep '^TUNNEL_URL=' $ENV | cut -d= -f2-)
[[ -n $AUTH ]] || { echo ".env 에 TUNNEL_AUTH=사용자:비밀번호 필요"; exit 1; }
exec ngrok http 3000 --basic-auth "$AUTH" ${URL:+--url "$URL"} --log stdout --log-format logfmt
