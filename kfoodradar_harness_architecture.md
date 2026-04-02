# kfoodradar Harness Architecture

작성일: 2026-04-03

## 1. 제품 한 줄 정의

kfoodradar는 `Reddit(원인) + YouTube(확산) + 네이버 블로그(전환) + AI 채널(추천/노출)`을 하나의 판단 루프로 묶어
K-food 메뉴가 어디서 왜 뜨는지 알려주는
`K-food 트렌드 인텔리전스 시스템`이다.

핵심 산출물은 단순 데이터 목록이 아니라 아래 3가지다.

1. 메뉴별 트렌드 점수
2. 채널별 해석 문장
3. 점포별 실행 액션

## 2. 하네스 엔지니어링 관점

이번 시스템은 "모델 하나가 다 알아서 해주는 구조"로 만들면 망한다.
반드시 단계별 입력/출력/검증 기준을 가진 하네스로 설계해야 한다.

### 2.1 하네스 원칙

1. 모든 단계는 입력 계약과 출력 계약이 있어야 한다.
2. 모든 추천은 근거 지표와 소스 링크를 남겨야 한다.
3. 모든 점수는 재계산 가능해야 한다.
4. 모든 자동 해석은 규칙 기반 설명이 먼저 오고, LLM은 문장화와 액션 확장에만 쓴다.
5. 법적 리스크가 있는 데이터는 원본 저장보다 파생 지표 저장을 우선한다.

### 2.2 평가 하네스

각 레이어마다 아래 검증값을 둔다.

| 레이어 | 핵심 검증 |
| --- | --- |
| 수집 | API 성공률, 쿼리 누락률, 중복률 |
| 정규화 | 메뉴 alias precision, 지역 매칭 precision |
| 분석 | 점수 안정성, 최근 7일 선행성 |
| 해석 | 설명 일관성, 액션 유효성 |
| 수익화 | CTA 클릭률, 컨설팅 전환율, 재구매율 |

## 3. 현재 원격 자산 기준 착지점

현재 `germany-dev` 기준으로 이미 재사용 가능한 자산이 있다.

- `~/franchise-lens/src/lib/naver.ts`
  - 네이버 Search API 호출 베이스가 이미 있음
- `~/franchise-lens/src/lib/reputation.ts`
  - 점수화 레이어 패턴이 이미 있음
- `~/franchise-lens/prisma/schema.prisma`
  - 현재는 `SQLite + Brand 중심 스키마`
- `~/aro/axsign/harness.py`
  - 멀티 에이전트 하네스 오케스트레이션이 이미 있음

따라서 권장 구조는 아래다.

- `franchise-lens`
  - kfoodradar 대시보드, 트렌드 스코어, 결제, SaaS UI
- `aro/axsign`
  - 점포 자산 분석 엔진, 자동 컨설팅 리포트, 실행 액션 생성

## 4. 시스템 전체 구조

### 4.1 End-to-End 플로우

`[수집] -> [정규화] -> [분석] -> [해석] -> [출력] -> [컨설팅/수익화]`

### 4.2 레이어 설계

#### A. 수집 레이어

입력 소스는 4개다.

1. Reddit
   - 메뉴 키워드별 게시글 수
   - 댓글 수
   - 업보트
   - 최근 7일/28일 변화율
   - 목적: "왜 뜨는가"
2. YouTube
   - 영상 수
   - 조회수 증가
   - 업로드 빈도
   - 채널 다양도
   - 목적: "얼마나 퍼지는가"
3. 네이버 블로그
   - 검색 결과 총량
   - 최근 글 증가율
   - 지역 언급 밀도
   - 방문 의도 문구 비율
   - 목적: "실제 방문 전환 신호"
4. AI 채널 / foodbus AI DB
   - AI 응답 내 메뉴 언급량
   - 모델별 노출 분포
   - evidence line
   - 연관 식당/연관 토픽
   - 목적: "AI 추천 세계에서 얼마나 보이는가"

#### B. 정규화 레이어

반드시 `표준 메뉴 사전`과 `지역 사전`을 둔다.

예시:

