FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

RUN npm run build

# Expose port (Request service uses 3001)
EXPOSE 3001

# Start the application
CMD ["node", "dist/index.js"]
