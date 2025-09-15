# Use official Node.js LTS
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
CMD ["npm","start"]
