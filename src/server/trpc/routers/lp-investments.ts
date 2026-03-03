import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { lpInvestments } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const distributionSchema = z.object({
  year: z.number().int().min(2024).max(2070),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  amount: z.number().min(0),
  taxCharacter: z.enum(["ltcg", "ordinary", "return_of_capital"]),
});

const lpInput = z.object({
  fundName: z.string().min(1),
  vintageYear: z.number().int().min(2000).max(2030),
  commitmentAmount: z.number().min(0),
  currentNav: z.number().min(0),
  expectedDistributions: z.array(distributionSchema),
  notes: z.string().optional(),
});

export const lpInvestmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.lpInvestments.findMany({
      where: eq(lpInvestments.userId, ctx.userId),
      orderBy: (p, { asc }) => [asc(p.vintageYear)],
    });
  }),

  add: protectedProcedure
    .input(lpInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(lpInvestments).values({ userId: ctx.userId, ...input }).returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(lpInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(lpInvestments)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(lpInvestments.id, id), eq(lpInvestments.userId, ctx.userId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(lpInvestments)
        .where(and(eq(lpInvestments.id, input.id), eq(lpInvestments.userId, ctx.userId)));
    }),
});
