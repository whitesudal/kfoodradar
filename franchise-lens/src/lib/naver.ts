// src/lib/naver.ts
// 네이버 검색 API 클라이언트

const CLIENT_ID = process.env.NAVER_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? "";

const REGION_TOKEN_REGEX = /([가-힣0-9]+(?:시|도|군|구|동|읍|면|역))/g;
const VISIT_INTENT_KEYWORDS = [
  "다녀왔",
  "방문",
  "웨이팅",
  "줄 서서",
  "재방문",
  "내돈내산",
  "추천",
  "가볼만",
];

export interface NaverSearchItem {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  bloggerlink?: string;
  postdate?: string;
}

interface NaverSearchResponse {
  total?: number;
  start?: number;
  display?: number;
  items?: NaverSearchItem[];
}

export interface NaverBlogTrendSnapshot {
  query: string;
  total: number;
  recentPosts7d: number;
  estimatedPreviousPosts7d: number;
  regionSignalScore: number;
  visitIntentScore: number;
  items: NaverSearchItem[];
}

export function isNaverConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parsePostDate(value?: string): Date | null {
  if (!value || value.length !== 8) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const parsed = new Date(Date.UTC(year, month, day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function countRegionTokens(value: string): number {
  const matches = value.match(REGION_TOKEN_REGEX);
  return matches?.length ?? 0;
}

function countVisitIntentHits(value: string): number {
  return VISIT_INTENT_KEYWORDS.reduce((count, keyword) => {
    return value.includes(keyword) ? count + 1 : count;
  }, 0);
}

async function requestSearch(
  endpoint: "blog" | "news",
  query: string,
  options?: {
    display?: number;
    start?: number;
    sort?: "sim" | "date";
  }
): Promise<NaverSearchResponse> {
  if (!isNaverConfigured()) return {};

  const display = options?.display ?? 1;
  const start = options?.start ?? 1;
  const sort = options?.sort ?? "sim";

  const url =
    `https://openapi.naver.com/v1/search/${endpoint}.json` +
    `?query=${encodeURIComponent(query)}` +
    `&display=${display}` +
    `&start=${start}` +
    `&sort=${sort}`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": CLIENT_ID,
        "X-Naver-Client-Secret": CLIENT_SECRET,
      },
      cache: "no-store",
    });
    if (!res.ok) return {};
    return (await res.json()) as NaverSearchResponse;
  } catch {
    return {};
  }
}

async function searchTotal(endpoint: "blog" | "news", query: string): Promise<number> {
  const data = await requestSearch(endpoint, query, { display: 1, start: 1, sort: "sim" });
  return data.total ?? 0;
}

/** 네이버 블로그 언급 수 - "브랜드명 창업" 쿼리 */
export async function getNaverBlogCount(brandName: string): Promise<number> {
  return searchTotal("blog", `${brandName} 창업`);
}

/** 네이버 뉴스 언급 수 */
export async function getNaverNewsCount(brandName: string): Promise<number> {
  return searchTotal("news", brandName);
}

/**
 * 메뉴 중심 네이버 블로그 전환 스냅샷.
 * 검색 API가 제공하는 메타데이터와 snippet만 사용한다.
 */
export async function getNaverBlogTrendSnapshot(
  query: string,
  options?: {
    display?: number;
    now?: Date;
  }
): Promise<NaverBlogTrendSnapshot> {
  const now = options?.now ?? new Date();
  const data = await requestSearch("blog", query, {
    display: Math.min(options?.display ?? 50, 100),
    start: 1,
    sort: "date",
  });

  const items =
    data.items?.map((item) => ({
      ...item,
      title: stripTags(item.title),
      description: stripTags(item.description),
    })) ?? [];

  const recentPosts7d = items.filter((item) => {
    const postDate = parsePostDate(item.postdate);
    if (!postDate) return false;

    const diffDays = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const olderDiffDays = items
    .map((item) => {
      const postDate = parsePostDate(item.postdate);
      if (!postDate) return null;
      return (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24);
    })
    .filter((value): value is number => value !== null && value > 7);

  const observationDays = olderDiffDays.length > 0 ? Math.max(...olderDiffDays) - 7 : 0;
  const olderPostsCount = olderDiffDays.length;
  const estimatedPreviousPosts7d =
    observationDays > 0 ? Math.max(1, Math.round((olderPostsCount / observationDays) * 7)) : 0;

  const regionHits = items.reduce((count, item) => {
    return count + countRegionTokens(`${item.title} ${item.description}`);
  }, 0);

  const visitIntentHits = items.reduce((count, item) => {
    return count + countVisitIntentHits(`${item.title} ${item.description}`);
  }, 0);

  const itemCount = Math.max(items.length, 1);
  const regionSignalScore = Math.min(100, Math.round((regionHits / itemCount) * 35));
  const visitIntentScore = Math.min(100, Math.round((visitIntentHits / itemCount) * 25));

  return {
    query,
    total: data.total ?? 0,
    recentPosts7d,
    estimatedPreviousPosts7d,
    regionSignalScore,
    visitIntentScore,
    items,
  };
}
