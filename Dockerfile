FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 3000
CMD ["node", "server.js"]
