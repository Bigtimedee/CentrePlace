# CLAUDE.md — CentrePlace (GPretire.com)

This file provides context for AI assistants working on this codebase.

## Project Overview

CentrePlace is a full-stack financial independence planning application for GP/LP investors, deployed as **GPretire.com**. It models 40-year financial projections with comprehensive tax simulation, Monte Carlo analysis, carry position tracking, and estate planning.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| React | React 19 |
| API | tRPC 11 with React Query 5 |
| Database | PostgreSQL via Drizzle ORM 0.45 |
| Auth | Clerk 6 |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Validation | Zod 4 |
| Testing | Vitest 4 |
| Serialization | SuperJSON |

## Directory Structure

```
src/
├── app/
│   ├── (auth)/          # sign-in, sign-up, forgot-password, reset-password, invite-only
│   ├── (dashboard)/     # 14 feature pages: dashboard, profile, income, carry, lp-investments,
│   │                    # portfolios, real-estate, insurance, expenditures, scenarios,
│   │                    # forecast, tax, estate, cashflow, plan
│   ├── (admin)/         # admin user management panel
│   ├── api/
│   │   ├── trpc/        # tRPC HTTP handler
│   │   └── ...          # admin, Clerk webhook endpoints
│   ├── page.tsx         # marketing homepage (unauthenticated)
│   └── layout.tsx       # root layout with Clerk + tRPC providers
├── components/
│   ├── ui/              # primitives: button, input, card, select, toggle, form-field, info-modal
│   ├── layout/          # sidebar, page-header, next-section-banner
│   ├── dashboard/       # simulation dashboard, annual summaries, capital projections
│   ├── forecast/        # Monte Carlo charts, FI probability visualizations
│   ├── scenarios/       # scenario comparison metrics and FI breakdown
│   ├── tax/             # tax timelines, bracket heatmaps, Roth conversion ladders
│   ├── cashflow/        # LP distribution tables, liquidity waterfall, cash event timelines
│   ├── plan/            # action items and planning cards
│   ├── forms/           # profile, realization policy, withdrawal plan forms
│   └── admin/           # user management table, invite forms
├── lib/
│   ├── utils.ts         # cn() class merger, currency/percentage formatters
│   ├── constants.ts     # US states, quarters, expenditure categories
│   ├── trpc.ts          # tRPC client (client-side)
│   └── trpc-provider.tsx # React Query + tRPC provider
├── server/
│   ├── db/
│   │   ├── schema/      # one file per domain (users, income, carry, portfolios, etc.)
│   │   │   └── index.ts # re-exports all schema + relations
│   │   └── index.ts     # Drizzle client (pooled PostgreSQL)
│   ├── simulation/
│   │   ├── assembler.ts          # fetches all DB data → SimulationInput
│   │   └── engine/
│   │       ├── quarterly-engine.ts     # main 160-quarter loop (~670 lines)
│   │       ├── fi-calculator.ts        # permanent income, safe spending, years-to-FI
│   │       ├── withdrawal-optimizer.ts # tax-optimized withdrawal sequencing
│   │       ├── monte-carlo.ts          # stochastic market simulations
│   │       ├── types.ts                # SimulationInput, SimulationResult types
│   │       └── scenario-types.ts       # scenario overrides and comparison types
│   ├── simulation/tax/
│   │   ├── federal-income.ts    # brackets, LTCG rates, NIIT (3.8%)
│   │   ├── state-income.ts      # all 50 states + DC
│   │   ├── city-income.ts       # NYC, Philadelphia, etc.
│   │   ├── payroll-tax.ts       # FICA, SS, Medicare, Additional Medicare Tax
│   │   ├── estate-tax.ts        # federal + state estate taxes
│   │   └── rmd.ts               # Required Minimum Distributions
│   ├── simulation/estate/       # estate calculator + recommendations
│   ├── simulation/cashflow/     # LP distribution + cash event management
│   ├── simulation/plan/         # action plan generation
│   └── trpc/
│       ├── index.ts             # tRPC instance, protectedProcedure
│       ├── context.ts           # Clerk auth + DB connection
│       └── routers/             # 15 feature routers (one per domain)
└── proxy.ts                     # Clerk auth middleware, invite-only enforcement
drizzle/migrations/              # auto-generated migration files (do not edit manually)
```

## Development Commands

```bash
npm run dev          # start local dev server (http://localhost:3000)
npm run build        # production build
npm run lint         # run ESLint
npm run test         # run Vitest tests once
npm run test:watch   # run Vitest in watch mode

# Database
npm run db:generate  # generate migration files from schema changes
npm run db:migrate   # apply pending migrations
npm run db:push      # push schema directly (dev only, skips migrations)
npm run db:studio    # open Drizzle Studio UI
```