```json
{
  "콩국수": [
    "콩국수",
    "kongguksu",
    "soybean noodles",
    "cold soy milk noodles"
  ]
}
```

정규화 후에는 모든 수집값이 표준 `menu_id`와 연결되어야 한다.

#### C. 분석 레이어

메뉴별 핵심 4개 지표를 산출한다.

1. `Growth`
   - 최근 7일 vs 직전 28일 증가율
2. `Spread`
   - YouTube 조회수 증가, 업로드 수, 채널 다양도 기반
3. `Debate`
   - Reddit 댓글/업보트 구조 기반
4. `Conversion`
   - 네이버 블로그 최신 글 증가 + 방문 의도 + 지역 밀집도 기반

#### D. 해석 레이어

`규칙 엔진 -> LLM 문장화 -> 액션 생성` 순서로 처리한다.

예시 규칙:

- Reddit 논쟁도는 높은데 네이버 전환도가 낮다
  - 해석: "관심은 생겼지만 실제 방문 전환은 아직 초기 단계"
- YouTube 확산력과 네이버 전환도가 동시에 높다
  - 해석: "대중 확산이 실제 방문 행동으로 이어지는 중"
- 특정 지역 언급이 급증한다
  - 해석: "전국 트렌드가 아니라 지역 편중 수요 가능성"

#### E. 출력 레이어

사이트 출력은 3단 구조가 가장 적합하다.

1. 메인
   - 오늘의 트렌드 TOP 10
   - 신규 급등 메뉴
   - 지역별 HOT 메뉴
2. 메뉴 상세
   - 3채널 시계열 그래프
   - 자동 해석
   - 추천 키워드/간판 문구/콘텐츠 아이디어
3. 점포 컨설팅
   - 내 가게 업종/지역 업로드
   - 간판/메뉴/콘텐츠 자동 분석
   - 액션 카드 생성

## 5. Q1. 네이버 블로그 데이터를 합법적으로 수집하고 지표화하는 설계

### 5.1 결론

네이버 블로그는 `직접 크롤링`이 아니라 `공식 Search API + Datalab + RSS/고객 제공 데이터(옵트인)` 구조로 가야 한다.

특히 아래 3가지는 하지 않는 것을 기본 원칙으로 둔다.

1. 네이버 검색결과 HTML 직접 크롤링
2. robots.txt 우회 수집
3. 본문 전문의 대규모 저장/재배포

### 5.2 공식 문서 기준 설계 포인트

2026-04-03 기준 공식 문서상 확인되는 핵심은 아래와 같다.

1. 블로그 검색 API는 `title`, `link`, `description`, `bloggername`, `bloggerlink`, `postdate`, `total`을 제공한다.
2. 블로그 검색 API 하루 호출 한도는 25,000회다.
3. 데이터랩 검색어 트렌드는 주제어 묶음별 검색 추이를 제공하며 하루 호출 한도는 1,000회다.
4. 네이버 검색결과 수집 정책은 robots.txt를 무시한 네이버 DB 수집을 금지한다.
5. 검색 API 결과는 독립적으로 노출해야 하고 임의 수정/왜곡이 금지된다.
6. API 결과와 함께 광고를 노출하는 행위, 다중 클라이언트 아이디로 허용량을 우회하는 행위, API를 다시 제3자에게 제공하는 행위는 약관상 금지된다.

### 5.3 안전한 수집 구조

#### 권장 수집 경로

1. `Naver Search API / blog`
   - 쿼리별 총량
   - 최신순 결과
   - 최소 메타데이터 수집
2. `Naver Datalab Search Trend API`
   - 해당 메뉴 검색 관심도의 상대적 추이
   - 블로그 결과 총량이 검색 수요 때문인지 구분
3. `RSS 허용 블로그`
   - 저작자가 외부 배포를 허용한 경우만
   - 고객 또는 파트너가 연결한 피드만 사용
4. `고객 제공 데이터`
   - 네이버 플레이스 저장/길찾기/예약 데이터
   - POS 매출
   - 쿠폰/예약 전환

#### 비권장 또는 금지

