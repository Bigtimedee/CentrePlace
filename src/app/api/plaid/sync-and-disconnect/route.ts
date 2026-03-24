import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { plaidConnections } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { plaidClient } from "@/lib/plaid";
import type { AccountBase, Transaction } from "plaid";
import {
  extractExpendituresFromTransactions,
  extractAccountsFromPlaid,
} from "@/lib/plaid-extraction";

export const runtime = "nodejs";

// ─── Helper: revoke Plaid item and delete DB row ──────────────────────────────

export async function revokeConnection(
  accessToken: string,
  connectionId: string,
  userId: string,
): Promise<void> {
  try {
    await plaidClient.itemRemove({ access_token: accessToken });
  } catch {
    // Swallow — Plaid removal failure must not block DB cleanup
  }
  try {
    await db
      .delete(plaidConnections)
      .where(and(eq(plaidConnections.id, connectionId), eq(plaidConnections.userId, userId)));
  } catch {
    // Swallow — log in production monitoring
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectionId } = (await req.json()) as { connectionId: string };
  if (!connectionId) {
    return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });
  }

  // Load connection row (need accessToken + institutionName)
  const [conn] = await db
    .select({
      accessToken: plaidConnections.accessToken,
      institutionName: plaidConnections.institutionName,
    })
    .from(plaidConnections)
    .where(and(eq(plaidConnections.id, connectionId), eq(plaidConnections.userId, userId)));

  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  let allTransactions: Transaction[] = [];
  let plaidAccounts: AccountBase[] = [];
  let fetchSucceeded = false;
  let fetchError: unknown = null;

  try {
    // Phase A: Fetch accounts
    const accountsResponse = await plaidClient.accountsGet({ access_token: conn.accessToken });
    plaidAccounts = accountsResponse.data.accounts;

    // Phase B: Fetch transactions via transactionsSync (cursor-based pagination)
    let cursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const syncResponse = await plaidClient.transactionsSync({
        access_token: conn.accessToken,
        cursor,
      });
      const { added, next_cursor, has_more } = syncResponse.data;
      allTransactions = allTransactions.concat(added);
      cursor = next_cursor;
      hasMore = has_more;
    }

    fetchSucceeded = true;
  } catch (err) {
    fetchError = err;
  } finally {
    // Privacy guarantee: revoke always runs, even if fetch threw
    await revokeConnection(conn.accessToken, connectionId, userId);
  }

  if (!fetchSucceeded) {
    return NextResponse.json(
      {
        error: "Failed to fetch data from Plaid",
        revoked: true,
        detail: fetchError instanceof Error ? fetchError.message : "Unknown error",
      },
      { status: 500 },
    );
  }

  // Phase C: Extract structured data (transactions window = 12 months assumed)
  const [expendituresResult, accountsResult] = await Promise.all([
    extractExpendituresFromTransactions(allTransactions, 12, userId, db),
    extractAccountsFromPlaid(plaidAccounts, conn.institutionName, userId, db),
  ]);

  return NextResponse.json({
    ok: true,
    expenditures: expendituresResult,
    accounts: accountsResult,
  });
}
