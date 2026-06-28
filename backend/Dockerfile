# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI (needed for /api/docker/containers and docker_build tool)
RUN apk add --no-cache docker-cli

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
