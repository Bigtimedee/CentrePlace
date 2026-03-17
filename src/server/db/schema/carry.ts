import { pgTable, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const carryPositions = pgTable("carry_positions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  fundName: text("fund_name").notNull(),
  vintageYear: integer("vintage_year").notNull(),
  carryPct: real("carry_pct").notNull(), // e.g., 0.20 for 20%
  totalCommittedCapital: real("total_committed_capital").notNull(),
  currentTvpi: real("current_tvpi").notNull().default(1.0),
  expectedGrossCarry: real("expected_gross_carry").notNull().default(0), // user's estimate
  haircutPct: real("haircut_pct").notNull().default(0.2), // default 20% haircut
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("carry_positions_user_id_idx").on(t.userId),
]);

export const carryRealizations = pgTable("carry_realizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  carryPositionId: text("carry_position_id").notNull()
    .references(() => carryPositions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: text("quarter").notNull().default("Q4"), // "Q1"|"Q2"|"Q3"|"Q4"
  pct: real("pct").notNull(), // fraction of expectedGrossCarry: e.g. 0.30 = 30%
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("carry_realizations_user_id_idx").on(t.userId),
  index("carry_realizations_position_id_idx").on(t.carryPositionId),
]);
