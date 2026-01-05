# Use Node.js 20 (Debian-based for better Prisma compatibility)
FROM node:20-slim

# Install build dependencies and OpenSSL (required for Prisma)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production=false

# Copy source code (needed for Prisma schema validation)
COPY . .

# Generate Prisma Client (after copying all files to ensure schema is available)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port (Railway will set PORT env var)
EXPOSE ${PORT:-3001}

# Health check (uses PORT env var, defaults to 3001)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3001; require('http').get(`http://localhost:${port}/health`, (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start server
# Use db push first (simpler, more reliable for initial setup)
# Then try migrate deploy as fallback
CMD ["sh", "-c", "echo 'Setting up database...' && npx prisma db push --accept-data-loss && echo 'Database schema synced!' && npm start"]

