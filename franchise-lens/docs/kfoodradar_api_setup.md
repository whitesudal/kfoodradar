# kfoodradar API Setup

작성일: 2026-04-03

## 1. 필요한 API 키

kfoodradar의 `Reddit + YouTube + 네이버 블로그` 수집 레이어를 실제로 돌리려면 아래 환경변수가 필요하다.

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

YOUTUBE_API_KEY=

REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT="kfoodradar/0.1 (by /u/your_reddit_username)"

INTERNAL_API_KEY=

ARO_ROOT=/home/appuser/aro
AI_DB_PYTHON_BIN=python3
```

## 2. 발급 위치

### 네이버

- NAVER Developers
- Search API 사용 설정

### YouTube

- Google Cloud Console
- YouTube Data API v3 활성화
- API Key 발급

### Reddit

- Reddit App 등록
- app type은 서버 보관형이면 `web app` 또는 `script` 계열로 운영
- app-only OAuth 용도로 `client_id`, `client_secret`, `user agent` 준비

## 3. 현재 추가된 코드

### 클라이언트

- `src/lib/naver.ts`
  - 블로그 total, 최근 7일 게시물 수, 지역 신호, 방문 의도 점수
- `src/lib/youtube.ts`
  - 영상 검색, 조회수/댓글수, 최근 업로드 수, 채널 다양도
- `src/lib/reddit.ts`
  - app-only OAuth 토큰 발급, 검색 결과 기반 게시글/댓글/업보트 집계
- `src/lib/foodbus-ai.ts`
  - `aro`의 foodbus PostgreSQL 경로를 재사용해 메뉴 키워드의 AI 응답 노출량, 모델 분포, evidence, 연관 식당 추출

### 하네스

- `src/lib/menu-signal-collector.ts`
  - 3채널 수집 결과를 하나로 묶고 트렌드 점수 계산
  - AI DB 기반 `aiTrend`, `decisionSignal` 추가

### API Route

- `GET /api/trends/collect?menu=콩국수`
  - 내부 키가 설정된 경우 `x-internal-api-key` 헤더 또는 `key` 쿼리로 인증
  - 응답에 `trend`, `aiTrend`, `decisionSignal`, `channels` 포함
- `GET /api/trends/top`
  - 현재는 DB 테이블 없으면 fixture 반환

## 4. 테스트 예시

내부 키가 설정되지 않은 로컬 환경:

```bash
curl "http://localhost:3000/api/trends/collect?menu=콩국수"
```

내부 키가 설정된 환경:

```bash
curl \
  -H "x-internal-api-key: YOUR_INTERNAL_API_KEY" \
  "http://localhost:3000/api/trends/collect?menu=콩국수"
```

## 5. 운영 주의

### YouTube

- `search.list`는 quota 비용이 크다.
- 동일 메뉴는 캐시하고 배치 수집으로 돌리는 것이 좋다.

### Reddit

- User-Agent를 명확하게 넣어야 한다.
- 원문 대량 저장보다 파생 지표 저장을 권장한다.

### AI DB

- 현재 foodbus DB는 브랜드/식당 중심 자산이므로 메뉴 키워드 조회는 `raw_text`, `evidence_line` 기반 메뉴형 트렌드로 해석한다.
- `trend.totalTrendScore`는 대중 채널 점수이고, `decisionSignal.finalDecisionScore`는 AI DB를 포함한 최종 판단 점수다.

### 네이버

- Search API 결과 메타데이터/snippet 중심으로 사용한다.
- 본문 직접 크롤링이 아니라 공식 API 기반으로 운영한다.

## 6. 다음 권장 작업

1. `TrendSnapshot` 저장 배치 작성
2. `TrendScore` 일일 적재
3. `TrendInterpretation` 규칙 엔진 연결
4. `MerchantTrendFit`과 `aro/axsign` 연동
