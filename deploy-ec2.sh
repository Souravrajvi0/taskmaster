#!/bin/bash

# TaskMaster EC2 Deployment Script
# This script automates the deployment of TaskMaster on an EC2 instance

set -e  # Exit on error

echo "=========================================="
echo "TaskMaster EC2 Deployment Script"
echo "=========================================="

# Update system packages
echo "Step 1: Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Docker
echo "Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Install Docker dependencies
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed successfully!"
else
    echo "Docker is already installed."
fi

# Verify Docker installation
echo "Step 3: Verifying Docker installation..."
sudo docker --version
sudo docker compose version

# Install Node.js (for frontend development)
echo "Step 4: Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js installed successfully!"
else
    echo "Node.js is already installed."
fi

node --version
npm --version

# Install Git (if not already installed)
echo "Step 5: Installing Git..."
if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
    echo "Git installed successfully!"
else
    echo "Git is already installed."
fi

# Create application directory
echo "Step 6: Setting up application directory..."
APP_DIR="/home/ubuntu/taskmaster"
mkdir -p $APP_DIR

echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Upload your TaskMaster application files to: $APP_DIR"
echo "2. Navigate to the directory: cd $APP_DIR"
echo "3. Start the backend services:"
echo "   sudo docker compose -f docker-compose-node.yml up --build --scale worker=3 -d"
echo "4. Install frontend dependencies:"
echo "   cd client && npm install"
echo "5. Build frontend for production:"
echo "   npm run build"
echo "6. Serve frontend with a web server (nginx or serve)"
echo ""
echo "=========================================="
