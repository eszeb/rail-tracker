# 1) Build the React app
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY .env.production /app/.env.production
RUN npm run build

# 2) Build the Rust binary
FROM rust:1-slim-bookworm AS backend
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/ ./
RUN cargo build --release

# 3) Small runtime image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /app/backend/target/release/backend /app/backend
COPY --from=frontend /app/frontend/dist /app/static
ENV STATIC_DIR=/app/static
CMD ["/app/backend"]