# syntax=docker/dockerfile:1.6
# Многостадийная сборка: development, build, production.

# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
    && ln -sf python3 /usr/bin/python
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---------- development ----------
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ---------- build ----------
FROM base AS build
COPY . .
RUN npm run build \
    && npm prune --omit=dev

# ---------- production ----------
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