## Environment Variables

Create `.env.local` (git-ignored). Required variables:

```
DATABASE_URL=          # PostgreSQL connection string (direct)
DATABASE_URL_POOLED=   # Pooled connection via Supabase Supavisor (optional, falls back to DATABASE_URL)
# Clerk environment variables are injected automatically by @clerk/nextjs
```

The database uses **transaction-mode pooling** — Drizzle is configured with `prepare: false` to support Supabase Supavisor.

## Architecture Patterns

### tRPC API

- All API calls go through tRPC at `/api/trpc`
- 15 feature routers, each in `src/server/trpc/routers/`
- All dashboard procedures use `protectedProcedure` (requires Clerk session)
- Public routes: sign-in, sign-up, invite pages, API webhook endpoints
- SuperJSON transformer handles Date, Map, Set, BigInt serialization
- React Query stale time: 30 seconds

### Simulation Engine

The core simulation runs `assembleSimInput()` → `runQuarterlySimulation()`:

1. **Assembly** (`assembler.ts`): queries all user tables, builds a flat `SimulationInput` object
2. **Quarterly engine** (`quarterly-engine.ts`): 160-quarter (40-year) loop processing income, taxes, spending, withdrawals, portfolio growth
3. **Tax modules**: called each quarter with current income and account state
4. **FI calculator**: computes years-to-FI, safe spending rate, permanent income from simulation output
5. **Monte Carlo**: runs many stochastic variants on the client side to avoid API timeouts

The quarterly engine is the most complex file. Changes here require running the full test suite.

### Withdrawal Sequencing

Priority order for tax-optimized withdrawals:
1. PPLI (Private Placement Life Insurance)
2. Whole Life cash value
3. Roth accounts
4. Taxable accounts
5. Traditional (pre-tax) accounts

### Database Schema

Each domain has its own schema file under `src/server/db/schema/`. All tables:
- Use snake_case column names
- Cascade-delete when the parent user is deleted
- Have `created_at` / `updated_at` timestamps
- Are re-exported from `schema/index.ts`

After modifying any schema file: run `npm run db:generate` then `npm run db:migrate`.

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| DB tables | snake_case | `carry_positions` |
| DB columns | snake_case | `haircut_pct` |
| Sim types | PascalCase with `Sim` prefix | `SimProfile`, `SimCarryPosition` |
| Component files | kebab-case | `fi-summary-card.tsx` |
| Component exports | PascalCase | `FISummaryCard` |
| tRPC routers | camelCase noun | `profileRouter`, `simulationRouter` |
| Utility functions | camelCase | `cn()`, `formatCurrency()` |

## Testing

Tests live in `__tests__/` directories co-located with the source they test.

Coverage areas:
- `engine/__tests__/` — quarterly simulation, withdrawal optimizer, scenario overrides, FI calculator
- `tax/__tests__/` — federal, state, estate, combined tax calculations
- `estate/__tests__/` — estate valuations and planning recommendations

Run all tests before committing changes to the simulation engine or tax modules. These are the most financially critical paths.

```bash
npm run test
```

## Key Conventions to Follow

1. **Never edit files in `drizzle/migrations/`** — these are auto-generated by drizzle-kit.
2. **Use `cn()` from `src/lib/utils.ts`** for all Tailwind class merging — never concatenate class strings directly.
3. **Add new API endpoints as tRPC procedures**, not Next.js Route Handlers, unless dealing with webhooks or file uploads.
4. **Zod validation is required** on all tRPC mutation inputs.
5. **Tax modules must have tests** — any change to `src/server/simulation/tax/` needs a corresponding test update.
6. **Keep the assembler decoupled** — `assembler.ts` fetches data; the engine only receives `SimulationInput`. Do not add DB queries inside the engine.
7. **Simulation-heavy routes have a 30-second max duration** — keep server-side simulation bounded; Monte Carlo runs client-side.
8. **Tailwind CSS 4** is in use — do not import from `tailwindcss` directly; use `@tailwindcss/postcss`.
9. **Path alias `@/*` maps to `src/`** — always use this for imports, never relative `../../../`.
10. **Clerk handles all auth** — never build custom session logic; use `auth()` from `@clerk/nextjs/server` in server components and route handlers.

## Authentication Flow

- Unauthenticated users see the marketing homepage (`/`)
- Sign-up is invite-only — users must have a valid invite ticket cookie
- `src/proxy.ts` is the Clerk middleware that enforces route protection and validates invite tickets
- Admin panel at `/(admin)/` is restricted by Clerk role claims

## Deployment

The app is designed for **Vercel**. No special CI/CD is configured — deployment happens via Vercel's git integration on the `master` branch.
