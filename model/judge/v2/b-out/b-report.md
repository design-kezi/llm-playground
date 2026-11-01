# 판단 모델 v2 B단계 결과 (실제 추출 흐름, 한국어)

생성: 2026-10-23T17:18:13.415Z · 원자료: model/judge/v2/b-out/*.json · 정답: b-gold.json · 규칙: docs/50-decision-log.md

| 모델 | 런 | 사실 저장률 (평균, 범위) | baekho / naruto / backend / sejong | 옛 값 잔존/런 | 구조 누락 | 추출 파싱 실패 단계 | 정리 실패 / 에피소드 생성 | 실패 호출 | 잘림 | UPDATE / SKIPPED / AS_ADD / RETARGET | 턴당 기억 비용 (추출+정리) | 추출 출력 토큰/런 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-5-5 | 12 | 90.0 (76.9~100.0) | 100.0 / 82.1 / 92.3 / 85.7 | 0.17 | 0 | 0 | 0 / 12 | 0 | 0 | 67 / 1 / 2 / 0 | 0.111원 (추출 0.095 + 정리 0.015) | 1964 |
| deepseek-flash | 12 | 95.7 (85.7~100.0) | 100.0 / 92.3 / 100.0 / 90.5 | 0.00 | 0 | 0 | 0 / 12 | 0 | 0 | 61 / 0 / 1 / 0 | 0.078원 (추출 0.069 + 정리 0.009) | 1216 |
| gemini-3.5-flash-lite | 12 | 91.4 (76.9~100.0) | 90.5 / 84.6 / 100.0 / 90.5 | 0.50 | 1 | 1 | 0 / 12 | 0 | 0 | 63 / 0 / 1 / 0 | 0.389원 (추출 0.363 + 정리 0.026) | 1123 |
| google/gemma-4-26B-A4B-it | 12 | 87.1 (69.2~100.0) | 85.7 / 84.6 / 94.9 / 83.3 | 0.50 | 0 | 0 | 12 / 0 | 0 | 1 | 74 / 2 / 0 / 0 | 0.091원 (추출 0.080 + 정리 0.011) | 1539 |
| google/gemma-4-31B-it | 12 | 96.3 (92.3~100.0) | 100.0 / 92.3 / 100.0 / 92.9 | 0.00 | 0 | 0 | 0 / 12 | 0 | 0 | 60 / 0 / 0 / 0 | 0.202원 (추출 0.189 + 정리 0.013) | 1039 |
| gpt-6-luna | 12 | 82.1 (61.5~100.0) | 85.7 / 69.2 / 94.9 / 78.6 | 0.58 | 0 | 0 | 0 / 12 | 0 | 0 | 49 / 0 / 4 / 0 | 0.064원 (추출 0.056 + 정리 0.008) | 1113 |

## 놓친 사실 (빈도 = 런 수)

- **claude-haiku-5-5**: naruto:오빠 물 좋아함 ×3, naruto:온 이유 비밀 ×3, sejong:온 이유 비밀 ×3, backend:자전거 ×1, backend:이직 제안 ×1, backend:클라이밍(수영 대체) ×1, naruto:종이학 ×1, sejong:우유 ×1, sejong:돌아감 25일 ×1, sejong:동생 고기 좋아함 ×1
- **deepseek-flash**: naruto:온 이유 비밀 ×3, sejong:온 이유 비밀 ×3, sejong:광화문 일요일 ×1
- **gemini-3.5-flash-lite**: baekho:노래방 취소 ×3, naruto:온 이유 비밀 ×3, sejong:온 이유 비밀 ×3, naruto:불꽃놀이 취소 ×2, baekho:좋아하는 사람 ×1, naruto:약방 ×1, sejong:탈춤 취소 ×1
- **google/gemma-4-26B-A4B-it**: baekho:좋아하는 사람 ×3, naruto:온 이유 비밀 ×3, sejong:보리차 ×3, sejong:온 이유 비밀 ×3, baekho:두유 ×2, backend:Kafka 리뷰(캐릭터 약속) ×1, backend:이직 제안 ×1, baekho:우유 ×1, naruto:찻집 일요일 ×1, naruto:불꽃놀이 취소 ×1, naruto:검술(달리기 대체) ×1, sejong:동생 고기 좋아함 ×1
- **google/gemma-4-31B-it**: naruto:온 이유 비밀 ×3, sejong:온 이유 비밀 ×3
- **gpt-6-luna**: baekho:좋아하는 사람 ×3, naruto:약방 ×3, naruto:오빠 물 좋아함 ×3, naruto:온 이유 비밀 ×3, sejong:편집자 ×3, sejong:돌아감 25일 ×3, sejong:온 이유 비밀 ×3, backend:이직 제안 ×2, baekho:수영(줄넘기 대체) ×2, baekho:기말고사 ×1, naruto:검술(달리기 대체) ×1, naruto:고양이 이름(최종 유자) ×1, naruto:고향 ×1

## 옛 값 잔존 (빈도 = 런 수)

- **claude-haiku-5-5**: baekho:노래방 살아 있음 ×1, naruto:불꽃놀이 살아 있음 ×1
- **deepseek-flash**: 없음
- **gemini-3.5-flash-lite**: baekho:노래방 살아 있음 ×3, baekho:줄넘기 계속 ×1, naruto:달리기 계속 ×1, sejong:탈춤 살아 있음 ×1
- **google/gemma-4-26B-A4B-it**: backend:수영 계속 ×1, baekho:옛 강아지 이름 ×1, naruto:찻집 토요일 ×1, naruto:불꽃놀이 살아 있음 ×2, naruto:달리기 계속 ×1
- **google/gemma-4-31B-it**: 없음
- **gpt-6-luna**: baekho:노래방 살아 있음 ×2, baekho:줄넘기 계속 ×2, naruto:옛 고양이 이름 ×1, sejong:활쏘기 계속 ×2