import { pgTable, text, uuid, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";

export const researchTraces = pgTable("research_traces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  answer: text("answer"),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed
  iterations: integer("iterations").default(0),
  toolCalls: jsonb("tool_calls").notNull().default([]), // TraceEntry[]
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("research_traces_user_id_idx").on(t.userId),
  index("research_traces_status_idx").on(t.status),
  index("research_traces_created_at_idx").on(t.createdAt),
]);
