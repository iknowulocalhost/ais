# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---------- development ----------
FROM base AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- build ----------
FROM base AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

# ---------- production ----------
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
