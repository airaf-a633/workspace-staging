# Worker image for Fly.io. Built from the repository root:
#   fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter @app/worker...

COPY apps/worker apps/worker
COPY packages/domain packages/domain

ENV NODE_ENV=production
WORKDIR /repo/apps/worker
CMD ["pnpm", "start"]
