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
      });
      if (!position) throw new TRPCError({ code: "NOT_FOUND" });
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
      const { id, ...fields } = input;
      await ctx.db.update(carryRealizations)
        .set(fields)
        .where(and(eq(carryRealizations.id, id), eq(carryRealizations.userId, ctx.userId)));
    }),

  deleteRealization: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(carryRealizations)
        .where(and(eq(carryRealizations.id, input.id), eq(carryRealizations.userId, ctx.userId)));
    }),
});
