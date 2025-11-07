# Use the official Node.js 20 image.
FROM node:20-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this first prevents re-running npm install on every code change.
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy local code to the container image.
COPY . .

# Build TypeScript to JavaScript
RUN npx tsc

# Remove dev dependencies
RUN npm prune --production

# Run the web service on container startup.
CMD ["node", "dist/index.js"]
