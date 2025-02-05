FROM node:18-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create media directory
RUN mkdir -p media/live

# Expose ports
EXPOSE 1935
EXPOSE 8001

# Set environment variables
ENV NODE_ENV=production
ENV RTMP_PORT=1935
ENV HTTP_PORT=8001
ENV MEDIA_ROOT=/usr/src/app/media

# Start the server
CMD ["npm", "start"] 