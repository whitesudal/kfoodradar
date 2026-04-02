// src/app/api/trends/collect/route.ts
import { NextRequest, NextResponse } from "next/server";

import { collectMenuSignals } from "@/lib/menu-signal-collector";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return true;

  const provided =
    req.headers.get("x-internal-api-key")?.trim() ??
    req.nextUrl.searchParams.get("key")?.trim();

  return provided === expected;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const menu = req.nextUrl.searchParams.get("menu")?.trim();
  if (!menu) {
    return NextResponse.json(
      { error: "menu query is required. example: /api/trends/collect?menu=콩국수" },
      { status: 400 }
    );
  }

  const regionCode = req.nextUrl.searchParams.get("regionCode")?.trim() ?? "KR";
  const relevanceLanguage = req.nextUrl.searchParams.get("lang")?.trim() ?? "ko";

  try {
    const result = await collectMenuSignals(menu, {
      regionCode,
      relevanceLanguage,
    });

    return NextResponse.json({
      source: "live_api",
      collectedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "trend_collection_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}

