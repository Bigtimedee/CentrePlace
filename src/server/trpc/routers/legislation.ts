import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { db } from "@/server/db";
import { legislationCache } from "@/server/db/schema/legislation-cache";
import { sql, gt, inArray } from "drizzle-orm";

export interface LegislationBill {
  id: string;
  billId: string;
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  summary: string | null;
  status: string;
  sponsorName: string | null;
  introducedDate: string | null;
  latestAction: string | null;
  latestActionDate: string | null;
  topicTags: string[];
  url: string | null;
  fetchedAt: Date;
}

// Topic tag taxonomy — maps input topic keys to Congress.gov search terms
const TOPIC_QUERIES: Record<string, string> = {
  "qoz": "opportunity zone",
  "tcja": "tax cuts jobs act",
  "estate-tax": "estate tax",
  "capital-gains": "capital gains",
  "niit": "net investment income tax",
  "carried-interest": "carried interest",
  "section-1031": "like-kind exchange",
  "amt": "alternative minimum tax",
  "small-business": "pass-through deduction",
  "bonus-depreciation": "bonus depreciation",
};

const CURRENT_CONGRESS = 119;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchBillsForTopic(
  topic: string,
  apiKey: string
): Promise<Omit<LegislationBill, "id" | "fetchedAt">[]> {
  const query = TOPIC_QUERIES[topic] ?? topic;
  const url = `https://api.congress.gov/v3/bill?congress=${CURRENT_CONGRESS}&query=${encodeURIComponent(query)}&limit=20&api_key=${apiKey}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];

  const data = await res.json() as {
    bills?: Array<{
      number: string;
      type: string;
      title: string;
      latestAction?: { text: string; actionDate: string };
      sponsors?: Array<{ fullName: string }>;
      introducedDate?: string;
      url?: string;
    }>;
  };

  const bills = data.bills ?? [];
  return bills.map((b) => {
    const billType = (b.type ?? "hr").toLowerCase();
    const billNumber = b.number ?? "";
    const billId = `${CURRENT_CONGRESS}-${billType}-${billNumber}`;
    return {
      billId,
      congress: CURRENT_CONGRESS,
      billType,
      billNumber,
      title: b.title ?? "Untitled",
      summary: null,
      status: b.latestAction?.text ? deriveStatus(b.latestAction.text) : "Introduced",
      sponsorName: b.sponsors?.[0]?.fullName ?? null,
      introducedDate: b.introducedDate ?? null,
      latestAction: b.latestAction?.text ?? null,
      latestActionDate: b.latestAction?.actionDate ?? null,
      topicTags: [topic],
      url: b.url ?? `https://www.congress.gov/bill/${CURRENT_CONGRESS}th-congress/${billType === "hr" ? "house-bill" : "senate-bill"}/${billNumber}`,
    };
  });
}

function deriveStatus(actionText: string): string {
  const t = actionText.toLowerCase();
  if (t.includes("became public law") || t.includes("signed by president")) return "Enacted";
  if (t.includes("passed senate") || t.includes("senate passed")) return "Passed Senate";
  if (t.includes("passed house") || t.includes("house passed")) return "Passed House";
  if (t.includes("referred to")) return "Introduced";
  return "In Committee";
}

async function getOrFetchBills(
  topics: string[],
  apiKey: string | undefined
): Promise<{ bills: LegislationBill[]; apiKeyMissing: boolean }> {
  if (!apiKey) return { bills: [], apiKeyMissing: true };

  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const cached = await db
    .select()
    .from(legislationCache)
    .where(gt(legislationCache.fetchedAt, cutoff));

  // Filter cached rows that match at least one requested topic
  const cachedForTopics = cached.filter((row) => {
    const tags = (row.topicTags as string[]) ?? [];
    return topics.some((t) => tags.includes(t));
  });

  if (cachedForTopics.length > 0) {
    return {
      bills: cachedForTopics.map((r) => ({
        ...r,
        topicTags: (r.topicTags as string[]) ?? [],
      })),
      apiKeyMissing: false,
    };
  }

  // Fetch fresh data
  const fetchedArrays = await Promise.all(
    topics.map((topic) => fetchBillsForTopic(topic, apiKey))
  );

  // Deduplicate by billId, merging topicTags
  const byBillId = new Map<string, Omit<LegislationBill, "id" | "fetchedAt">>();
  for (const arr of fetchedArrays) {
    for (const bill of arr) {
      if (byBillId.has(bill.billId)) {
        const existing = byBillId.get(bill.billId)!;
        existing.topicTags = [...new Set([...existing.topicTags, ...bill.topicTags])];
      } else {
        byBillId.set(bill.billId, { ...bill });
      }
    }
  }

  const newBills = Array.from(byBillId.values());
  if (newBills.length === 0) return { bills: [], apiKeyMissing: false };

  // Upsert
  await db
    .insert(legislationCache)
    .values(newBills.map((b) => ({ ...b, topicTags: b.topicTags })))
    .onConflictDoUpdate({
      target: legislationCache.billId,
      set: {
        title: sql`excluded.title`,
        status: sql`excluded.status`,
        latestAction: sql`excluded.latest_action`,
        latestActionDate: sql`excluded.latest_action_date`,
        topicTags: sql`excluded.topic_tags`,
        fetchedAt: sql`now()`,
      },
    });

  // Re-read from DB to get IDs and fetchedAt
  const inserted = await db
    .select()
    .from(legislationCache)
    .where(
      inArray(
        legislationCache.billId,
        newBills.map((b) => b.billId)
      )
    );

  return {
    bills: inserted.map((r) => ({
      ...r,
      topicTags: (r.topicTags as string[]) ?? [],
    })),
    apiKeyMissing: false,
  };
}

export const legislationRouter = createTRPCRouter({
  getPendingTaxBills: protectedProcedure
    .input(z.object({ topics: z.array(z.string()).min(1).max(10) }))
    .query(async ({ input }) => {
      const apiKey = process.env.CONGRESS_API_KEY;
      return getOrFetchBills(input.topics, apiKey);
    }),

  refreshLegislation: protectedProcedure
    .input(z.object({ topics: z.array(z.string()).min(1).max(10) }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.CONGRESS_API_KEY;
      if (!apiKey) return { bills: [], apiKeyMissing: true };

      // Delete stale cache for these topics
      const allCached = await db.select().from(legislationCache);
      const toDelete = allCached
        .filter((r) => {
          const tags = (r.topicTags as string[]) ?? [];
          return input.topics.some((t) => tags.includes(t));
        })
        .map((r) => r.id);

      if (toDelete.length > 0) {
        await db.delete(legislationCache).where(inArray(legislationCache.id, toDelete));
      }

      return getOrFetchBills(input.topics, apiKey);
    }),
});
