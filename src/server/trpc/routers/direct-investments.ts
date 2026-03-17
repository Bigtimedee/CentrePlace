import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { directInvestments } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

const directInvestmentShape = z.object({
  securityName: z.string().min(1),
  assetClass: z.enum(["equity", "bond", "alt", "cash"]),
  industry: z.string().optional(),
  stage: z.string().optional(),
  ownershipPct: z.number().min(0).max(100).optional(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  expectedExitYear: z.number().int().min(2000).max(2100).optional(),
  expectedReturnRate: z.number().min(0).max(0.5).default(0.07),
  ordinaryYieldRate: z.number().min(0).max(0.15).default(0),
  qualifiedYieldRate: z.number().min(0).max(0.15).default(0),
  taxExemptYieldRate: z.number().min(0).max(0.15).default(0),
  notes: z.string().optional(),
});

export const directInvestmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.directInvestments.findMany({
      where: eq(directInvestments.userId, ctx.userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }),

  add: protectedProcedure
    .input(directInvestmentShape)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .insert(directInvestments)
        .values({ userId: ctx.userId, ...input })
        .returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(directInvestmentShape.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db
        .update(directInvestments)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(directInvestments.id, id),
            eq(directInvestments.userId, ctx.userId)
          )
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(directInvestments)
        .where(
          and(
            eq(directInvestments.id, input.id),
            eq(directInvestments.userId, ctx.userId)
          )
        );
    }),
});
