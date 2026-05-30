FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @smart-supermarket/api prisma generate
RUN pnpm --filter @smart-supermarket/api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY --from=build /app /app
RUN pnpm --filter @smart-supermarket/api exec prisma generate
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @smart-supermarket/api exec prisma migrate deploy && pnpm --filter @smart-supermarket/api start"]
