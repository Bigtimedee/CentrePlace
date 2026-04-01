import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { hedgeFundJobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get("x-agent-webhook-secret");
  const expectedSecret = process.env.AGENT_WEBHOOK_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { job_id, status, results, portfolioDecision, error } = body as {
    job_id: string;
    status: string;
    results?: Record<string, unknown>;
    portfolioDecision?: Record<string, unknown>;
    error?: string;
  };

  if (!job_id || !status) {
    return NextResponse.json({ error: "Missing job_id or status" }, { status: 400 });
  }

  const now = new Date();

  await db
    .update(hedgeFundJobs)
    .set({
      status: status === "completed" ? "completed" : "failed",
      results: results ?? null,
      portfolioDecision: portfolioDecision ?? null,
      error: error ?? null,
      completedAt: now,
    })
    .where(eq(hedgeFundJobs.id, job_id));

  return NextResponse.json({ ok: true });
}
