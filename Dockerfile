FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN cd server && npm ci --only=production
RUN cd client && npm ci

# Copy application files
COPY server ./server
COPY client ./client

# Build client
RUN cd client && npm run build

# Expose ports
EXPOSE 3000

# Start server
CMD ["node", "server/server.js"]

