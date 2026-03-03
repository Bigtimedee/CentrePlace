import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { realEstateProperties, mortgages } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const propertyInput = z.object({
  propertyName: z.string().min(1),
  propertyType: z.enum(["primary_residence", "rental", "vacation", "commercial", "llc_held"]),
  currentValue: z.number().min(0),
  purchasePrice: z.number().min(0),
  purchaseYear: z.number().int().min(1970).max(2030),
  appreciationRate: z.number().min(0).max(0.3),
  ownershipPct: z.number().min(0.01).max(1),
  llcValuationDiscountPct: z.number().min(0).max(0.5).optional(),
  annualRentalIncome: z.number().min(0).optional(),
  annualOperatingExpenses: z.number().min(0).optional(),
  personalUseDaysPerYear: z.number().int().min(0).max(365).optional(),
  projectedSaleYear: z.number().int().min(2024).max(2070).optional(),
  projectedSaleQuarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
  is1031Exchange: z.boolean(),
});

const mortgageInput = z.object({
  propertyId: z.string(),
  outstandingBalance: z.number().min(0),
  interestRate: z.number().min(0).max(0.3),
  remainingTermMonths: z.number().int().min(1).max(360),
  loanType: z.enum(["fixed", "arm"]),
  armAdjustmentSchedule: z.string().optional(),
});

export const realEstateRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.realEstateProperties.findMany({
      where: eq(realEstateProperties.userId, ctx.userId),
      with: { mortgage: true },
    });
  }),

  addProperty: protectedProcedure
    .input(propertyInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(realEstateProperties).values({ userId: ctx.userId, ...input }).returning();
    }),

  updateProperty: protectedProcedure
    .input(z.object({ id: z.string() }).merge(propertyInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(realEstateProperties)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(realEstateProperties.id, id), eq(realEstateProperties.userId, ctx.userId)));
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(realEstateProperties)
        .where(and(eq(realEstateProperties.id, input.id), eq(realEstateProperties.userId, ctx.userId)));
    }),

  upsertMortgage: protectedProcedure
    .input(mortgageInput)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(mortgages)
        .values(input)
        .onConflictDoUpdate({
          target: mortgages.propertyId,
          set: { ...input, updatedAt: new Date() },
        });
    }),

  deleteMortgage: protectedProcedure
    .input(z.object({ propertyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(mortgages).where(eq(mortgages.propertyId, input.propertyId));
    }),
});
