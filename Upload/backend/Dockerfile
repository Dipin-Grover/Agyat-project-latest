FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and git
RUN apk add --no-cache git
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Expose port (Upload service uses 3000)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
