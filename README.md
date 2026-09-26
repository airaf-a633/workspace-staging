# Order Desk

WhatsApp order desk for UAE businesses that deliver with their own riders: chat → order → rider → cash.

- Plan: [docs/ENGINEERING_PLAN.md](docs/ENGINEERING_PLAN.md)
- Design system: [design-system/MASTER.md](design-system/MASTER.md)
- Research: [research/01-rnd-findings.md](research/01-rnd-findings.md)

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 16: dashboard, rider page, marketing site, API routes (webhooks) |
| `apps/worker` | Node queue consumer (webhooks, outbound sends, media) |
| `packages/domain` | Pure business logic: money (fils), order state machine, phone numbers, business dates |
| `supabase` | Migrations, seed, RLS tests |

## Commands

```bash
pnpm install
pnpm test        # unit tests
pnpm typecheck
pnpm dev         # web app on http://localhost:3000
```

Local Supabase (`npx supabase start`) needs Docker Desktop. Until it's installed, point `.env` at the hosted dev project.
