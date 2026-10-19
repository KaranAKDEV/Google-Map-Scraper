# Use Microsoft's official Playwright image with all Linux system dependencies & Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set container working directory
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install production and application dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Configure port and production environment
ENV PORT=3000
ENV NODE_ENV=production

# Expose web interface port
EXPOSE 3000

# Launch the interactive Web UI server
CMD ["npm", "start"]
