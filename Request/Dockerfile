FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
# RUN npm run build

# Expose port (Request service uses 3001)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
