import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../index";
import { carryPositions, carryRealizations } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const carryInput = z.object({
  fundName: z.string().min(1),
  vintageYear: z.number().int().min(2000).max(2030),
  carryPct: z.number().min(0).max(0.5),
  totalCommittedCapital: z.number().min(0),
  currentTvpi: z.number().min(0),
  expectedGrossCarry: z.number().min(0),
  haircutPct: z.number().min(0).max(0.9),
  notes: z.string().optional(),
});

const realizationInput = z.object({
  carryPositionId: z.string(),
  year: z.number().int().min(2024).max(2070),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  pct: z.number().min(0.01).max(1.0),
});

export const carryRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.carryPositions.findMany({
      where: eq(carryPositions.userId, ctx.userId),
      with: { realizations: true },
      orderBy: (p, { asc }) => [asc(p.createdAt)],
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

  addRealization: protectedProcedure
    .input(realizationInput)
    .mutation(async ({ ctx, input }) => {
      const position = await ctx.db.query.carryPositions.findFirst({
        where: and(eq(carryPositions.id, input.carryPositionId), eq(carryPositions.userId, ctx.userId)),
        with: { realizations: true },
      });
      if (!position) throw new TRPCError({ code: "NOT_FOUND" });
      const existingTotal = (position.realizations ?? []).reduce((s, r) => s + r.pct, 0);
      if (existingTotal + input.pct > 1.0 + 1e-9) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Realization percentages would exceed 100%. Current total: ${Math.round(existingTotal * 100)}%, adding ${Math.round(input.pct * 100)}%.`,
        });
      }
      const [row] = await ctx.db.insert(carryRealizations).values({
        carryPositionId: input.carryPositionId,
        userId: ctx.userId,
        year: input.year,
        quarter: input.quarter,
        pct: input.pct,
      }).returning();
      return row;
    }),

  updateRealization: protectedProcedure
    .input(z.object({
      id: z.string(),
      year: z.number().int().min(2024).max(2070).optional(),
      quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
      pct: z.number().min(0.01).max(1.0).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, pct, ...fields } = input;
      if (pct !== undefined) {
        const existing = await ctx.db.query.carryRealizations.findFirst({
          where: and(eq(carryRealizations.id, id), eq(carryRealizations.userId, ctx.userId)),
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const siblings = await ctx.db.query.carryRealizations.findMany({
          where: and(
            eq(carryRealizations.carryPositionId, existing.carryPositionId),
            eq(carryRealizations.userId, ctx.userId),
          ),
        });
        const othersTotal = siblings.filter(r => r.id !== id).reduce((s, r) => s + r.pct, 0);
        if (othersTotal + pct > 1.0 + 1e-9) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Realization percentages would exceed 100%. Other tranches total: ${Math.round(othersTotal * 100)}%, updating to ${Math.round(pct * 100)}%.`,
          });
        }
      }
      await ctx.db.update(carryRealizations)
        .set({ ...fields, ...(pct !== undefined ? { pct } : {}) })
        .where(and(eq(carryRealizations.id, id), eq(carryRealizations.userId, ctx.userId)));
    }),

  deleteRealization: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(carryRealizations)
        .where(and(eq(carryRealizations.id, input.id), eq(carryRealizations.userId, ctx.userId)));
    }),
});
