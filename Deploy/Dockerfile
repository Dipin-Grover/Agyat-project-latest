FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Start the worker
CMD ["node", "dist/index.js"]