1. 네이버 블로그 본문 대량 스크래핑
2. 네이버 검색결과 페이지 DOM 크롤링
3. 네이버 지역정보를 별도 DB처럼 재구성하는 저장 방식
4. 원본 API 결과를 유료로 재판매하는 모델

### 5.4 저장 전략

법적/운영상 안전성을 위해 저장을 2단으로 나눈다.

#### Raw Buffer

- 저장 대상
  - `query`
  - `link`
  - `postdate`
  - `title snippet`
  - `description snippet`
  - `bloggername`
- 목적
  - 중복 제거
  - 지역/방문 의도 파싱
  - 품질 검수
- 정책
  - 짧은 TTL 유지
  - 재가공 후 파생 지표만 장기 보관

#### Analytics Store

- 장기 저장 대상
  - `menu_id`
  - `snapshot_date`
  - `blog_total`
  - `new_posts_7d`
  - `new_posts_28d`
  - `unique_bloggers_7d`
  - `region_signal_score`
  - `visit_intent_score`
  - `conversion_score`

핵심은 `원문 DB`를 만드는 것이 아니라 `파생 신호 DB`를 만드는 것이다.

### 5.5 네이버 블로그 지표화 방식

#### 1. 총량 지표

- `blog_total`
  - API 응답의 `total`

#### 2. 최신 증가율

- `new_posts_7d`
  - 최근 7일 결과 수
- `new_posts_28d`
  - 직전 28일 결과 수
- `freshness_lift`
  - `(new_posts_7d / 7) / max(new_posts_28d / 28, 1)`

#### 3. 지역 언급 신호

본문 전체가 아니라 `title + description snippet`에서만 추출한다.

- 시/도, 구/군, 상권명 사전을 별도 운영
- 지역명 등장 횟수와 메뉴명 동시 등장 여부를 점수화
- 지역 자체를 네이버 소유 데이터베이스처럼 축적하지 않고
  `우리 시스템의 region taxonomy`에 매핑된 집계값만 저장

#### 4. 방문 의도 신호

Snippet에서 아래 패턴을 룰 기반으로 잡는다.

- "다녀왔"
- "방문"
- "웨이팅"
- "줄 서서"
- "재방문"
- "내돈내산"
- "추천"
- "가볼만"

이 값을 `visit_intent_score`로 저장한다.

#### 5. 전환도 공식

초기 MVP에서는 아래처럼 단순하게 간다.

```text
Conversion =
0.45 * freshness_lift +
0.30 * region_signal_score +
0.25 * visit_intent_score
```

### 5.6 합법성 관점의 서비스 구조 권장안

유료화는 `원본 네이버 결과 접근권`이 아니라 아래 가치에 대해 받아야 한다.

1. 3채널 통합 분석
2. 파생 지표 점수화
3. 점포 맞춤 컨설팅
4. AXSPACE 자산 분석 연동

이는 약관을 보수적으로 해석했을 때 더 안전한 포지션이다.
다만 네이버 API 약관과 실제 서비스 화면은 출시 전 법률 검토를 반드시 거치는 것을 권장한다.

## 6. Q2. 트렌드 스코어를 매출 예측 모델로 확장할 때 추가할 변수

### 6.1 중요한 관점

트렌드 스코어는 `메뉴 수요 시그널`이지 `매출` 그 자체는 아니다.
매출 예측으로 확장하려면 최소한 아래 4개 층이 더 필요하다.

1. 수요 강도
2. 지역 적합도
3. 점포 전환력
4. 운영 수용력

### 6.2 추가 변수 프레임

#### A. 수요 강도 변수

- Reddit 성장률
- Reddit 댓글 밀도
- Reddit 업보트 대비 댓글 비율
- YouTube 조회수 증가율
- YouTube 업로드 수
- YouTube 채널 다양도
- Naver Datalab 검색 추이
- 네이버 블로그 최신 증가율
- 네이버 블로그 방문 의도 비율

#### B. 지역 적합도 변수

- 지역별 블로그 언급 비중
- 상권 유형
  - 오피스
  - 주거
  - 관광
  - 대학가
