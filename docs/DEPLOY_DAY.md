# Deploy day: the exact order

*Written 4 November 2026 for 6 and 7 November, or whenever staging is back. Nothing here has been run: staging is paused and there is no Docker on the development machine. Every command prints what it will do before it changes anything unless it says otherwise. If a step fails, stop and send me the full output of that step (never your keys).*

## 0. Decide before you start: one Supabase project or two

The seed in `supabase/seed.sql` creates test people with a **known password** (`khalid@qamar.test`, `hana@qamar.test` and others, password `Password1234`) and a test business. The live browser suite signs in as them. Staging already has them.

- **Recommended: two projects.** `workspace-staging` stays for testing, with the seed people. A second, clean project (for example `relay-pilot`, on the Pro plan) is the one pilots use. Nothing with a known password ever sits next to real customers' messages. Cost: a second project.
- **Alternative: pilots on staging.** You would first delete every `@qamar.test` and `@noor.test` account and their workspaces, and the live suite could no longer be run there. I would not recommend it.

Everything below says "the database" for whichever one you are working on. Do steps 1 to 6 on **staging first** (it is where the tests run), then repeat steps 1, 3, 4, 5 and 8 on the pilot project.

## 1. Get ready (you, about 20 minutes)

- [ ] Project awake (Supabase dashboard: Restore if paused). Put it on Pro for the pilot project.
- [ ] `.env` on your machine has: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` (same as the first), `SUPABASE_DB_URL` (Dashboard › Connect › Session pooler, with the database password). Full list: [ENVIRONMENT.md](ENVIRONMENT.md).
- [ ] If the plan has backups, take one now (Dashboard › Database › Backups). I have not checked what each plan includes. Migrations here have no "undo"; the only way back is a backup.

## 2. Apply the migrations (me, with you running the commands; about 15 minutes)

```bash
node scripts/db-apply-remote.mjs
```

This only reads and prints the list. Check it:

- If it lists migrations from the start of the project (`20260927...`), the database was set up before migrations were recorded. Then run `node scripts/db-apply-remote.mjs --from 20261019`. (My notes say staging is missing everything from about `20261019000001` on, but they disagree with each other about exactly where it stops, so trust the dry run. A brand-new pilot project needs all of them: run it with no `--from`.)
- The list should end with `20261108000002_review_fixes.sql`.

Then apply (about 25 files on staging, one transaction each, oldest first):

```bash
node scripts/db-apply-remote.mjs --from 20261019 --yes
```

It stops at the first file that fails and applies nothing after it. If the first file fails with "already exists", that migration is already on the database: run it again with `--from` set to the next file's version. Any other error: send it to me and do not retry by hand.

## 3. Test the database (about 5 minutes)

```bash
pnpm db:test:staging
```

Runs every test file inside a transaction that is rolled back. **All 32 files must say ALL PASSED.** Run this on staging only: it needs the seed people. On the clean pilot project, skip it and do steps 4 and 8.

## 4. Supabase settings (you, 15 minutes)

- Authentication › URL Configuration: Site URL = the app's address; add `https://YOUR-APP/auth/callback` to Redirect URLs.
- Authentication › Emails › SMTP settings: Postmark SMTP details. **Without this, nobody but your own Supabase team gets a sign-up or sign-in email.**
- Authentication › Sign In / Providers: email on, "Confirm email" on.
- SQL editor, check the invite gate is on: `select value from public.app_settings where key = 'invite_only';` must say `on`. (The seed switches it off on a database built with `db:reset`; migrations alone leave it on.)

## 5. Deploy the web app (you, 20 minutes)

1. Vercel project for the app: root directory `apps/web`, environment variables from [ENVIRONMENT.md](ENVIRONMENT.md), branch tracking `ui/design-foundations` (until merged). **Do not set `SITE_MODE` or `PREVIEW_PASSWORD`.**
2. Deploy. Then open `/pricing`, `/sign-up`, `/sign-in` and check each loads.
3. Check the address is right: on `/sign-up`, a bad invite code must give the message "That invite code doesn't work", not an error page. (An error page here means `NEXT_PUBLIC_SITE_URL` is missing.)

## 6. Deploy the worker (you, 30 minutes, me beside you)

Follow [DEPLOY_WORKER.md](DEPLOY_WORKER.md), steps 1 to 5. The image has never been built: if `fly deploy` fails in the build, send me the error first. When it works:

```bash
fly status
fly scale show        # must say worker 1 and gateway 1
fly logs              # "worker started against <your Supabase host>" and "gateway started against ..."
```

## 7. Run the real browser tests (me; about 20 minutes plus fixing)

Fastest route, from your machine against staging (needs the worker running, on Fly or `pnpm worker`):

```bash
E2E_LIVE=1 pnpm --filter @app/web e2e:live
```

Against the deployed app instead: add `E2E_BASE_URL=https://YOUR-APP`. The suite signs in as the seed people, so it only runs on staging. It covers inbox access, API, customers, deals and tasks, notifications, Reports, reply targets, the showcase screens, and the Telegram, LINE, SMS, Voice, Slack and website-chat specs. There is no browser test for Discord or for Email yet; those two are covered only by the hand checklists in step 9. **I expect failures the first time: nothing built since 19 October has met a real server.** I fix them one at a time; send me the list.

## 8. Check the invite gate from outside (you; 5 minutes; on the pilot project too)

This talks to Supabase directly with the public key, the way a stranger could. **Both must fail.** Replace the two values from your `.env`:

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"email":"probe1@example.com","password":"a-long-password-123"}'
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"email":"probe2@example.com","password":"a-long-password-123","data":{"invite_code":"1234-5678-ABCD-EF01"}}'
```

You should see an error, not a user. (I have not seen the exact text Supabase returns when a database rule refuses a sign-up; what matters is that no user is created, which you can confirm under Authentication › Users.) If either returns a user, **stop and tell me**: the gate is open. Then make a real code in the SQL editor (`select public.create_pilot_invite('Rehearsal', 1, 7);`) and sign up with it on the website to prove a real person gets in and gets the confirmation email.

## 9. The five channels (you and me; one at a time)

Use the checklists in [FOUNDER_SETUP.md](FOUNDER_SETUP.md) section 7: Website chat and Email first, then Telegram, LINE and Discord. For each: send a message in from the outside, see it in the inbox, reply from the inbox, see the reply arrive. If a step fails, note the screen and send it.

## If something goes wrong

- A migration fails: nothing after it was applied; send me the error and `node scripts/db-apply-remote.mjs` output.
- The worker will not start: `fly logs`, then send me the first error.
- Sign-up emails do not arrive: custom SMTP (step 4) is the cause nine times in ten. Check Postmark's activity page and that the account is approved.
- The app shows an error page right after deploy: Vercel › the deployment › Logs. A line starting "Set NEXT_PUBLIC_SITE_URL" means exactly that.
- Anything that looks like a security problem (the gate open, someone seeing another business's data): stop, tell me, and switch the Vercel project to "paused" until it is understood.
