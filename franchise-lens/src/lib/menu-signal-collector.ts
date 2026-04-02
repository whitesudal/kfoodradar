// src/lib/menu-signal-collector.ts
// Menu trend signal harness: Reddit + YouTube + Naver Blog.

import { fetchFoodbusAiTrend, type FoodbusAiTrendSignal } from "@/lib/foodbus-ai";
import { getNaverBlogTrendSnapshot } from "@/lib/naver";
import { normalizeMenuCandidate } from "@/lib/menu-dictionary";
import { buildTrendCard, type TrendCard } from "@/lib/menu-trends";
import { searchRedditMenuSignal } from "@/lib/reddit";
import { searchYouTubeMenuSignal } from "@/lib/youtube";

export interface DecisionSignal {
  publicTrendScore: number;
  aiTrendScore: number | null;
  finalDecisionScore: number;
  label: string;
  reason: string;
}

export interface MenuSignalCollection {
  menuName: string;
  menuSlug: string;
  canonicalQuery: string;
  channelQueries: {
    reddit: string;
    youtube: string;
    naver: string;
  };
  trend: TrendCard;
  aiTrend: FoodbusAiTrendSignal;
  decisionSignal: DecisionSignal;
  channels: {
    reddit: Awaited<ReturnType<typeof searchRedditMenuSignal>>;
    youtube: Awaited<ReturnType<typeof searchYouTubeMenuSignal>>;
    naver: Awaited<ReturnType<typeof getNaverBlogTrendSnapshot>>;
  };
  warnings: string[];
}

function slugifyMenuName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDecisionSignal(trend: TrendCard, aiTrend: FoodbusAiTrendSignal): DecisionSignal {
  if (!aiTrend.available || aiTrend.aiTrendScore === null) {
    return {
      publicTrendScore: trend.totalTrendScore,
      aiTrendScore: null,
      finalDecisionScore: trend.totalTrendScore,
      label: trend.gradeLabel,
      reason: "사람 시장 데이터 기준 판단",
    };
  }

  const finalDecisionScore = Math.round((trend.totalTrendScore * 0.8 + aiTrend.aiTrendScore * 0.2) * 10) / 10;

  if (finalDecisionScore >= 75) {
    return {
      publicTrendScore: trend.totalTrendScore,
      aiTrendScore: aiTrend.aiTrendScore,
      finalDecisionScore,
      label: "대중+AI 동시 강세",
      reason: "공개 채널 트렌드와 AI 추천 노출이 함께 강함",
    };
  }

  if (trend.totalTrendScore >= 60 && aiTrend.aiTrendScore < 35) {
    return {
      publicTrendScore: trend.totalTrendScore,
      aiTrendScore: aiTrend.aiTrendScore,
      finalDecisionScore,
      label: "선점 기회",
      reason: "대중 수요는 빠르지만 AI 추천 점유는 아직 낮음",
    };
  }

  if (trend.totalTrendScore < 45 && aiTrend.aiTrendScore >= 55) {
    return {
      publicTrendScore: trend.totalTrendScore,
      aiTrendScore: aiTrend.aiTrendScore,
      finalDecisionScore,
      label: "AI 우세 메뉴",
      reason: "대중 확산보다 AI 응답 내 노출 강도가 앞서 있음",
    };
  }

  return {
    publicTrendScore: trend.totalTrendScore,
    aiTrendScore: aiTrend.aiTrendScore,
    finalDecisionScore,
    label: "혼합 신호",
    reason: "대중 채널과 AI 채널 신호가 함께 존재함",
  };
}

export async function collectMenuSignals(
  menuCandidate: string,
  options?: {
    now?: Date;
    regionCode?: string;
    relevanceLanguage?: string;
  }
): Promise<MenuSignalCollection> {
  const now = options?.now ?? new Date();
  const normalizedMenu = normalizeMenuCandidate(menuCandidate);

  const menuName = normalizedMenu?.canonicalName ?? menuCandidate.trim();
  const menuSlug =
    normalizedMenu
      ? slugifyMenuName(normalizedMenu.englishName ?? normalizedMenu.canonicalName)
      : slugifyMenuName(menuCandidate);

  const redditQuery = normalizedMenu?.englishName ?? normalizedMenu?.canonicalName ?? menuCandidate;
  const youtubeQuery = normalizedMenu?.canonicalName ?? menuCandidate;
  const naverQuery = normalizedMenu?.canonicalName ?? menuCandidate;
  const aiDbQuery = normalizedMenu?.canonicalName ?? menuCandidate;

  const [reddit, youtube, naver, aiTrend] = await Promise.all([
    searchRedditMenuSignal(redditQuery, { now }),
    searchYouTubeMenuSignal(youtubeQuery, {
      now,
      regionCode: options?.regionCode ?? "KR",
      relevanceLanguage: options?.relevanceLanguage ?? "ko",
    }),
    getNaverBlogTrendSnapshot(naverQuery, { now }),
    fetchFoodbusAiTrend(aiDbQuery),
  ]);

  const previousWindowMentions =
    reddit.estimatedPreviousPosts7d > 0 ? reddit.estimatedPreviousPosts7d : reddit.mentionCount;
  const previousWindowViews =
    youtube.estimatedPreviousViews7d > 0 ? youtube.estimatedPreviousViews7d : youtube.totalViews;
  const previousWindowPosts =
    naver.estimatedPreviousPosts7d > 0 ? naver.estimatedPreviousPosts7d : naver.total;

  const trend = buildTrendCard({
    menuName,
    menuSlug,
    redditMentions: reddit.mentionCount,
    redditComments: reddit.commentCount,
    redditUpvotes: reddit.upvoteCount,
    youtubeVideos: youtube.videoCount,
    youtubeViews: youtube.totalViews,
    youtubeUploadVelocity: youtube.recentVideos7d,
    naverPosts: naver.total,
    naverRecentPosts: naver.recentPosts7d,
    regionSignalScore: naver.regionSignalScore,
    visitIntentScore: naver.visitIntentScore,
    previousWindowMentions,
    previousWindowViews,
    previousWindowPosts,
  });

  const warnings = [reddit.warning, youtube.warning].filter(
    (warning): warning is string => !!warning
  );
  if (aiTrend.warning) warnings.push(aiTrend.warning);

  const decisionSignal = buildDecisionSignal(trend, aiTrend);

  return {
    menuName,
    menuSlug,
    canonicalQuery: menuName,
    channelQueries: {
      reddit: redditQuery,
      youtube: youtubeQuery,
      naver: naverQuery,
    },
    trend,
    aiTrend,
    decisionSignal,
    channels: {
      reddit,
      youtube,
      naver,
    },
    warnings,
  };
}
