import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../index";
import { expenditures, oneTimeExpenditures, children } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export const expendituresRouter = createTRPCRouter({
  listRecurring: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.expenditures.findMany({
      where: eq(expenditures.userId, ctx.userId),
      orderBy: (e, { asc }) => [asc(e.category), asc(e.description)],
    });
  }),

  listOneTime: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.oneTimeExpenditures.findMany({
      where: eq(oneTimeExpenditures.userId, ctx.userId),
      orderBy: (e, { asc }) => [asc(e.projectedYear), asc(e.projectedQuarter)],
    });
  }),

  addRecurring: protectedProcedure
    .input(z.object({
      description: z.string().min(1),
      annualAmount: z.number().min(0),
      growthRate: z.number().min(0).max(0.5),
      category: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(expenditures).values({ userId: ctx.userId, ...input }).returning();
    }),

  updateRecurring: protectedProcedure
    .input(z.object({
      id: z.string(),
      description: z.string().min(1).optional(),
      annualAmount: z.number().min(0).optional(),
      growthRate: z.number().min(0).max(0.5).optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(expenditures)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(expenditures.id, id), eq(expenditures.userId, ctx.userId)));
    }),

  deleteRecurring: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(expenditures)
        .where(and(eq(expenditures.id, input.id), eq(expenditures.userId, ctx.userId)));
    }),

  addOneTime: protectedProcedure
    .input(z.object({
      description: z.string().min(1),
      amount: z.number().min(0),
      projectedYear: z.number().int().min(2024).max(2070),
      projectedQuarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
      category: z.string(),
      isChildEducation: z.boolean(),
      childId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.childId) {
        const child = await ctx.db.query.children.findFirst({
          where: and(eq(children.id, input.childId), eq(children.userId, ctx.userId)),
          columns: { id: true },
        });
        if (!child) throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.insert(oneTimeExpenditures).values({ userId: ctx.userId, ...input }).returning();
    }),

  updateOneTime: protectedProcedure
    .input(z.object({
      id: z.string(),
      description: z.string().min(1).optional(),
      amount: z.number().min(0).optional(),
      projectedYear: z.number().int().min(2024).max(2070).optional(),
      projectedQuarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(oneTimeExpenditures)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(oneTimeExpenditures.id, id), eq(oneTimeExpenditures.userId, ctx.userId)));
    }),

  deleteOneTime: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(oneTimeExpenditures)
        .where(and(eq(oneTimeExpenditures.id, input.id), eq(oneTimeExpenditures.userId, ctx.userId)));
    }),
});
