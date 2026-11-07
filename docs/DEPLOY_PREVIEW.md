# Hosting the partner preview on Vercel

The hosted preview shows the website, `/demo` and `/preview` (the app with sample data) behind one shared password. Sign-in, sign-up, the real app (`/w/…`, `/app`) and webhooks are switched off on it, so nothing touches the staging database. Every page is marked noindex. Decided 2026-10-01.

How it works: with `SITE_MODE=preview`, `apps/web/src/proxy.ts` sends every visitor to `/unlock` until they enter `PREVIEW_PASSWORD`. A cookie then holds a hash of the password (not the password) for 30 days.

## One-time setup (about 10 minutes)

1. Sign in at vercel.com with the GitHub account that can see `airaf-a633/workspace-staging`.
2. **Add New → Project → Import** the `workspace-staging` repository.
3. On the configure screen:
   - **Root Directory:** `apps/web`. Leave "Include files outside the root directory" on; the app uses `packages/domain`.
   - **Framework Preset:** Next.js (detected).
   - **Build and install commands:** leave the defaults. Vercel finds pnpm from the lockfile and installs from the repo root.
   - **Node.js version:** 22.x or newer (Settings → General, after import).
4. **Environment Variables** (for Production and Preview):

   | Name | Value |
   |---|---|
   | `SITE_MODE` | `preview` |
   | `PREVIEW_PASSWORD` | a password you choose. Share it with your partner privately, not in the same message as the link. |

   Don't add the Supabase keys or any other secret. The preview doesn't need them.
5. Click **Deploy**.
6. **Settings → Environments → Production → Branch Tracking:** set it to `ui/design-foundations` until that work is merged into `main`, then redeploy. After the merge, change it back to `main`. (This setting used to be under Settings → Git.)
7. Optional: **Settings → Functions → Region:** Frankfurt (`fra1`), the same region as the database we'll use later.

The address is `https://<project-name>.vercel.app`. Every push to the production branch redeploys it automatically.

## Day to day

- **Change the password:** edit `PREVIEW_PASSWORD`, then **Redeploy**. Everyone has to enter the new one.
- **Close the preview:** remove `PREVIEW_PASSWORD`. The site then answers "not configured" instead of opening.
- **Test locally the way Vercel runs it:** run `pnpm --filter @app/web build`, then start the `web-preview-mode` launch entry (port 3100, local test password in `scripts/start-preview-mode.mjs`).

## Don't

- Don't set `SITE_MODE` on a deployment that should run the real app.
- Don't add `SUPABASE_SERVICE_ROLE_KEY` to this Vercel project.
