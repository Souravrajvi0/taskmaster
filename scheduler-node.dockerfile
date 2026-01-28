# Use official Node.js runtime as parent image
FROM node:20-alpine

# Install Docker CLI and Docker Compose for worker scaling
RUN apk add --no-cache docker-cli docker-cli-compose

# Set the working directory in the container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the application files
COPY pkg/ ./pkg/
COPY cmd/scheduler/main.js ./cmd/scheduler/

# Run the scheduler when the container launches
CMD ["node", "cmd/scheduler/main.js"]
