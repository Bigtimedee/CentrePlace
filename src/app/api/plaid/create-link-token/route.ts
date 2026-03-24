import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "GPRetire",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({
    link_token: response.data.link_token,
    plaid_env: process.env.PLAID_ENV ?? "sandbox",
  });
}
