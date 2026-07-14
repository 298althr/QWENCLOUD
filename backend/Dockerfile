# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Docker CLI and Compose plugin (needed for container management and stack deployment)
RUN apk add --no-cache docker-cli docker-cli-compose git

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
