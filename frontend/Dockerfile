# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["npx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
