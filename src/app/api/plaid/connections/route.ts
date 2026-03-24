import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { plaidConnections } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { plaidClient } from "@/lib/plaid";

export const runtime = "nodejs";

// GET /api/plaid/connections — list all connections for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: plaidConnections.id,
      institutionName: plaidConnections.institutionName,
      lastSyncedAt: plaidConnections.lastSyncedAt,
      createdAt: plaidConnections.createdAt,
      syncMode: plaidConnections.syncMode,
    })
    .from(plaidConnections)
    .where(eq(plaidConnections.userId, userId));

  return NextResponse.json({ connections: rows });
}

// DELETE /api/plaid/connections?id=xxx — remove a connection
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Fetch access token to call Plaid item/remove
  const [row] = await db
    .select({ accessToken: plaidConnections.accessToken })
    .from(plaidConnections)
    .where(and(eq(plaidConnections.id, id), eq(plaidConnections.userId, userId)));

  if (!row) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    await plaidClient.itemRemove({ access_token: row.accessToken });
  } catch {
    // Continue even if Plaid removal fails — delete from DB regardless
  }

  await db
    .delete(plaidConnections)
    .where(and(eq(plaidConnections.id, id), eq(plaidConnections.userId, userId)));

  return NextResponse.json({ ok: true });
}
