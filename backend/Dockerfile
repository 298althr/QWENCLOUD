# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI, Compose plugin, git, and bash (needed for versioning/rollback scripts)
RUN apk add --no-cache docker-cli docker-cli-compose git bash procps

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
