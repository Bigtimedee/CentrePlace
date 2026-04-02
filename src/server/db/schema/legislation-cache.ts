import { pgTable, text, uuid, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const legislationCache = pgTable("legislation_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: text("bill_id").notNull().unique(),
  congress: integer("congress").notNull(),
  billType: text("bill_type").notNull(),
  billNumber: text("bill_number").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  status: text("status").notNull(),
  sponsorName: text("sponsor_name"),
  introducedDate: text("introduced_date"),
  latestAction: text("latest_action"),
  latestActionDate: text("latest_action_date"),
  topicTags: jsonb("topic_tags").notNull().$type<string[]>().default([]),
  url: text("url"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (t) => [
  index("legislation_cache_fetched_at_idx").on(t.fetchedAt),
  index("legislation_cache_bill_id_idx").on(t.billId),
]);
