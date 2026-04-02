import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { researchTraces } from "../../db/schema/research-traces";
import { runResearchAgent } from "../../research/agent";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const researchRouter = createTRPCRouter({
  run: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      // Create trace record
      const [trace] = await ctx.db
        .insert(researchTraces)
        .values({
          userId: ctx.userId,
          query: input.query,
          status: "pending",
        })
        .returning({ id: researchTraces.id });

      try {
        const result = await runResearchAgent(
          input.query,
          ctx.db,
          ctx.userId,
          trace.id,
        );
        return result;
      } catch (err) {
        await ctx.db
          .update(researchTraces)
          .set({
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          })
          .where(eq(researchTraces.id, trace.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Research agent failed",
        });
      }
    }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: researchTraces.id,
          query: researchTraces.query,
          answer: researchTraces.answer,
          status: researchTraces.status,
          iterations: researchTraces.iterations,
          createdAt: researchTraces.createdAt,
        })
        .from(researchTraces)
        .where(eq(researchTraces.userId, ctx.userId))
        .orderBy(desc(researchTraces.createdAt))
        .limit(input.limit);
    }),

  getTrace: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(researchTraces)
        .where(
          and(
            eq(researchTraces.id, input.id),
            eq(researchTraces.userId, ctx.userId),
          ),
        );
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});
