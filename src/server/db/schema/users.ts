import { pgTable, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const filingStatusEnum = pgEnum("filing_status", ["single", "married_filing_jointly"]);
export const educationTypeEnum = pgEnum("education_type", ["none", "public", "private"]);

export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(), // Clerk user ID
  filingStatus: filingStatusEnum("filing_status").notNull().default("single"),
  stateOfResidence: text("state_of_residence").notNull().default("CA"),
  birthYear: integer("birth_year").notNull(),
  targetAge: integer("target_age").notNull().default(90),
  assumedReturnRate: real("assumed_return_rate").notNull().default(0.07), // 7%
  safeHarborElection: boolean("safe_harbor_election").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const children = pgTable("children", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  birthYear: integer("birth_year").notNull(),
  educationType: educationTypeEnum("education_type").notNull().default("none"),
  annualEducationCost: real("annual_education_cost").default(0),
  includesGraduateSchool: boolean("includes_graduate_school").notNull().default(false),
  graduateSchoolCost: real("graduate_school_cost").default(0),
  graduateSchoolYears: integer("graduate_school_years").default(0),
  inheritancePct: real("inheritance_pct").default(0), // estate beneficiary allocation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
