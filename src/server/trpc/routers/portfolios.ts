import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { investmentAccounts, accountStatements, accountHoldings } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { deleteStatementFile } from "@/lib/supabase-storage";

// Separate base shape from refinement so .partial() can be used on the shape
const accountShape = z.object({
  accountName: z.string().min(1),
  accountType: z.enum(["taxable", "traditional_ira", "roth_ira", "traditional_401k", "roth_401k", "sep_ira", "solo_401k"]),
  currentBalance: z.number().min(0),
  equityPct: z.number().min(0).max(1),
  bondPct: z.number().min(0).max(1),
  altPct: z.number().min(0).max(1),
  equityReturnRate: z.number().min(0).max(0.5),
  bondReturnRate: z.number().min(0).max(0.5),
  altReturnRate: z.number().min(0).max(0.5),
  annualContribution: z.number().min(0),
  ordinaryYieldRate: z.number().min(0).max(0.15).default(0),
  qualifiedYieldRate: z.number().min(0).max(0.15).default(0),
  taxExemptYieldRate: z.number().min(0).max(0.15).default(0),
});

const accountInput = accountShape.refine(
  d => Math.abs(d.equityPct + d.bondPct + d.altPct - 1) < 0.001,
  { message: "Asset allocation must sum to 100%" }
);

export const portfoliosRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.investmentAccounts.findMany({
      where: eq(investmentAccounts.userId, ctx.userId),
    });
  }),

  add: protectedProcedure
    .input(accountInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(investmentAccounts).values({ userId: ctx.userId, ...input }).returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(accountShape.partial()).superRefine((d, ctx) => {
      const { equityPct, bondPct, altPct } = d;
      if (equityPct !== undefined && bondPct !== undefined && altPct !== undefined) {
        if (Math.abs(equityPct + bondPct + altPct - 1) >= 0.001) {
          ctx.addIssue({ code: "custom", message: "Asset allocation must sum to 100%", path: ["equityPct"] });
        }
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(investmentAccounts)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.userId, ctx.userId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(investmentAccounts)
        .where(and(eq(investmentAccounts.id, input.id), eq(investmentAccounts.userId, ctx.userId)));
    }),

  // ── Holdings / Statement procedures ─────────────────────────────────────────

  getHoldings: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const statements = await ctx.db.query.accountStatements.findMany({
        where: and(
          eq(accountStatements.userId, ctx.userId),
          ...(input.accountId ? [eq(accountStatements.accountId, input.accountId)] : [])
        ),
        with: { holdings: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
      return statements;
    }),

  listAllHoldings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.accountHoldings.findMany({
      where: eq(accountHoldings.userId, ctx.userId),
      with: { statement: true },
    });
  }),

  confirmHoldings: protectedProcedure
    .input(z.object({ statementId: z.string(), accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Associate statement and its holdings with the chosen account
      await ctx.db.update(accountStatements)
        .set({ accountId: input.accountId })
        .where(and(
          eq(accountStatements.id, input.statementId),
          eq(accountStatements.userId, ctx.userId)
        ));
      await ctx.db.update(accountHoldings)
        .set({ accountId: input.accountId })
        .where(and(
          eq(accountHoldings.statementId, input.statementId),
          eq(accountHoldings.userId, ctx.userId)
        ));
    }),

  deleteStatement: protectedProcedure
    .input(z.object({ statementId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [stmt] = await ctx.db
        .select({ storagePath: accountStatements.storagePath })
        .from(accountStatements)
        .where(and(
          eq(accountStatements.id, input.statementId),
          eq(accountStatements.userId, ctx.userId)
        ));
      if (!stmt) return;
      await ctx.db.delete(accountStatements)
        .where(and(
          eq(accountStatements.id, input.statementId),
          eq(accountStatements.userId, ctx.userId)
        ));
      await deleteStatementFile(stmt.storagePath).catch(() => {});
    }),
});