- 날씨
  - 기온
  - 강수
  - 폭염/한파
- 계절성
- 요일/공휴일
- 유동인구
- 경쟁 메뉴 밀도

#### C. 점포 전환력 변수

- 간판 키워드 일치도
- 메뉴명 이해도
- 메뉴판 가독성
- 대표 메뉴 노출 여부
- 외국인 친화성
  - 영문 표기
  - 사진
  - 설명
- Naver Place 저장/길찾기/전화 클릭
- 리뷰 수와 최근성
- 가격대 경쟁력
- 배달 여부
- 예약 가능 여부

#### D. 운영 수용력 변수

- 좌석 수
- 피크 타임 회전율
- 평균 조리 시간
- 재료 수급 안정성
- 인력 여력
- 원가율
- 객단가
- 마진율

### 6.3 모델링 구조

권장 모델은 3단계다.

#### 1단계. Demand Nowcast

메뉴가 지금 얼마나 강한지 예측한다.

목표값 예시:

- `store_visits_proxy`
- `naver_place_action_count`
- `reservation_count`

#### 2단계. Sales Forecast

점포별 1주/2주/4주 매출을 예측한다.

목표값:

- `daily_sales`
- `weekly_sales`
- `menu_mix_share`
- `average_ticket`

#### 3단계. Uplift Model

"간판/메뉴 개선을 하면 얼마가 더 오를까"를 추정한다.

목표값:

- 개선 전후 매출 변화
- 저장/길찾기/예약 변화
- 리뷰 증가

### 6.4 실전용 추가 파생 변수

꼭 넣어야 하는 파생 변수는 아래다.

1. `trend_to_visit_lag`
   - Reddit/YouTube 상승 후 Naver 전환까지 걸리는 일수
2. `local_fit_score`
   - 전국 수요 대비 특정 지역 적합도
3. `merchant_readiness_score`
   - 점포가 그 트렌드를 받을 준비가 되어 있는가
4. `menu_clarity_score`
   - 소비자가 메뉴를 이해하기 쉬운가
5. `seasonal_match_score`
   - 계절과 메뉴가 맞는가
6. `price_acceptance_score`
   - 지역 가격대와 맞는가
7. `operational_capacity_score`
   - 몰릴 때 실제로 받아낼 수 있는가

### 6.5 추천 모델 순서

초기에는 복잡한 딥러닝보다 아래 순서가 낫다.

1. `LightGBM/XGBoost`
   - 베이스라인 예측
2. `Mixed Effects / Hierarchical Model`
   - 지역/업종/브랜드 편차 반영
3. `Uplift / Causal Layer`
   - 액션 효과 추정

### 6.6 데이터가 없을 때의 시작점

매출 데이터가 아직 없으면 아래 프록시로 시작한다.

1. Naver Place 저장 수
2. 길찾기 클릭 수
3. 전화 클릭 수
4. 예약 수
5. 쿠폰 저장 수
6. 블로그의 방문 의도 문구 비율

즉, `전환 프록시 -> 실제 매출` 순서로 진화시키는 게 맞다.

## 7. Q3. AXSPACE 간판/메뉴 분석 엔진과 연결한 자동 컨설팅 SaaS 구조

### 7.1 제품 구조

이 결합의 핵심은 아래 문장 하나로 정리된다.

`kfoodradar가 기회를 찾고, AXSPACE가 점포 실행안을 만든다.`

### 7.2 역할 분리

#### kfoodradar 역할

- 메뉴 트렌드 감지
- 지역별 수요 포착
- 점포 기회 점수 산출
- 어떤 메뉴를 밀어야 하는지 결정

#### AXSPACE 역할

- 간판 OCR
- 메뉴판/간판/브랜딩 분석
- 키워드 노출성 평가
- 시각 자산 품질 평가
- 실제 실행 카피와 수정안 생성

### 7.3 SaaS 오케스트레이션

#### Step 1. Opportunity Detection

kfoodradar가 아래를 만든다.

- `menu_id`
- `region_id`
- `opportunity_score`
- `reason_codes`

