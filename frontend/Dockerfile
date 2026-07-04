FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
# Remove lockfile so npm resolves optional platform-specific packages
# correctly for Alpine Linux ARM64 (avoids @rollup/rollup-linux-arm64-musl bug)
RUN rm -f package-lock.json && npm install && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5173

CMD ["npm", "run", "dev"]
