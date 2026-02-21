# Use the latest stable Node version
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files first (better for caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of your code (src folder, instructions.js, etc.)
COPY . .

# Coach Frank doesn't need an open port, but we'll set the entry point
CMD [ "node", "src/index.js" ]