import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use the pooled connection URL for serverless (Next.js API routes)
const connectionString = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL!;

// Disable prefetch for transaction mode pooling (Supabase Supavisor)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type DB = typeof db;
