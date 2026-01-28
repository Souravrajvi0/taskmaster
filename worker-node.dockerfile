# Use official Node.js runtime as parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the application files
COPY pkg/ ./pkg/
COPY cmd/worker/main.js ./cmd/worker/

# Run the worker when the container launches
CMD ["node", "cmd/worker/main.js"]
