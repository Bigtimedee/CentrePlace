import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { accountStatements, accountHoldings } from "@/server/db/schema";
import { uploadStatementFile } from "@/lib/supabase-storage";
import { parseStatementBuffer } from "@/server/statements/parse-statement";

export const runtime = "nodejs";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
];

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const accountId = formData.get("accountId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Only PDF, TXT, and CSV files are supported" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Supabase Storage
  const storagePath = await uploadStatementFile(userId, file.name, buffer, mimeType);

  // Parse with Claude
  const parsed = await parseStatementBuffer(buffer, mimeType);

  // Save statement record
  const [statement] = await db
    .insert(accountStatements)
    .values({
      userId,
      accountId: accountId || null,
      fileName: file.name,
      storagePath,
      parsedAt: new Date(),
      statementDate: parsed.statementDate ?? null,
      brokerageName: parsed.brokerageName ?? null,
      rawParseOutput: parsed as unknown as Record<string, unknown>,
    })
    .returning();

  // Save holdings
  let savedHoldings: { id: string; ticker: string | null; securityName: string; assetClass: string; shares: number | null; pricePerShare: number | null; marketValue: number; percentOfAccount: number | null }[] = [];
  if (parsed.holdings.length > 0) {
    savedHoldings = await db.insert(accountHoldings).values(
      parsed.holdings.map((h) => ({
        statementId: statement.id,
        userId,
        accountId: accountId || null,
        ticker: h.ticker?.toUpperCase() ?? null,
        securityName: h.securityName,
        assetClass: h.assetClass,
        securitySubType: h.securitySubType ?? null,
        shares: h.shares ?? null,
        pricePerShare: h.pricePerShare ?? null,
        marketValue: h.marketValue,
        percentOfAccount: h.percentOfAccount ?? null,
      }))
    ).returning();
  }

  return NextResponse.json({
    statementId: statement.id,
    brokerageName: parsed.brokerageName,
    statementDate: parsed.statementDate,
    holdingCount: parsed.holdings.length,
    holdings: savedHoldings,
  });
}
