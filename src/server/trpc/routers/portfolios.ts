import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { investmentAccounts, accountStatements, accountHoldings, holdingRecommendations, userProfiles } from "../../db/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { deleteStatementFile } from "@/lib/supabase-storage";
import { computeAllocationRecommendation } from "../../portfolios/allocation-engine";
import { fetchETFSuggestions } from "../../portfolios/etf-suggestions";
import { refreshHoldingPrices } from "../../portfolios/price-refresh";
import { generateHoldingRecommendations } from "../../portfolios/recommendation-engine";
import { enrichHoldings } from "../../portfolios/data-enrichment";

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

  getAllocationRecommendation: protectedProcedure
    .input(z.object({
      fiDateYear: z.number().nullable().optional(),
      isFI: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const [profile, accounts] = await Promise.all([
        ctx.db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, ctx.userId),
          columns: { birthYear: true },
        }),
        ctx.db.query.investmentAccounts.findMany({
          where: eq(investmentAccounts.userId, ctx.userId),
          columns: { equityPct: true, bondPct: true, altPct: true, currentBalance: true },
        }),
      ]);

      const birthYear = profile?.birthYear ?? 1980;

      return computeAllocationRecommendation({
        birthYear,
        currentYear: new Date().getFullYear(),
        fiDateYear: input.fiDateYear ?? null,
        isFI: input.isFI ?? false,
        accounts: accounts.map(a => ({
          equityPct: a.equityPct,
          bondPct: a.bondPct,
          altPct: a.altPct,
          currentBalance: a.currentBalance,
        })),
      });
    }),

  getInvestmentSuggestions: protectedProcedure
    .input(z.object({
      underweightClasses: z.array(z.enum(["equity", "bond", "alt"])),
    }))
    .query(async ({ input }) => {
      try {
        return await fetchETFSuggestions(input.underweightClasses);
      } catch {
        return [];
      }
    }),

  // ── Holding CRUD ──────────────────────────────────────────────────────────────

  addHolding: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      ticker: z.string().nullable().optional(),
      securityName: z.string().min(1),
      assetClass: z.string().default("equity"),
      securitySubType: z.string().nullable().optional(),
      shares: z.number().nullable().optional(),
      pricePerShare: z.number().nullable().optional(),
      marketValue: z.number(),
      costBasis: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create a synthetic "Manual Entry" statement so the NOT NULL constraint is satisfied
      const [stmt] = await ctx.db.insert(accountStatements).values({
        userId: ctx.userId,
        accountId: input.accountId,
        fileName: "Manual Entry",
        storagePath: "manual/entry",
        parsedAt: new Date(),
        statementDate: new Date().toISOString().slice(0, 10),
        brokerageName: "Manual Entry",
      }).returning();
      const [holding] = await ctx.db.insert(accountHoldings).values({
        userId: ctx.userId,
        statementId: stmt.id,
        accountId: input.accountId,
        ticker: input.ticker?.toUpperCase() ?? null,
        securityName: input.securityName,
        assetClass: input.assetClass,
        securitySubType: input.securitySubType ?? null,
        shares: input.shares ?? null,
        pricePerShare: input.pricePerShare ?? null,
        marketValue: input.marketValue,
        costBasis: input.costBasis != null ? String(input.costBasis) : null,
      }).returning();
      return holding;
    }),

  updateHolding: protectedProcedure
    .input(z.object({
      id: z.string(),
      ticker: z.string().nullable().optional(),
      securityName: z.string().min(1).optional(),
      assetClass: z.string().optional(),
      securitySubType: z.string().nullable().optional(),
      shares: z.number().nullable().optional(),
      pricePerShare: z.number().nullable().optional(),
      marketValue: z.number().optional(),
      costBasis: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, costBasis, ticker, ...rest } = input;
      const setData: Record<string, unknown> = { ...rest };
      if (ticker !== undefined) {
        setData.ticker = ticker?.toUpperCase() ?? null;
      }
      if (costBasis !== undefined) {
        setData.costBasis = costBasis != null ? String(costBasis) : null;
      }
      await ctx.db.update(accountHoldings)
        .set(setData)
        .where(and(eq(accountHoldings.id, id), eq(accountHoldings.userId, ctx.userId)));
    }),

  deleteHolding: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(accountHoldings)
        .where(and(eq(accountHoldings.id, input.id), eq(accountHoldings.userId, ctx.userId)));
    }),

  refreshAccountPrices: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const holdings = await ctx.db.query.accountHoldings.findMany({
        where: and(
          eq(accountHoldings.userId, ctx.userId),
          eq(accountHoldings.accountId, input.accountId),
        ),
        columns: { id: true, ticker: true, shares: true },
      });
      const priceMap = await refreshHoldingPrices(
        holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker ?? null,
          shares: h.shares != null ? String(h.shares) : null,
        }))
      );
      const now = new Date();
      for (const [holdingId, data] of priceMap) {
        await ctx.db.update(accountHoldings)
          .set({
            currentPrice: String(data.currentPrice),
            currentValue: String(data.currentValue),
            priceRefreshedAt: now,
          })
          .where(and(eq(accountHoldings.id, holdingId), eq(accountHoldings.userId, ctx.userId)));
      }
      return { refreshedCount: priceMap.size, refreshedAt: now };
    }),

  // ── Portfolio Intelligence: Price Refresh + Recommendations ──────────────────

  refreshPrices: protectedProcedure
    .mutation(async ({ ctx }) => {
      const holdings = await ctx.db.query.accountHoldings.findMany({
        where: eq(accountHoldings.userId, ctx.userId),
        columns: { id: true, ticker: true, shares: true },
      });
      const priceMap = await refreshHoldingPrices(
        holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker ?? null,
          shares: h.shares != null ? String(h.shares) : null,
        }))
      );
      const now = new Date();
      for (const [holdingId, data] of priceMap) {
        await ctx.db.update(accountHoldings)
          .set({
            currentPrice: String(data.currentPrice),
            currentValue: String(data.currentValue),
            priceRefreshedAt: now,
          })
          .where(and(eq(accountHoldings.id, holdingId), eq(accountHoldings.userId, ctx.userId)));
      }
      return { refreshedCount: priceMap.size, refreshedAt: now };
    }),

  getRecommendations: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.holdingRecommendations.findMany({
        where: eq(holdingRecommendations.userId, ctx.userId),
        orderBy: [desc(holdingRecommendations.generatedAt)],
      });
    }),

  generateRecommendations: protectedProcedure
    .mutation(async ({ ctx }) => {
      const holdings = await ctx.db.query.accountHoldings.findMany({
        where: and(
          eq(accountHoldings.userId, ctx.userId),
          isNotNull(accountHoldings.accountId),
        ),
        columns: {
          id: true, ticker: true, securityName: true, assetClass: true,
          shares: true, currentPrice: true, currentValue: true,
        },
      });
      if (holdings.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No confirmed holdings found." });
      }
      const validHoldingIds = new Set(holdings.map((h) => h.id));
      let recs;
      try {
        recs = await Promise.race([
          generateHoldingRecommendations(
            holdings.map((h) => ({
              id: h.id,
              ticker: h.ticker ?? null,
              securityName: h.securityName,
              assetClass: h.assetClass ?? null,
              accountType: null,
              shares: h.shares != null ? String(h.shares) : null,
              currentPrice: h.currentPrice ?? null,
              currentValue: h.currentValue ?? null,
            }))
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out. Please try again.")), 80_000)
          ),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[generateRecommendations] AI error:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate recommendations: ${message}`,
        });
      }
      // Filter out any recs whose holdingId Claude hallucinated (not in our actual holdings)
      const validRecs = recs.filter((r) => validHoldingIds.has(r.holdingId));

      // Delete existing then insert fresh — wrapped in a transaction so a failed
      // insert does not leave the user with zero recommendations.
      try {
        await ctx.db.transaction(async (tx) => {
          await tx.delete(holdingRecommendations)
            .where(eq(holdingRecommendations.userId, ctx.userId));
          if (validRecs.length > 0) {
            await tx.insert(holdingRecommendations).values(
              validRecs.map((r) => ({
                userId: ctx.userId,
                holdingId: r.holdingId,
                ticker: r.ticker ?? null,
                securityName: r.securityName,
                action: r.action,
                targetAllocationNote: r.targetAllocationNote,
                alternativeTicker: r.alternativeTicker ?? null,
                alternativeSecurityName: r.alternativeSecurityName ?? null,
                shortRationale: r.shortRationale,
                fullRationale: r.fullRationale,
                citations: r.citations,
                urgency: r.urgency,
              }))
            );
          }
        });
      } catch (dbErr) {
        const message = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.error("[generateRecommendations] DB error:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to save recommendations: ${message}`,
        });
      }
      return validRecs;
    }),

  /**
   * Fetch all holdings for the user, enrich them with FMP dividend yield data,
   * and return estimated annual yield income = sum(currentValue * dividendYieldPct / 100).
   * dividendYieldPct from FMP is expressed as a percentage (e.g. 3.5 = 3.5%).
   * Returns a lightweight summary suitable for the Income Gap Dashboard Card.
   */
  getPortfolioYieldSummary: protectedProcedure.query(async ({ ctx }) => {
    const holdings = await ctx.db.query.accountHoldings.findMany({
      where: eq(accountHoldings.userId, ctx.userId),
      columns: {
        id: true,
        ticker: true,
        securityName: true,
        assetClass: true,
        marketValue: true,
        currentValue: true,
      },
    });

    if (holdings.length === 0) {
      return { estimatedAnnualYieldIncome: 0, holdingCount: 0 };
    }

    // Enrich with FMP data (which contains dividendYieldPct). Cap enrichment time.
    let enriched: Awaited<ReturnType<typeof enrichHoldings>>;
    try {
      enriched = await Promise.race([
        enrichHoldings(holdings.map((h) => ({ ...h, ticker: h.ticker ?? null }))),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Enrichment timeout")), 15_000)
        ),
      ]);
    } catch {
      return { estimatedAnnualYieldIncome: null, holdingCount: holdings.length };
    }

    // Build a value map from the original holdings (typed correctly) keyed by ticker
    // so we can combine with enriched fmpData without TypeScript generics confusion.
    const valueByTicker = new Map<string, number>();
    for (const h of holdings) {
      if (!h.ticker) continue;
      const val =
        h.currentValue != null ? parseFloat(String(h.currentValue)) : h.marketValue;
      // Sum values for same ticker across accounts
      valueByTicker.set(h.ticker, (valueByTicker.get(h.ticker) ?? 0) + val);
    }

    let estimatedAnnualYieldIncome = 0;
    for (const h of enriched) {
      const ticker = (h as { ticker?: string | null }).ticker;
      if (!ticker) continue;
      const value = valueByTicker.get(ticker) ?? 0;
      const yieldPct = h.fmpData?.dividendYieldPct;
      if (value > 0 && yieldPct != null && yieldPct > 0) {
        // dividendYieldPct from FMP is already a percentage: 3.5 means 3.5%
        estimatedAnnualYieldIncome += value * (yieldPct / 100);
      }
    }

    return {
      estimatedAnnualYieldIncome: Math.round(estimatedAnnualYieldIncome),
      holdingCount: holdings.length,
    };
  }),
});
