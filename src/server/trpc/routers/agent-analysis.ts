import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { agentAnalysisJobs, accountHoldings } from "../../db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const agentAnalysisRouter = createTRPCRouter({
  /**
   * Start a new agent analysis job for the user's confirmed holdings.
   * Fires off a request to the Railway microservice and returns the job id.
   * Results arrive async via the webhook at /api/webhook/agent-analysis.
   */
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const railwayUrl = process.env.AGENT_RAILWAY_URL?.trim();
    const webhookSecret = process.env.AGENT_WEBHOOK_SECRET?.trim();
    if (!railwayUrl || !webhookSecret) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Agent analysis service is not configured.",
      });
    }

    // Gather confirmed holdings that have tickers
    const holdings = await ctx.db.query.accountHoldings.findMany({
      where: and(
        eq(accountHoldings.userId, ctx.userId),
        isNotNull(accountHoldings.accountId),
        isNotNull(accountHoldings.ticker),
      ),
      columns: { ticker: true },
    });

    const tickers = [...new Set(holdings.map((h) => h.ticker!.toUpperCase()))];
    if (tickers.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No confirmed holdings with tickers found.",
      });
    }

    // Create job record in "pending" state
    const [job] = await ctx.db
      .insert(agentAnalysisJobs)
      .values({
        userId: ctx.userId,
        status: "pending",
        tickers,
        startedAt: new Date(),
      })
      .returning({ id: agentAnalysisJobs.id });

    const today = new Date().toISOString().slice(0, 10);
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://gpretire.com"}/api/webhook/agent-analysis`;

    // Fire-and-forget to Railway — don't await, just let it run
    fetch(`${railwayUrl}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        job_id: job.id,
        tickers,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        analysis_date: today,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[agentAnalysis] Railway rejected job ${job.id}: ${res.status} ${text}`);
          await ctx.db
            .update(agentAnalysisJobs)
            .set({ status: "failed", error: `Railway returned ${res.status}`, completedAt: new Date() })
            .where(eq(agentAnalysisJobs.id, job.id));
        } else {
          // Mark as "running" once Railway acknowledged
          await ctx.db
            .update(agentAnalysisJobs)
            .set({ status: "running" })
            .where(eq(agentAnalysisJobs.id, job.id));
        }
      })
      .catch(async (err) => {
        console.error(`[agentAnalysis] Failed to reach Railway for job ${job.id}:`, err);
        await ctx.db
          .update(agentAnalysisJobs)
          .set({ status: "failed", error: String(err), completedAt: new Date() })
          .where(eq(agentAnalysisJobs.id, job.id));
      });

    return { jobId: job.id, tickers, status: "pending" as const };
  }),

  /**
   * Get the latest agent analysis job for the current user.
   * Auto-fails jobs that have been stuck in "running" for more than 20 minutes.
   */
  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const job = await ctx.db.query.agentAnalysisJobs.findFirst({
      where: eq(agentAnalysisJobs.userId, ctx.userId),
      orderBy: [desc(agentAnalysisJobs.createdAt)],
    });
    if (!job) return null;

    if (job.status === "running" && job.startedAt) {
      const ageMs = Date.now() - new Date(job.startedAt).getTime();
      if (ageMs > 20 * 60 * 1000) {
        const timeoutError = "Analysis timed out after 20 minutes with no response from the service.";
        await ctx.db
          .update(agentAnalysisJobs)
          .set({ status: "failed", error: timeoutError, completedAt: new Date() })
          .where(eq(agentAnalysisJobs.id, job.id));
        return { ...job, status: "failed" as const, error: timeoutError, completedAt: new Date() };
      }
    }

    return job;
  }),

  /**
   * Get a specific job by id (must belong to the current user).
   */
  getJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.agentAnalysisJobs.findFirst({
        where: and(
          eq(agentAnalysisJobs.id, input.jobId),
          eq(agentAnalysisJobs.userId, ctx.userId),
        ),
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found." });
      }
      return job;
    }),
});
