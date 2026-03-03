import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { carryPositions } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const carryInput = z.object({
  fundName: z.string().min(1),
  vintageYear: z.number().int().min(2000).max(2030),
  carryPct: z.number().min(0).max(0.5),
  totalCommittedCapital: z.number().min(0),
  currentTvpi: z.number().min(0),
  expectedGrossCarry: z.number().min(0),
  haircutPct: z.number().min(0).max(0.9),
  expectedRealizationYear: z.number().int().min(2024).max(2070),
  expectedRealizationQuarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  notes: z.string().optional(),
});

export const carryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.carryPositions.findMany({
      where: eq(carryPositions.userId, ctx.userId),
      orderBy: (p, { asc }) => [asc(p.expectedRealizationYear)],
    });
  }),

  add: protectedProcedure
    .input(carryInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(carryPositions).values({ userId: ctx.userId, ...input }).returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(carryInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(carryPositions)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(carryPositions.id, id), eq(carryPositions.userId, ctx.userId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(carryPositions)
        .where(and(eq(carryPositions.id, input.id), eq(carryPositions.userId, ctx.userId)));
    }),
});
