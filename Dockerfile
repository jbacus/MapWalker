# Stage 1: Build the React app
FROM node:20-slim as build

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy local code to the container image.
COPY . .

# Build the app.
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:stable-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy the built app from the build stage
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy the nginx config template
COPY nginx.conf /etc/nginx/nginx.conf.template

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start Nginx
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
