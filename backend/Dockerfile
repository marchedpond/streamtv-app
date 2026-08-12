FROM node:20-alpine

# Install ffmpeg and clean caches
RUN apk update && \
    apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
