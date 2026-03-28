import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/trpc/routers";
import { createContext } from "@/server/trpc/context";

// Pro plan supports up to 300s. 90s gives generous headroom for the
// AI recommendations mutation (enrichment + Claude + DB writes).
export const maxDuration = 90;

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      console.error(`tRPC error on ${path ?? "<no-path>"}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
