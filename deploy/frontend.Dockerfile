# Production image for the React SPA + Nginx reverse proxy (step 6.3).
FROM node:24-bookworm-slim AS builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund --fetch-retries=6 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY frontend/ ./
RUN npm run build


FROM nginx:1.30.6-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80 443
