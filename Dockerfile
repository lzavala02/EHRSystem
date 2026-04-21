# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy all frontend files first
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./
COPY frontend/tsconfig.json ./
COPY frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/.env.production .env.production

# Install dependencies (including dev deps needed for build)
RUN npm ci

# Build the frontend (uses .env.production for environment variables)
RUN npm run build


# Stage 2: Build backend with frontend
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml /app/
COPY ehrsystem /app/ehrsystem

# Copy frontend build from stage 1
COPY --from=frontend-builder /frontend/dist /app/frontend/dist

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "ehrsystem.api:app", "--host", "0.0.0.0", "--port", "8000"]
