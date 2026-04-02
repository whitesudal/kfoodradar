// src/app/api/trends/top/route.ts
import { NextResponse } from "next/server";

import { getFallbackTrendCards, type TrendCard } from "@/lib/menu-trends";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TrendRow = {
  menuSlug: string;
  menuName: string;
  englishName: string | null;
  category: string | null;
  bucketDate: Date | string;
  growthScore: number | null;
  spreadScore: number | null;
  debateScore: number | null;
  conversionScore: number | null;
  totalTrendScore: number | null;
  grade: string | null;
  gradeLabel: string | null;
};

async function hasTrendTables(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name IN ('Menu', 'TrendScore')`
  );

  return rows.length === 2;
}

async function loadTopTrendCards(limit: number): Promise<TrendCard[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const rows = await prisma.$queryRawUnsafe<TrendRow[]>(
    `SELECT
        m.slug AS menuSlug,
        m.canonicalName AS menuName,
        m.englishName AS englishName,
        m.category AS category,
        t.bucketDate AS bucketDate,
        t.growthScore AS growthScore,
        t.spreadScore AS spreadScore,
        t.debateScore AS debateScore,
        t.conversionScore AS conversionScore,
        t.totalTrendScore AS totalTrendScore,
        t.grade AS grade,
        t.gradeLabel AS gradeLabel
      FROM "TrendScore" t
      INNER JOIN "Menu" m ON m.id = t.menuId
      WHERE t.bucketDate = (SELECT MAX(bucketDate) FROM "TrendScore")
      ORDER BY t.totalTrendScore DESC
      LIMIT ${safeLimit}`
  );

  return rows.map((row) => ({
    menuName: row.menuName,
    menuSlug: row.menuSlug,
    growthScore: row.growthScore ?? 0,
    spreadScore: row.spreadScore ?? 0,
    debateScore: row.debateScore ?? 0,
    conversionScore: row.conversionScore ?? 0,
    totalTrendScore: row.totalTrendScore ?? 0,
    grade: (row.grade as TrendCard["grade"]) ?? "C",
    gradeLabel: row.gradeLabel ?? "유지",
    redditMentions: 0,
    youtubeVideos: 0,
    naverPosts: 0,
    reason: [row.category, row.englishName].filter(Boolean).join(" · ") || "DB trend snapshot",
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "10");
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(requestedLimit, 50))
    : 10;

  try {
    const tableReady = await hasTrendTables();

    if (!tableReady) {
      return NextResponse.json({
        source: "fixture",
        migrationReady: false,
        items: getFallbackTrendCards().slice(0, safeLimit),
      });
    }

    const items = await loadTopTrendCards(safeLimit);

    if (items.length === 0) {
      return NextResponse.json({
        source: "fixture",
        migrationReady: true,
        items: getFallbackTrendCards().slice(0, safeLimit),
      });
    }

    return NextResponse.json({
      source: "db",
      migrationReady: true,
      items,
    });
  } catch (error) {
    return NextResponse.json({
      source: "fixture",
      migrationReady: false,
      warning: error instanceof Error ? error.message : "trend route fallback",
      items: getFallbackTrendCards().slice(0, safeLimit),
    });
  }
}
