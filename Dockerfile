FROM node:24-alpine

WORKDIR /app

COPY app/package*.json ./

RUN npm install --omit=dev

COPY app/ ./

RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    mkdir -p /app/data && \
    chown -R appuser:appgroup /app

USER appuser

ENV PORT=8081

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8081/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]