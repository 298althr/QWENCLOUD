# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG NEXT_PUBLIC_API_BASE=http://localhost:3000/api
ARG NEXT_PUBLIC_WS_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://backend:3000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV DISABLE_PWA=true
RUN npm run build

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["npx", "next", "start", "-p", "3001", "-H", "0.0.0.0"]
