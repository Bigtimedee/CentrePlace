import { pgTable, text, integer, real, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

export const filingStatusEnum = pgEnum("filing_status", ["single", "married_filing_jointly"]);
export const educationTypeEnum = pgEnum("education_type", ["none", "public", "private"]);

export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(), // Clerk user ID
  filingStatus: filingStatusEnum("filing_status").notNull().default("single"),
  stateOfResidence: text("state_of_residence").notNull().default("CA"),
  birthYear: integer("birth_year").notNull(),
  targetAge: integer("target_age").notNull().default(90),
  assumedReturnRate: real("assumed_return_rate").notNull().default(0.07), // 7%
  postFIReturnRate: real("post_fi_return_rate").notNull().default(0.05), // 5% conservative post-FI
  safeHarborElection: boolean("safe_harbor_election").notNull().default(true),
  /** City of residence for local income tax modeling (e.g. "NYC", "Philadelphia") */
  cityOfResidence: text("city_of_residence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const children = pgTable("children", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  birthYear: integer("birth_year").notNull(),
  k12TuitionCost: real("k12_tuition_cost").notNull().default(0), // annual private K-12 tuition (ages 5–17)
  educationType: educationTypeEnum("education_type").notNull().default("none"),
  annualEducationCost: real("annual_education_cost").default(0),
  includesGraduateSchool: boolean("includes_graduate_school").notNull().default(false),
  graduateSchoolCost: real("graduate_school_cost").default(0),
  graduateSchoolYears: integer("graduate_school_years").default(0),
  inheritancePct: real("inheritance_pct").default(0), // estate beneficiary allocation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("children_user_id_idx").on(t.userId),
]);
