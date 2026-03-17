import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { incomeProfiles } from "../../db/schema";
import { eq } from "drizzle-orm";

export const incomeRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    return (await ctx.db.query.incomeProfiles.findFirst({
      where: eq(incomeProfiles.userId, ctx.userId),
    })) ?? null;
  }),

  upsert: protectedProcedure
    .input(z.object({
      annualSalary: z.number().min(0),
      annualBonus: z.number().min(0),
      salaryGrowthRate: z.number().min(0).max(0.5),
      bonusGrowthRate: z.number().min(0).max(0.5),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(incomeProfiles)
        .values({ userId: ctx.userId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: incomeProfiles.userId,
          set: { ...input, updatedAt: new Date() },
        });
    }),
});
