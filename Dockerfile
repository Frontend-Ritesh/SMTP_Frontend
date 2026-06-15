FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Support configuring the API base URL at build time
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

# Build the production assets
RUN npm run build

EXPOSE 7086

# Serve the build using Vite's built-in preview server
CMD ["npx", "vite", "preview", "--host", "--port", "7086"]
