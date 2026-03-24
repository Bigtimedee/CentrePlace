import Anthropic from "@anthropic-ai/sdk";

export interface ParsedHolding {
  ticker?: string;
  securityName: string;
  assetClass: "equity" | "bond" | "alt" | "cash";
  securitySubType?: "stock" | "etf" | "mutual_fund" | "money_market" | "treasury" | "corporate_bond" | "muni_bond";
  shares?: number;
  pricePerShare?: number;
  marketValue: number;
  percentOfAccount?: number;
}

export interface ParsedStatement {
  brokerageName?: string;
  statementDate?: string;
  holdings: ParsedHolding[];
}

const SYSTEM_PROMPT = `You are a financial statement parser. Extract all investment holdings from the provided brokerage/investment account statement text. Return a JSON object with this exact shape:
{
  "brokerageName": "string or null",
  "statementDate": "YYYY-MM-DD or null",
  "holdings": [
    {
      "ticker": "string or null",
      "securityName": "string (required)",
      "assetClass": "equity" | "bond" | "alt" | "cash",
      "securitySubType": "stock" | "etf" | "mutual_fund" | "money_market" | "treasury" | "corporate_bond" | "muni_bond" | null,
      "shares": number or null,
      "pricePerShare": number or null,
      "marketValue": number (required, in USD),
      "percentOfAccount": number or null (0-100)
    }
  ]
}

Asset class rules:
- equity: individual stocks, ETFs, equity mutual funds (SPY, QQQ, VTSAX, etc.)
- bond: bonds, bond ETFs/funds, fixed income (BND, AGG, VBTLX, treasuries, etc.)
- alt: REITs, commodities, alternatives, options, crypto
- cash: money market, cash equivalents, stable value funds

Security sub-type rules:
- stock: individual company shares (e.g. AAPL, MSFT, TSLA)
- etf: exchange-traded fund (e.g. SPY, VTI, QQQ, BND, AGG)
- mutual_fund: mutual fund (e.g. VTSAX, FXAIX, SWPPX)
- money_market: money market fund (e.g. SPAXX, VMFXX, FZDXX)
- treasury: US government bonds, T-bills, T-notes, TIPS
- corporate_bond: corporate bonds
- muni_bond: municipal bonds
- Use null if sub-type cannot be determined

Return ONLY the JSON object, no explanation.`;

export async function parseStatementBuffer(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ParsedStatement> {
  let text = "";

  if (mimeType === "application/pdf") {
    // Dynamic import prevents pdf-parse from being bundled at build time,
    // avoiding the DOMMatrix ReferenceError from @napi-rs/canvas
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(fileBuffer);
    text = parsed.text;
  } else {
    // plain text / CSV
    text = fileBuffer.toString("utf-8");
  }

  if (!text.trim()) throw new Error("Could not extract text from the uploaded file.");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse this investment statement and return the JSON:\n\n${text.slice(0, 40000)}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");

  const result = JSON.parse(jsonMatch[0]) as ParsedStatement;
  if (!Array.isArray(result.holdings)) throw new Error("Parse result missing holdings array");

  return result;
}
