FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json
COPY package*.json ./

# Copy server package files
COPY server/package*.json ./server/

# Copy client package files
COPY client/package*.json ./client/

# Install all dependencies
RUN npm install --prefix server --production
RUN npm install --prefix client

# Copy application files
COPY server ./server
COPY client ./client

# Build client
RUN npm run build --prefix client

# Expose ports
EXPOSE 3000

# Start server
CMD ["node", "server/server.js"]

