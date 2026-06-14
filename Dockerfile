# ---- Base stage ----
FROM node:24-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# ---- Development stage ----
FROM base AS development
EXPOSE 3333
CMD ["sh", "-c", "node ace migration:run && node ace serve --watch"]

# ---- Build stage ----
FROM base AS build
RUN node ace build --ignore-ts-errors

# ---- Production runtime (Cloud Run deploys this stage) ----
FROM node:24-slim AS production
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run injects PORT (default 8080); Adonis reads PORT from env at runtime.
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./
EXPOSE 8080
CMD ["node", "bin/server.js"]