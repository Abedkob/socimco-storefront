# SOCIMCO storefront as ONE Node server.
#
# While the built-in demo backend is used (NEXT_PUBLIC_API_BASE_URL empty), run exactly ONE instance:
# the demo keeps sessions, carts, quotes and orders in this process's memory, so several instances
# (or serverless functions) would each have their own data. Data resets when the container restarts.
# Once the real API is connected, the storefront holds no data and any number of instances is fine.
#
#   docker build -t socimco-storefront .
#   docker run -p 3000:3000 socimco-storefront
#
# NEXT_PUBLIC_* settings are compiled in at build time: pass them as build args, e.g.
#   docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.socimco.example -t socimco-storefront .

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_API_ADAPTER="contract"
ARG NEXT_PUBLIC_API_AUTH="cookie"
ARG NEXT_PUBLIC_API_TIMEOUT_MS="15000"
ARG NEXT_PUBLIC_QR_LOGIN="on"
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_API_ADAPTER=$NEXT_PUBLIC_API_ADAPTER \
    NEXT_PUBLIC_API_AUTH=$NEXT_PUBLIC_API_AUTH \
    NEXT_PUBLIC_API_TIMEOUT_MS=$NEXT_PUBLIC_API_TIMEOUT_MS \
    NEXT_PUBLIC_QR_LOGIN=$NEXT_PUBLIC_QR_LOGIN \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["node", "server.js"]
