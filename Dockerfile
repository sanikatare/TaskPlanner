# Unified Render / Production Dockerfile (Frontend + Backend)
FROM node:20-alpine

WORKDIR /app

# Copy workspace manifests
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN npm install

# Copy application source
COPY frontend ./frontend
COPY backend ./backend

# Enable local/demo auth fallback by default if Firebase is not configured
ENV NODE_ENV=production
ENV ALLOW_DEV_AUTH=true
ENV VITE_ALLOW_DEV_AUTH=true
ENV VITE_USE_MONGO_AUTH=true
ENV PORT=3000

# Create directory for persistent local store fallback
RUN mkdir -p /app/.data /app/backend/.data

# Build React frontend and Express TypeScript backend
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
