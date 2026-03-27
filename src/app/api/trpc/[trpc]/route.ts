import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { appRouter } from "@/server/trpc/routers";
import { createContext } from "@/server/trpc/context";

// Vercel Hobby plan max is 60s; Pro plan supports up to 300s.
// Set to 60 to match the Hobby ceiling and avoid silent clamping.
export const maxDuration = 60;

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
