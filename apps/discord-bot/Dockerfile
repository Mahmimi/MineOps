FROM node:22-alpine AS dependencies
WORKDIR /app/discord-bot
COPY discord-bot/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app/discord-bot
ENV NODE_ENV=production
COPY --from=dependencies /app/discord-bot/node_modules ./node_modules
COPY discord-bot/package*.json ./
COPY discord-bot/src ./src
COPY utils ../utils
USER 1000:1000
EXPOSE 8080
CMD ["node", "src/index.js"]
