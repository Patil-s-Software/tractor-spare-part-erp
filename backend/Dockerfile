# ============================================================
# Stage 1: Builder
#   - Installs ALL dependencies (including devDeps)
#   - Generates Prisma client
#   - Compiles TypeScript → dist/
# ============================================================
FROM node:20-alpine AS builder

# Install OS packages required for Prisma's native binaries on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy manifest files first so Docker can cache the install layer
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all deps (including devDependencies needed for tsc & prisma)
RUN npm ci

# Generate Prisma Client for the current platform
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src/

RUN npm run build


# ============================================================
# Stage 2: Production Runner
#   - Only production node_modules + compiled dist/
#   - Non-root user for security
# ============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Create a dedicated non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only production deps manifest and reinstall
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + generated client from builder
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma/

# Regenerate Prisma client in runner stage (ensures correct binary targets)
RUN npx prisma generate

# Copy compiled application
COPY --from=builder /app/dist ./dist/

# Switch to non-root user
USER appuser

# Expose the application port (matches PORT env var default)
EXPOSE 5003

# Health check — polls the /health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5003}/health || exit 1

# Run Prisma migrations (or sync schema) then start the server
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/server.js"]
