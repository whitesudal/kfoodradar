// src/lib/menu-trends.ts
// Reddit + YouTube + Naver Blog 신호를 단일 트렌드 점수로 합산한다.

export type TrendGrade = "A" | "B" | "C" | "D";

export interface MenuTrendInput {
  menuName: string;
  menuSlug: string;
  redditMentions: number;
  redditComments: number;
  redditUpvotes: number;
  youtubeVideos: number;
  youtubeViews: number;
  youtubeUploadVelocity: number;
  naverPosts: number;
  naverRecentPosts: number;
  regionSignalScore: number;
  visitIntentScore: number;
  previousWindowMentions?: number;
  previousWindowViews?: number;
  previousWindowPosts?: number;
}

export interface TrendBreakdown {
  growthScore: number;
  spreadScore: number;
  debateScore: number;
  conversionScore: number;
  totalTrendScore: number;
  grade: TrendGrade;
  gradeLabel: string;
}

export interface TrendCard extends TrendBreakdown {
  menuName: string;
  menuSlug: string;
  redditMentions: number;
  youtubeVideos: number;
  naverPosts: number;
  reason: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaleTo100(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0;
  return clamp((value / maxValue) * 100);
}

function scaledLift(current: number, previous: number, floor = -0.2, ceiling = 1.2): number {
  if (previous <= 0) return current > 0 ? 100 : 0;

  const lift = (current - previous) / previous;
  const normalized = ((lift - floor) / (ceiling - floor)) * 100;
  return clamp(normalized);
}

export function calculateTrendBreakdown(input: MenuTrendInput): TrendBreakdown {
  const growthSignals = [
    scaledLift(input.redditMentions, input.previousWindowMentions ?? input.redditMentions),
    scaledLift(input.youtubeViews, input.previousWindowViews ?? input.youtubeViews),
    scaledLift(input.naverPosts, input.previousWindowPosts ?? input.naverPosts),
  ];

  const growthScore = growthSignals.reduce((sum, value) => sum + value, 0) / growthSignals.length;

  const spreadScore =
    scaleTo100(input.youtubeVideos, 80) * 0.35 +
    scaleTo100(input.youtubeViews, 500_000) * 0.45 +
    scaleTo100(input.youtubeUploadVelocity, 20) * 0.20;

  const debateScore =
    scaleTo100(input.redditMentions, 250) * 0.25 +
    scaleTo100(input.redditComments / Math.max(input.redditMentions, 1), 3) * 0.40 +
    scaleTo100(input.redditUpvotes / Math.max(input.redditMentions, 1), 10) * 0.35;

  const conversionScore =
    scaleTo100(input.naverPosts, 600) * 0.30 +
    scaleTo100(input.naverRecentPosts, 80) * 0.35 +
    clamp(input.regionSignalScore) * 0.15 +
    clamp(input.visitIntentScore) * 0.20;

  const totalTrendScore =
    growthScore * 0.30 +
    spreadScore * 0.25 +
    debateScore * 0.20 +
    conversionScore * 0.25;

  const roundedTotal = round1(totalTrendScore);

  if (roundedTotal >= 75) {
    return {
      growthScore: round1(growthScore),
      spreadScore: round1(spreadScore),
      debateScore: round1(debateScore),
      conversionScore: round1(conversionScore),
      totalTrendScore: roundedTotal,
      grade: "A",
      gradeLabel: "폭발 트렌드",
    };
  }

  if (roundedTotal >= 60) {
    return {
      growthScore: round1(growthScore),
      spreadScore: round1(spreadScore),
      debateScore: round1(debateScore),
      conversionScore: round1(conversionScore),
      totalTrendScore: roundedTotal,
      grade: "B",
      gradeLabel: "상승",
    };
  }

  if (roundedTotal >= 40) {
    return {
      growthScore: round1(growthScore),
      spreadScore: round1(spreadScore),
      debateScore: round1(debateScore),
      conversionScore: round1(conversionScore),
      totalTrendScore: roundedTotal,
      grade: "C",
      gradeLabel: "유지",
    };
  }

  return {
    growthScore: round1(growthScore),
    spreadScore: round1(spreadScore),
    debateScore: round1(debateScore),
    conversionScore: round1(conversionScore),
    totalTrendScore: roundedTotal,
    grade: "D",
    gradeLabel: "하락",
  };
}

export function buildTrendCard(input: MenuTrendInput): TrendCard {
  const breakdown = calculateTrendBreakdown(input);
  const reasons: string[] = [];

  if (breakdown.growthScore >= 70) reasons.push("상승률 강함");
  if (breakdown.spreadScore >= 70) reasons.push("유튜브 확산 빠름");
  if (breakdown.debateScore >= 65) reasons.push("레딧 논쟁도 높음");
  if (breakdown.conversionScore >= 65) reasons.push("네이버 방문 전환 신호 확인");

  return {
    ...breakdown,
    menuName: input.menuName,
    menuSlug: input.menuSlug,
    redditMentions: input.redditMentions,
    youtubeVideos: input.youtubeVideos,
    naverPosts: input.naverPosts,
    reason: reasons.join(" · ") || "기본 신호 축적 단계",
  };
}

export function getFallbackTrendCards(): TrendCard[] {
  const samples: MenuTrendInput[] = [
    {
      menuName: "콩국수",
      menuSlug: "kongguksu",
      redditMentions: 120,
      redditComments: 180,
      redditUpvotes: 540,
      youtubeVideos: 45,
      youtubeViews: 220_000,
      youtubeUploadVelocity: 12,
      naverPosts: 300,
      naverRecentPosts: 46,
      regionSignalScore: 72,
      visitIntentScore: 78,
      previousWindowMentions: 72,
      previousWindowViews: 128_000,
      previousWindowPosts: 210,
    },
    {
      menuName: "냉면",
      menuSlug: "naengmyeon",
      redditMentions: 98,
      redditComments: 121,
      redditUpvotes: 340,
      youtubeVideos: 38,
      youtubeViews: 180_000,
      youtubeUploadVelocity: 10,
      naverPosts: 260,
      naverRecentPosts: 35,
      regionSignalScore: 66,
      visitIntentScore: 71,
      previousWindowMentions: 80,
      previousWindowViews: 150_000,
      previousWindowPosts: 238,
    },
    {
      menuName: "쭈꾸미",
      menuSlug: "jjukkumi",
      redditMentions: 72,
      redditComments: 155,
      redditUpvotes: 410,
      youtubeVideos: 52,
      youtubeViews: 260_000,
      youtubeUploadVelocity: 14,
      naverPosts: 180,
      naverRecentPosts: 26,
      regionSignalScore: 61,
      visitIntentScore: 63,
      previousWindowMentions: 46,
      previousWindowViews: 154_000,
      previousWindowPosts: 132,
    },
  ];

  return samples
    .map(buildTrendCard)
    .sort((left, right) => right.totalTrendScore - left.totalTrendScore);
}

