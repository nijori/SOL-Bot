# SOL-Bot Dockerfile
# Multi-stage build

# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Development stage (for docker-compose dev environment)
FROM node:18-slim AS development

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code and config files
COPY . .

# Create necessary data directories
RUN mkdir -p data/candles data/orders data/metrics data/optimization logs

# Environment variables
ENV NODE_ENV=development
ENV TZ=UTC

# Command to run the application in development mode
CMD ["npm", "run", "dev"]

# Expose API port
EXPOSE 3000

# Production stage
FROM node:18-slim AS production

# Create app directory
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create a non-root user and group
RUN groupadd -r solbot && useradd -r -g solbot solbot

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create necessary data directories
RUN mkdir -p data/candles data/orders data/metrics data/optimization logs
RUN chown -R solbot:solbot /app

# Switch to non-root user
USER solbot

# Environment variables
ENV NODE_ENV=production
ENV TZ=UTC

# Command to run the application
CMD ["node", "dist/index.js"]

# Expose API port (if needed)
EXPOSE 3000 