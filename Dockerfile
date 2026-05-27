# ---- Base stage (dependencies + source) ----
FROM node:24-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# ---- Development stage ----
FROM base AS development
EXPOSE 3333
CMD ["sh", "-c", "node ace migration:run && node ace serve --watch"]

# ---- Build stage (production compile) ----
#FROM node:24-slim AS build
#WORKDIR /app
#COPY package*.json ./
#RUN npm ci
#COPY . .
#RUN node ace build --ignore-ts-errors
#
## ---- Production runtime ----
#FROM node:24-slim AS production
#WORKDIR /app
#ENV NODE_ENV=production
#COPY package*.json ./
#RUN npm ci --omit=dev
#COPY --from=build /app/build ./
#
#EXPOSE 3333
#CMD ["node", "bin/server.js"]
