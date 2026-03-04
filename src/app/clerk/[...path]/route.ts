import { NextRequest, NextResponse } from "next/server";

// Once clerk.gpretire.com SSL cert is provisioned, this is the correct upstream.
const CLERK_FRONTEND_API = "https://clerk.gpretire.com";

// Clerk browser JS is served via Cloudflare's npm CDN proxy.
// Until clerk.gpretire.com SSL is provisioned we redirect to jsDelivr.
const NPM_CDN = "https://cdn.jsdelivr.net/npm";

// Headers that should not be forwarded upstream
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxy(req: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const search = req.nextUrl.search ?? "";

  // /clerk/npm/@clerk/clerk-js@N/dist/... → redirect to jsDelivr
  // This allows the browser JS to load even while the SSL cert is pending.
  if (path.startsWith("npm/")) {
    const cdnPath = path.slice(4); // strip leading "npm/"
    return NextResponse.redirect(`${NPM_CDN}/${cdnPath}${search}`, 302);
  }

  const upstreamUrl = `${CLERK_FRONTEND_API}/${path}${search}`;

  const forwardHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    } as RequestInit);
  } catch (err) {
    console.error("[Clerk proxy] upstream fetch failed:", upstreamUrl, err);
    return new NextResponse(
      JSON.stringify({ error: "clerk_proxy_upstream_error", url: upstreamUrl }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await params);
}
