FROM node:24-bookworm-slim AS dependencies

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY app.js ./
COPY migrations ./migrations
COPY public ./public
COPY src ./src
COPY storage ./storage

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "app.js"]
