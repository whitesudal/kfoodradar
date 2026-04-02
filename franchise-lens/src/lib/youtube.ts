// src/lib/youtube.ts
// YouTube Data API v3 client for menu trend signals.

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";

export interface YouTubeVideoSummary {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  commentCount: number;
  likeCount: number;
}

export interface YouTubeMenuSignalSnapshot {
  query: string;
  videoCount: number;
  recentVideos7d: number;
  estimatedPreviousVideos7d: number;
  totalViews: number;
  recentViews7d: number;
  estimatedPreviousViews7d: number;
  totalComments: number;
  uniqueChannelCount: number;
  items: YouTubeVideoSummary[];
  warning?: string;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
    statistics?: {
      viewCount?: string;
      commentCount?: string;
      likeCount?: string;
    };
  }>;
}

export function isYouTubeConfigured(): boolean {
  return !!YOUTUBE_API_KEY;
}

async function requestYouTube<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T | null> {
  if (!isYouTubeConfigured()) return null;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  searchParams.set("key", YOUTUBE_API_KEY);

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/${path}?${searchParams.toString()}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function searchYouTubeMenuSignal(
  query: string,
  options?: {
    maxResults?: number;
    regionCode?: string;
    relevanceLanguage?: string;
    now?: Date;
  }
): Promise<YouTubeMenuSignalSnapshot> {
  if (!isYouTubeConfigured()) {
    return {
      query,
      videoCount: 0,
      recentVideos7d: 0,
      estimatedPreviousVideos7d: 0,
      totalViews: 0,
      recentViews7d: 0,
      estimatedPreviousViews7d: 0,
      totalComments: 0,
      uniqueChannelCount: 0,
      items: [],
      warning: "youtube_api_not_configured",
    };
  }

  const maxResults = Math.max(5, Math.min(options?.maxResults ?? 20, 50));
  const now = options?.now ?? new Date();

  const searchData = await requestYouTube<YouTubeSearchResponse>("search", {
    part: "snippet",
    type: "video",
    q: query,
    maxResults,
    order: "relevance",
    regionCode: options?.regionCode ?? "KR",
    relevanceLanguage: options?.relevanceLanguage ?? "ko",
  });

  const ids = searchData?.items
    ?.map((item) => item.id?.videoId)
    .filter((value): value is string => !!value) ?? [];

  if (ids.length === 0) {
    return {
      query,
      videoCount: 0,
      recentVideos7d: 0,
      estimatedPreviousVideos7d: 0,
      totalViews: 0,
      recentViews7d: 0,
      estimatedPreviousViews7d: 0,
      totalComments: 0,
      uniqueChannelCount: 0,
      items: [],
      warning: "youtube_search_empty",
    };
  }

  const videosData = await requestYouTube<YouTubeVideosResponse>("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
    maxResults: ids.length,
  });

  const items =
    videosData?.items?.map((item) => ({
      videoId: item.id ?? "",
      title: item.snippet?.title ?? "",
      channelId: item.snippet?.channelId ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      viewCount: Number(item.statistics?.viewCount ?? 0),
      commentCount: Number(item.statistics?.commentCount ?? 0),
      likeCount: Number(item.statistics?.likeCount ?? 0),
    })) ?? [];

  const recentItems = items.filter((item) => {
    if (!item.publishedAt) return false;
    const publishedMs = new Date(item.publishedAt).getTime();
    if (Number.isNaN(publishedMs)) return false;
    const diffDays = (now.getTime() - publishedMs) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  });

  const olderItems = items.filter((item) => {
    if (!item.publishedAt) return false;
    const publishedMs = new Date(item.publishedAt).getTime();
    if (Number.isNaN(publishedMs)) return false;
    const diffDays = (now.getTime() - publishedMs) / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  });

  const olderDiffDays = olderItems
    .map((item) => {
      const publishedMs = new Date(item.publishedAt).getTime();
      return (now.getTime() - publishedMs) / (1000 * 60 * 60 * 24);
    })
    .filter((value) => Number.isFinite(value));

  const observationDays = olderDiffDays.length > 0 ? Math.max(...olderDiffDays) - 7 : 0;

  return {
    query,
    videoCount: items.length,
    recentVideos7d: recentItems.length,
    estimatedPreviousVideos7d:
      observationDays > 0 ? Math.max(1, Math.round((olderItems.length / observationDays) * 7)) : 0,
    totalViews: items.reduce((sum, item) => sum + item.viewCount, 0),
    recentViews7d: recentItems.reduce((sum, item) => sum + item.viewCount, 0),
    estimatedPreviousViews7d:
      observationDays > 0
        ? Math.max(
            1,
            Math.round(
              (olderItems.reduce((sum, item) => sum + item.viewCount, 0) / observationDays) * 7
            )
          )
        : 0,
    totalComments: items.reduce((sum, item) => sum + item.commentCount, 0),
    uniqueChannelCount: new Set(items.map((item) => item.channelId).filter(Boolean)).size,
    items,
  };
}

