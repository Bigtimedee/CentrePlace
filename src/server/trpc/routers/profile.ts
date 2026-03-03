import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { userProfiles, children } from "../../db/schema";
import { eq } from "drizzle-orm";

export const profileRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ctx.userId),
      with: { children: true },
    });
    return profile ?? null;
  }),

  upsert: protectedProcedure
    .input(z.object({
      filingStatus: z.enum(["single", "married_filing_jointly"]),
      stateOfResidence: z.string().length(2),
      birthYear: z.number().int().min(1940).max(2000),
      targetAge: z.number().int().min(70).max(100),
      assumedReturnRate: z.number().min(0.01).max(0.20),
      safeHarborElection: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userProfiles)
        .values({ id: ctx.userId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: userProfiles.id,
          set: { ...input, updatedAt: new Date() },
        });
    }),

  addChild: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      birthYear: z.number().int().min(2000).max(2025),
      educationType: z.enum(["none", "public", "private"]),
      annualEducationCost: z.number().min(0),
      includesGraduateSchool: z.boolean(),
      graduateSchoolCost: z.number().min(0),
      graduateSchoolYears: z.number().int().min(0).max(10),
      inheritancePct: z.number().min(0).max(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(children).values({ userId: ctx.userId, ...input });
    }),

  updateChild: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      birthYear: z.number().int().optional(),
      educationType: z.enum(["none", "public", "private"]).optional(),
      annualEducationCost: z.number().min(0).optional(),
      includesGraduateSchool: z.boolean().optional(),
      graduateSchoolCost: z.number().min(0).optional(),
      graduateSchoolYears: z.number().int().min(0).max(10).optional(),
      inheritancePct: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(children)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(children.id, id));
    }),

  deleteChild: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(children).where(eq(children.id, input.id));
    }),
});
