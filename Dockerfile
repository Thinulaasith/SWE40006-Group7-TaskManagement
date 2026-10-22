FROM node:24-alpine AS web
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=5000 SERVE_FRONTEND=true
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend/ ./
COPY --from=web --chown=node:node /build/frontend/dist /app/frontend/dist
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
