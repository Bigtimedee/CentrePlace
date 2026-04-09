const FDA_BASE = "https://api.financialdatasets.ai";

function getKey(): string {
  const key = process.env.FINANCIAL_DATASETS_API_KEY;
  if (!key) throw new Error("FINANCIAL_DATASETS_API_KEY not configured");
  return key;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export async function fdaGet(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<unknown> {
  const key = getKey();
  const url = `${FDA_BASE}${path}${buildQueryString(params)}`;
  const res = await fetch(url, {
    headers: { "X-API-KEY": key, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`financialdatasets.ai ${res.status}: ${path} — ${body}`);
  }
  return res.json();
}

export async function fdaPost(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const key = getKey();
  const url = `${FDA_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`financialdatasets.ai POST ${res.status}: ${path} — ${text}`);
  }
  return res.json();
}
