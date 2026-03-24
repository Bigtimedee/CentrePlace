import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { equityGrants, equityVestingEvents, equityShareLots } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { DB } from "../../db";

const GRANT_TYPES = ["rsu", "iso", "nso", "warrant", "rsa"] as const;
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

const grantShape = z.object({
  companyName: z.string().min(1),
  grantType: z.enum(GRANT_TYPES),
  grantDate: z.string(),
  totalShares: z.number().int().positive(),
  strikePrice: z.number().nonnegative().nullable(),
  currentFmv: z.number().positive(),
  fmvGrowthRate: z.number().min(0).max(1).default(0.08),
  expirationDate: z.string().nullable(),
  notes: z.string().nullable(),
});

const vestingEventShape = z.object({
  grantId: z.string(),
  year: z.number().int(),
  quarter: z.enum(QUARTERS),
  shares: z.number().int().positive(),
  projectedFmvAtEvent: z.number().positive().nullable(),
});

const shareLotShape = z.object({
  grantId: z.string(),
  shares: z.number().int().positive(),
  costBasisPerShare: z.number().nonnegative(),
  acquiredDate: z.string(),
  projectedSaleYear: z.number().int().nullable(),
  projectedSaleQuarter: z.enum(QUARTERS).nullable(),
  isIsoQualifying: z.boolean().default(false),
});

/** Check that adding `additionalShares` to grant `grantId` doesn't exceed totalShares. */
async function validateVestingShares(
  db: DB,
  grantId: string,
  userId: string,
  additionalShares: number,
  excludeEventId?: string,
): Promise<void> {
  const grant = await db
    .select({ totalShares: equityGrants.totalShares })
    .from(equityGrants)
    .where(and(eq(equityGrants.id, grantId), eq(equityGrants.userId, userId)))
    .limit(1);

  if (grant.length === 0) throw new Error("Grant not found.");

  const existing = await db
    .select({ shares: equityVestingEvents.shares })
    .from(equityVestingEvents)
    .where(eq(equityVestingEvents.grantId, grantId));

  const currentTotal = existing.reduce((s, r) => s + r.shares, 0);

  let excludeAmt = 0;
  if (excludeEventId) {
    const excludeRow = await db
      .select({ shares: equityVestingEvents.shares })
      .from(equityVestingEvents)
      .where(eq(equityVestingEvents.id, excludeEventId))
      .limit(1);
    excludeAmt = excludeRow[0]?.shares ?? 0;
  }

  const newTotal = currentTotal - excludeAmt + additionalShares;
  if (newTotal > grant[0].totalShares) {
    throw new Error(
      `Vesting shares (${newTotal}) would exceed grant total (${grant[0].totalShares}).`
    );
  }
}

export const equityCompensationRouter = createTRPCRouter({
  // ── Grants ────────────────────────────────────────────────────────────────

  list: protectedProcedure.query(async ({ ctx }) => {
    const grants = await ctx.db
      .select()
      .from(equityGrants)
      .where(eq(equityGrants.userId, ctx.userId))
      .orderBy(desc(equityGrants.createdAt));

    const vestingRows = await ctx.db
      .select()
      .from(equityVestingEvents)
      .where(eq(equityVestingEvents.userId, ctx.userId))
      .orderBy(equityVestingEvents.year, equityVestingEvents.quarter);

    const lotRows = await ctx.db
      .select()
      .from(equityShareLots)
      .where(eq(equityShareLots.userId, ctx.userId))
      .orderBy(equityShareLots.acquiredDate);

    return grants.map((g) => ({
      ...g,
      vestingEvents: vestingRows.filter((v) => v.grantId === g.id),
      shareLots: lotRows.filter((l) => l.grantId === g.id),
    }));
  }),

  add: protectedProcedure.input(grantShape).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .insert(equityGrants)
      .values({ ...input, userId: ctx.userId })
      .returning();
    return row;
  }),

  update: protectedProcedure
    .input(grantShape.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [row] = await ctx.db
        .update(equityGrants)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(equityGrants.id, id), eq(equityGrants.userId, ctx.userId)))
        .returning();
      return row;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(equityGrants)
        .where(and(eq(equityGrants.id, input.id), eq(equityGrants.userId, ctx.userId)));
    }),

  // ── Vesting Events ────────────────────────────────────────────────────────

  addVestingEvent: protectedProcedure
    .input(vestingEventShape)
    .mutation(async ({ ctx, input }) => {
      await validateVestingShares(ctx.db, input.grantId, ctx.userId, input.shares);
      const [row] = await ctx.db
        .insert(equityVestingEvents)
        .values({ ...input, userId: ctx.userId })
        .returning();
      return row;
    }),

  updateVestingEvent: protectedProcedure
    .input(vestingEventShape.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await validateVestingShares(ctx.db, input.grantId, ctx.userId, input.shares, id);
      const [row] = await ctx.db
        .update(equityVestingEvents)
        .set(rest)
        .where(and(eq(equityVestingEvents.id, id), eq(equityVestingEvents.userId, ctx.userId)))
        .returning();
      return row;
    }),

  deleteVestingEvent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(equityVestingEvents)
        .where(and(eq(equityVestingEvents.id, input.id), eq(equityVestingEvents.userId, ctx.userId)));
    }),

  // ── Share Lots ────────────────────────────────────────────────────────────

  addShareLot: protectedProcedure.input(shareLotShape).mutation(async ({ ctx, input }) => {
    const { isIsoQualifying, ...rest } = input;
    const [row] = await ctx.db
      .insert(equityShareLots)
      .values({ ...rest, userId: ctx.userId, isIsoQualifying: isIsoQualifying ? 1 : 0 })
      .returning();
    return row;
  }),

  updateShareLot: protectedProcedure
    .input(shareLotShape.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, isIsoQualifying, ...rest } = input;
      const [row] = await ctx.db
        .update(equityShareLots)
        .set({ ...rest, isIsoQualifying: isIsoQualifying ? 1 : 0 })
        .where(and(eq(equityShareLots.id, id), eq(equityShareLots.userId, ctx.userId)))
        .returning();
      return row;
    }),

  deleteShareLot: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(equityShareLots)
        .where(and(eq(equityShareLots.id, input.id), eq(equityShareLots.userId, ctx.userId)));
    }),
});
