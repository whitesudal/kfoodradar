// src/lib/reddit.ts
// Reddit app-only OAuth client for menu signal collection.

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID ?? "";
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET ?? "";
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT ?? "kfoodradar/0.1 (by /u/kfoodradar_bot)";

type RedditTokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let redditTokenCache: RedditTokenCache | null = null;

export interface RedditPostSummary {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
  url: string;
}

export interface RedditMenuSignalSnapshot {
  query: string;
  mentionCount: number;
  recentPosts7d: number;
  estimatedPreviousPosts7d: number;
  commentCount: number;
  upvoteCount: number;
  subreddits: string[];
  items: RedditPostSummary[];
  warning?: string;
}

interface RedditListingChild {
  data: {
    id: string;
    title: string;
    subreddit: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    permalink?: string;
    url?: string;
  };
}

interface RedditListingResponse {
  data?: {
    children?: RedditListingChild[];
  };
}

export function isRedditConfigured(): boolean {
  return !!(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET && REDDIT_USER_AGENT);
}

async function getRedditAccessToken(): Promise<string | null> {
  if (!isRedditConfigured()) return null;

  const now = Date.now();
  if (redditTokenCache && redditTokenCache.expiresAtMs > now + 30_000) {
    return redditTokenCache.accessToken;
  }

  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
  });

  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": REDDIT_USER_AGENT,
      },
      body,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) return null;

    redditTokenCache = {
      accessToken: data.access_token,
      expiresAtMs: now + (data.expires_in ?? 3600) * 1000,
    };

    return data.access_token;
  } catch {
    return null;
  }
}

export async function searchRedditMenuSignal(
  query: string,
  options?: {
    limit?: number;
    sort?: "relevance" | "new" | "top" | "comments";
    timeRange?: "day" | "week" | "month" | "year" | "all";
    now?: Date;
  }
): Promise<RedditMenuSignalSnapshot> {
  if (!isRedditConfigured()) {
    return {
      query,
      mentionCount: 0,
      recentPosts7d: 0,
      estimatedPreviousPosts7d: 0,
      commentCount: 0,
      upvoteCount: 0,
      subreddits: [],
      items: [],
      warning: "reddit_api_not_configured",
    };
  }

  const token = await getRedditAccessToken();
  if (!token) {
    return {
      query,
      mentionCount: 0,
      recentPosts7d: 0,
      estimatedPreviousPosts7d: 0,
      commentCount: 0,
      upvoteCount: 0,
      subreddits: [],
      items: [],
      warning: "reddit_access_token_failed",
    };
  }

  const limit = Math.max(5, Math.min(options?.limit ?? 25, 50));
  const sort = options?.sort ?? "relevance";
  const timeRange = options?.timeRange ?? "month";
  const now = options?.now ?? new Date();

  const url =
    "https://oauth.reddit.com/search" +
    `?q=${encodeURIComponent(query)}` +
    `&limit=${limit}` +
    `&sort=${sort}` +
    `&t=${timeRange}` +
    "&type=link";

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": REDDIT_USER_AGENT,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        query,
        mentionCount: 0,
        recentPosts7d: 0,
        estimatedPreviousPosts7d: 0,
        commentCount: 0,
        upvoteCount: 0,
        subreddits: [],
        items: [],
        warning: `reddit_search_failed_${res.status}`,
      };
    }

    const data = (await res.json()) as RedditListingResponse;
    const items =
      data.data?.children?.map((child) => ({
        id: child.data.id,
        title: child.data.title,
        subreddit: child.data.subreddit,
        score: child.data.score ?? 0,
        numComments: child.data.num_comments ?? 0,
        createdUtc: child.data.created_utc ?? 0,
        permalink: child.data.permalink
          ? `https://www.reddit.com${child.data.permalink}`
          : "",
        url: child.data.url ?? "",
      })) ?? [];

    const recentPosts7d = items.filter((item) => {
      const createdAtMs = item.createdUtc * 1000;
      if (!createdAtMs) return false;
      const diffDays = (now.getTime() - createdAtMs) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }).length;

    const olderDiffDays = items
      .map((item) => {
        const createdAtMs = item.createdUtc * 1000;
        if (!createdAtMs) return null;
        return (now.getTime() - createdAtMs) / (1000 * 60 * 60 * 24);
      })
      .filter((value): value is number => value !== null && value > 7);

    const observationDays = olderDiffDays.length > 0 ? Math.max(...olderDiffDays) - 7 : 0;
    const estimatedPreviousPosts7d =
      observationDays > 0
        ? Math.max(1, Math.round((olderDiffDays.length / observationDays) * 7))
        : 0;

    return {
      query,
      mentionCount: items.length,
      recentPosts7d,
      estimatedPreviousPosts7d,
      commentCount: items.reduce((sum, item) => sum + item.numComments, 0),
      upvoteCount: items.reduce((sum, item) => sum + item.score, 0),
      subreddits: [...new Set(items.map((item) => item.subreddit).filter(Boolean))],
      items,
    };
  } catch {
    return {
      query,
      mentionCount: 0,
      recentPosts7d: 0,
      estimatedPreviousPosts7d: 0,
      commentCount: 0,
      upvoteCount: 0,
      subreddits: [],
      items: [],
      warning: "reddit_request_failed",
    };
  }
}