예시:

- "성수동에서 냉면 수요 급등"
- "외국인 유입 기반 콩국수 관심 증가"

#### Step 2. Merchant Matching

상권/업종/메뉴 구성이 맞는 점포를 찾는다.

입력:

- 점포 업종
- 위치
- 현재 메뉴
- 가격대
- 운영 시간

출력:

- `merchant_fit_score`

#### Step 3. AXSPACE Asset Ingestion

점포가 아래 자산을 업로드한다.

- 간판 사진
- 메뉴판 이미지/PDF
- 매장 외관 사진
- 네이버 플레이스 링크
- 인스타/유튜브/블로그 링크

#### Step 4. AXSIGN Harness Analysis

기존 `~/aro/axsign/harness.py`의 멀티 에이전트 구조를 확장한다.

기존 레이어:

- OCR
- Search
- Quality
- Review
- AI Exposure

추가 레이어:

- `Menu Fit Agent`
  - 현재 메뉴가 트렌드 메뉴를 받을 수 있는지
- `Trend Fit Agent`
  - 현재 간판/메뉴 문구가 트렌드 키워드와 맞는지
- `Conversion Agent`
  - 플레이스/리뷰/콘텐츠 자산이 전환을 받을 구조인지

#### Step 5. Consulting Action Generator

최종 출력은 "진단"이 아니라 "실행 카드"로 준다.

예시:

1. 간판 문구 교체안
2. 메뉴판 상단 재배치안
3. 네이버 블로그 체험단 키워드
4. 유튜브 쇼츠 제목 후보
5. 외국인 대상 영문 메뉴명 개선안
6. 한정 메뉴 런칭 권장안

#### Step 6. Report + CTA

리포트는 아래 3개 상품으로 분리 가능하다.

1. 무료
   - 메뉴 트렌드 일부
   - 내 업종 기준 기회 메뉴 1개
2. 프로
   - 내 지역/업종 맞춤 메뉴 추천
   - 간판/메뉴 개선 포인트
3. 컨설팅
   - AXSPACE 자동 리포트
   - 실행 카피
   - 디자인 시안
   - 월간 추적

### 7.4 추천 SaaS 데이터 모델

현재 `franchise-lens`는 `Brand` 중심이므로 메뉴 트렌드 도메인을 병렬로 추가하는 것이 맞다.

#### 신규 핵심 테이블

1. `Menu`
   - 표준 메뉴 엔티티
2. `MenuAlias`
   - 메뉴 동의어/외국어 표기
3. `TrendSnapshot`
   - Reddit/YouTube/Naver 원천 집계
4. `TrendScore`
   - Growth/Spread/Debate/Conversion/Grade
5. `TrendInterpretation`
   - 자동 해석 문장과 근거
6. `Merchant`
   - 점포/클라이언트
7. `MerchantAsset`
   - 간판, 메뉴판, 플레이스 링크
8. `MerchantTrendFit`
   - 메뉴/지역/점포 적합도
9. `ConsultingRun`
   - 분석 실행 단위
10. `ConsultingAction`
   - 추천 액션 카드

#### 중요한 설계 원칙

`Brand`와 `Menu`를 같은 테이블로 섞지 않는다.

- `Brand`
  - 프랜차이즈/브랜드 도메인
- `Menu`
  - 메뉴 트렌드 도메인

두 영역은 `Merchant` 또는 `BrandMenu` 성격의 조인 레이어에서 연결하는 편이 장기적으로 훨씬 안전하다.

### 7.5 추천 API 경계

#### franchise-lens API

- `GET /api/trends/top`
- `GET /api/trends/:menuSlug`
- `GET /api/trends/:menuSlug/regions`
- `POST /api/merchants`
- `POST /api/consulting/runs`
- `GET /api/consulting/runs/:id`

#### aro/axsign API

- `POST /axsign/analyze/signboard`
- `POST /axsign/analyze/menu`
- `POST /axsign/analyze/full-consulting`

### 7.6 최종 점수 체계

SaaS 최종 추천에는 단일 트렌드 점수보다 아래 4개 축이 더 중요하다.

