FROM node:20-bookworm-slim
WORKDIR /app
# better-sqlite3 is a native Node module; keep a compiler available as a fallback
# when npm cannot use a prebuilt binary for the deployment architecture.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
