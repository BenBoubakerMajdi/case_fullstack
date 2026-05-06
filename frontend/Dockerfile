# =============================================================================
# Matr — Frontend Dockerfile
# =============================================================================
# Multi-stage build:
#   Stage 1 (build): installs Node deps and builds the Vite app
#   Stage 2 (runtime): serves the static build with nginx

FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
# npm install only reruns when package.json or package-lock.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# =============================================================================
FROM nginx:alpine AS runtime

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Custom nginx config — proxies /api requests to the backend
# so the frontend and backend can run on different ports without CORS issues
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]