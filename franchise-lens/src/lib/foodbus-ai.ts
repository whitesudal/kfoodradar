// src/lib/foodbus-ai.ts
// foodbus AI DB adapter for menu-level AI trend signals.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const AI_DB_PYTHON_BIN = process.env.AI_DB_PYTHON_BIN ?? "python3";
const ARO_ROOT = process.env.ARO_ROOT ?? "/home/appuser/aro";

export interface FoodbusAiCoMention {
  name: string;
  count: number;
}

export interface FoodbusAiTrendSignal {
  query: string;
  available: boolean;
  aiResponseCount: number;
  modelBreakdown: Record<string, number>;
  evidenceLines: string[];
  coMentions: FoodbusAiCoMention[];
  aiTrendScore: number | null;
  aiTrendLabel: string;
  warning?: string;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function scoreAiTrend(signal: {
  aiResponseCount: number;
  modelBreakdown: Record<string, number>;
  evidenceLines: string[];
  coMentions: FoodbusAiCoMention[];
}): Pick<FoodbusAiTrendSignal, "aiTrendScore" | "aiTrendLabel"> {
  const modelCoverage = Object.keys(signal.modelBreakdown).length;
  const evidenceCount = signal.evidenceLines.length;
  const coMentionCount = signal.coMentions.length;

  let responseComponent = 0;
  if (signal.aiResponseCount >= 1000) responseComponent = 55;
  else if (signal.aiResponseCount >= 300) responseComponent = 42;
  else if (signal.aiResponseCount >= 100) responseComponent = 28;
  else if (signal.aiResponseCount >= 30) responseComponent = 16;
  else if (signal.aiResponseCount >= 5) responseComponent = 8;

  const modelComponent =
    modelCoverage >= 3 ? 25 : modelCoverage === 2 ? 18 : modelCoverage === 1 ? 10 : 0;
  const evidenceComponent = Math.min(12, evidenceCount * 3);
  const coMentionComponent = Math.min(8, coMentionCount * 1.5);

  const total = round1(clamp(responseComponent + modelComponent + evidenceComponent + coMentionComponent));

  if (total >= 70) return { aiTrendScore: total, aiTrendLabel: "AI 강세" };
  if (total >= 45) return { aiTrendScore: total, aiTrendLabel: "AI 관심" };
  if (total >= 20) return { aiTrendScore: total, aiTrendLabel: "AI 초기" };
  return { aiTrendScore: total, aiTrendLabel: "AI 미약" };
}

export async function fetchFoodbusAiTrend(query: string): Promise<FoodbusAiTrendSignal> {
  const pythonScript = `
import json
import os
import sys

query = sys.argv[1]
aro_root = os.environ.get("ARO_ROOT", "/home/appuser/aro")
if aro_root not in sys.path:
    sys.path.insert(0, aro_root)

try:
    from axsign.shared.foodbus_db import get_connection
except Exception as exc:
    print(json.dumps({"warning": f"foodbus_import_failed:{type(exc).__name__}"}))
    raise SystemExit(0)

conn = get_connection()
if not conn:
    print(json.dumps({"warning": "foodbus_connection_unavailable"}))
    raise SystemExit(0)

payload = {
    "query": query,
    "aiResponseCount": 0,
    "modelBreakdown": {},
    "evidenceLines": [],
    "coMentions": [],
}

like_value = f"%{query}%"

try:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*)
            FROM landing.responses_raw
            WHERE raw_text ILIKE %s
        """, (like_value,))
        row = cur.fetchone()
        payload["aiResponseCount"] = int(row[0]) if row and row[0] is not None else 0

        model_breakdown = {}
        try:
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema='landing' AND table_name='runs'
            """)
            run_cols = [r[0] for r in cur.fetchall()]

            if 'model_name' in run_cols or 'model' in run_cols:
                model_col = 'model_name' if 'model_name' in run_cols else 'model'
                cur.execute(f"""
                    SELECT r.{model_col}, COUNT(DISTINCT rr.id)
                    FROM landing.responses_raw rr
                    JOIN landing.runs r ON rr.run_id = r.id
                    WHERE rr.raw_text ILIKE %s
                    GROUP BY r.{model_col}
                """, (like_value,))
                model_breakdown = {
                    str(name): int(count)
                    for name, count in cur.fetchall()
                    if name
                }
        except Exception:
            model_breakdown = {}

        payload["modelBreakdown"] = model_breakdown

        cur.execute("""
            SELECT DISTINCT evidence_line
            FROM landing.response_mentions
            WHERE evidence_line ILIKE %s
              AND evidence_line IS NOT NULL
              AND LENGTH(evidence_line) > 10
            ORDER BY evidence_line
            LIMIT 5
        """, (like_value,))
        payload["evidenceLines"] = [str(r[0])[:160] for r in cur.fetchall()]

        cur.execute("""
            SELECT mention_name, COUNT(*)
            FROM landing.response_mentions
            WHERE evidence_line ILIKE %s
              AND mention_name IS NOT NULL
            GROUP BY mention_name
            ORDER BY COUNT(*) DESC
            LIMIT 10
        """, (like_value,))
        payload["coMentions"] = [
            {"name": str(name), "count": int(count)}
            for name, count in cur.fetchall()
            if name
        ]
finally:
    conn.close()

print(json.dumps(payload, ensure_ascii=False))
`;

  try {
    const { stdout } = await execFileAsync(
      AI_DB_PYTHON_BIN,
      ["-c", pythonScript, query],
      {
        env: {
          ...process.env,
          ARO_ROOT,
        },
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
      }
    );

    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1];

    if (!lastLine) {
      return {
        query,
        available: false,
        aiResponseCount: 0,
        modelBreakdown: {},
        evidenceLines: [],
        coMentions: [],
        aiTrendScore: null,
        aiTrendLabel: "AI 미확인",
        warning: "foodbus_empty_response",
      };
    }

    const parsed = JSON.parse(lastLine) as Partial<FoodbusAiTrendSignal> & {
      warning?: string;
      aiResponseCount?: number;
      modelBreakdown?: Record<string, number>;
      evidenceLines?: string[];
      coMentions?: FoodbusAiCoMention[];
    };

    if (parsed.warning) {
      return {
        query,
        available: false,
        aiResponseCount: 0,
        modelBreakdown: {},
        evidenceLines: [],
        coMentions: [],
        aiTrendScore: null,
        aiTrendLabel: "AI 미확인",
        warning: parsed.warning,
      };
    }

    const normalized = {
      aiResponseCount: Number(parsed.aiResponseCount ?? 0),
      modelBreakdown: parsed.modelBreakdown ?? {},
      evidenceLines: parsed.evidenceLines ?? [],
      coMentions: parsed.coMentions ?? [],
    };

    const scored = scoreAiTrend(normalized);

    return {
      query,
      available: true,
      ...normalized,
      ...scored,
    };
  } catch (error) {
    return {
      query,
      available: false,
      aiResponseCount: 0,
      modelBreakdown: {},
      evidenceLines: [],
      coMentions: [],
      aiTrendScore: null,
      aiTrendLabel: "AI 미확인",
      warning: error instanceof Error ? `foodbus_exec_failed:${error.message}` : "foodbus_exec_failed",
    };
  }
}

