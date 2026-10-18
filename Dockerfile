# Puppeteer-maintained base image with all deps
FROM ghcr.io/puppeteer/puppeteer:latest

# App directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    LOG_FILE=/app/logs/app.log \
    PORT=3000 \
    COOKIES_DIR=/app/data/cookies

# Prepare data/log/media directories
RUN mkdir -p /app/media /app/data/cookies /app/logs && chown -R pptruser:pptruser /app

# Non-root user provided by the base image
USER pptruser

EXPOSE 3000

# Install curl for healthcheck
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
USER pptruser

# Volumes for media, cookies, and logs
VOLUME ["/app/media", "/app/data/cookies", "/app/logs"]

# Healthcheck against API
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:${PORT:-3000}/health || exit 1

# Run migrations then start API server
CMD ["sh", "-lc", "node scripts/migrate.js && node api/server.js"]
