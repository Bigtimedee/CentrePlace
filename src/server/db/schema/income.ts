import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const incomeProfiles = pgTable("income_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => userProfiles.id, { onDelete: "cascade" }),
  annualSalary: real("annual_salary").notNull().default(0),
  annualBonus: real("annual_bonus").notNull().default(0),
  salaryGrowthRate: real("salary_growth_rate").notNull().default(0.03), // 3% annual growth
  bonusGrowthRate: real("bonus_growth_rate").notNull().default(0.03),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
