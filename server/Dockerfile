FROM node:22-alpine AS builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci && ln -s /app/server/node_modules /app/node_modules
COPY server/ ./
COPY shared/ /app/shared/
RUN npm run build

# Build admin SPA (outputs to /app/server/public/admin via vite outDir)
WORKDIR /app/admin
COPY admin/package*.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/public ./public
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
