# Workspace (working name)

A WhatsApp-first business workspace for UAE small businesses. It brings WhatsApp, email, calendar, the store and a built-in CRM into one place, with a separate workspace for each manager.

- Product rules: [docs/PRODUCT_DECISIONS.md](docs/PRODUCT_DECISIONS.md)
- Build order: [docs/MILESTONES.md](docs/MILESTONES.md)
- Architecture: [docs/ENGINEERING_PLAN.md](docs/ENGINEERING_PLAN.md)
- Design system: [design-system/MASTER.md](design-system/MASTER.md)

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 16: the app, API routes (webhooks), marketing site. Deployed to Vercel (fra1). |
| `apps/worker` | Node queue consumer (webhooks, sends, media, sync). Deployed to Fly.io (fra). |
| `packages/domain` | Pure business rules: money in fils, phone numbers, Dubai business dates, order state machine |
| `supabase` | Migrations, seed data, pgTAP permission tests |

## First-time setup

Needs Node 22+, pnpm 10 and Docker Desktop.

```bash
pnpm install
pnpm db:start
cp .env.example .env
pnpm dev
```

- `pnpm db:start` prints the local API URL, anon key and service role key. Put them in `.env`.
- `pnpm dev` runs the app on http://localhost:3000.

## Everyday commands

| Command | Does |
|---|---|
| `pnpm test` | Unit tests |
| `pnpm typecheck` | Type checks every package |
| `pnpm lint` | Lint |
| `pnpm db:test` | Database and permission tests (pgTAP) |
| `pnpm db:reset` | Rebuild the local database from migrations and seed |
| `pnpm db:stop` | Stop local Supabase |

CI runs all of these on every pull request.
