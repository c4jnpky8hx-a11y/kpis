
# Base image with Node.js
FROM node:20-alpine AS base

# Install Python3 and PIP (Required for Sync Engine)
RUN apk add --no-cache python3 py3-pip

# Install Python Dependencies globally or in a venv
# Copying requirements first to cache
WORKDIR /app
COPY service/requirements.txt ./service/requirements.txt
RUN pip3 install --break-system-packages -r service/requirements.txt

# Rebuild the source code only when needed
# Copy backend service
COPY service ./service
COPY sql ./sql

# Setup Frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Copy Frontend Source
COPY web ./

# Accept Build Args for Env Vars (Optional, usually passed at runtime)
ARG GCP_PROJECT_ID
ENV GCP_PROJECT_ID=${GCP_PROJECT_ID}

# Build Next.js
# Disable type checking for faster builds in this context if needed, but standard build is better
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app/web

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user? (Cloud Run runs as root by default unless specified, 
# for simplicity in this hybrid setup we keep default but strict permissions usually better)
# Keeping simple for now to avoid permission issues with spawning python.

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]
