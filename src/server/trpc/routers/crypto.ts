import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { cryptoHoldings } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

const cryptoHoldingInput = z.object({
  coinName: z.string().min(1),
  symbol: z.string().nullable().optional(),
  quantityCoins: z.number().min(0).default(0),
  pricePerCoin: z.number().min(0).nullable().optional(),
  currentValue: z.number().min(0),
  costBasis: z.number().min(0).nullable().optional(),
  expectedAppreciationRate: z.number().min(0).max(1).default(0.07),
  expectedSaleYear: z.number().int().min(2024).max(2100).nullable().optional(),
  saleFraction: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const cryptoRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.cryptoHoldings.findMany({
      where: eq(cryptoHoldings.userId, ctx.userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }),

  add: protectedProcedure
    .input(cryptoHoldingInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .insert(cryptoHoldings)
        .values({ userId: ctx.userId, ...input })
        .returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(cryptoHoldingInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db
        .update(cryptoHoldings)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(cryptoHoldings.id, id),
            eq(cryptoHoldings.userId, ctx.userId)
          )
        );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(cryptoHoldings)
        .where(
          and(
            eq(cryptoHoldings.id, input.id),
            eq(cryptoHoldings.userId, ctx.userId)
          )
        );
    }),
});