```text
Opportunity Score =
0.35 * Trend Score +
0.25 * Local Fit +
0.25 * Merchant Readiness +
0.15 * Operational Capacity
```

이 점수가 높을수록 "지금 이 가게가 실제로 실행해서 돈 벌 가능성"이 높다.

## 8. 현재 코드베이스 기준 권장 구현 순서

### Phase 0. 구조 정리

1. `franchise-lens`를 kfoodradar 대시보드의 베이스로 사용
2. `SQLite`는 로컬 프로토타입 용도로만 유지
3. 서버용 데이터 저장소는 `PostgreSQL`로 이전 계획 수립

### Phase 1. 신호 수집 MVP

1. Reddit + YouTube 먼저 연결
2. `Menu`, `MenuAlias`, `TrendSnapshot`, `TrendScore` 추가
3. 단순 TOP 10 대시보드 구현

### Phase 2. 네이버 블로그 합류

1. `src/lib/naver.ts`를 메뉴 쿼리형 수집기로 확장
2. 블로그 `total` 중심 지표 연결
3. 최신순 수집과 방문 의도 룰 추가

### Phase 3. 해석 엔진

1. 규칙 기반 해석 코드 작성
2. LLM은 문장화와 액션 요약에 한정
3. 근거 지표를 함께 저장

### Phase 4. AXSPACE 연동

1. `Merchant`와 `MerchantAsset` 도메인 추가
2. `aro/axsign` 호출용 커넥터 추가
3. 자동 컨설팅 리포트 생성

### Phase 5. 매출 예측

1. 전환 프록시 수집
2. POS/예약/플레이스 데이터 연결
3. 수요 예측 -> 매출 예측 -> 액션 uplift 추정 순으로 확장

## 9. 제품 KPI

초기 KPI는 아래가 가장 중요하다.

1. `trend_precision`
   - 실제 체감 트렌드와 일치하는 메뉴 비율
2. `interpretation_acceptance`
   - 사용자가 해석을 유용하다고 보는 비율
3. `consulting_cta_rate`
4. `merchant_report_purchase_rate`
5. `repeat_usage_30d`

AXSPACE 연동 후 핵심 KPI는 아래로 바뀐다.

1. 실행 액션 채택률
2. 플레이스 저장/길찾기 상승률
3. 메뉴 매출 상승률
4. 컨설팅 재구매율

## 10. 최종 추천

이번 프로젝트의 정답 구조는 아래다.

1. `franchise-lens`를 kfoodradar SaaS 전면으로 사용한다.
2. `aro/axsign`를 자동 컨설팅 엔진으로 붙인다.
3. 네이버는 공식 API와 옵트인 데이터 중심으로만 가져간다.
4. 메뉴 중심 도메인을 브랜드 도메인과 분리해 설계한다.
5. 첫 MVP는 반드시 `Reddit + YouTube -> 점수화 -> 대시보드` 순서를 지킨다.

## 11. 공식 참고 링크

아래는 2026-04-03에 확인한 공식 문서다.

- Naver Blog Search API:
  - https://developers.naver.com/docs/serviceapi/search/blog/blog.md
- Naver Datalab Search Trend API:
  - https://developers.naver.com/docs/serviceapi/datalab/search/search.md
- NAVER API 서비스 이용약관:
  - https://developers.naver.com/products/terms
- 네이버 검색결과 수집에 대한 정책:
  - https://policy.naver.com/policy/search_policy.html

## 12. 다음 구현 권장 작업

바로 이어서 구현한다면 순서는 아래가 가장 안전하다.

1. `franchise-lens`에 `docs/` 생성 후 이 문서를 저장
2. Prisma에 `Menu`, `MenuAlias`, `TrendSnapshot`, `TrendScore` 초안 추가
3. `src/lib/naver.ts`를 브랜드 카운트 함수에서 메뉴 트렌드 수집 모듈로 분리
4. Reddit/YouTube 수집기와 합쳐 일일 배치 하네스 작성
5. TOP 10 대시보드와 메뉴 상세 페이지 생성
