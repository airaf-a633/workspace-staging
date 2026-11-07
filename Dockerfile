# The background worker and the Discord Gateway (decided 2026-11-02; docs/DEPLOY_WORKER.md).
# One image runs both: fly.toml starts it with a different command for each process group.
# The web app is not built here: it runs on Vercel.
#
# Not built or run by me: this machine has no Docker. Fly builds it with `fly deploy`; if the build fails, the error is
# the first thing to send back.
FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# The exact pnpm version in package.json ("packageManager").
RUN corepack enable

WORKDIR /app

# Dependencies first, so a code-only change reuses this layer. pnpm checks the lockfile against every package.json
# in the workspace, so all of them are copied even though only the worker's tree is installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/domain/package.json packages/domain/
COPY packages/whatsapp/package.json packages/whatsapp/
# Dev dependencies are needed too: the worker runs its TypeScript through tsx.
RUN pnpm install --frozen-lockfile --filter "@app/worker..."

COPY apps/worker apps/worker
COPY packages packages

ENV NODE_ENV=production
# fly.toml replaces this per process group.
CMD ["pnpm", "--filter", "@app/worker", "start"]
