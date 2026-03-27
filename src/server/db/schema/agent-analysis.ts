import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const agentAnalysisJobs = pgTable("agent_analysis_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  // "pending" → "running" → "completed" | "failed"
  status: text("status").notNull().default("pending"),
  tickers: jsonb("tickers").notNull().default([]),       // string[]
  results: jsonb("results"),                             // { [ticker]: { tradingAgents, finRobot } }
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("agent_analysis_jobs_user_id_idx").on(t.userId),
  index("agent_analysis_jobs_status_idx").on(t.status),
]);
