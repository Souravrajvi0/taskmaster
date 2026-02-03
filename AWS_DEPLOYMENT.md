# TaskMaster AWS EC2 Deployment Guide

## 🚀 Deployment Overview

TaskMaster is successfully deployed on AWS EC2 and accessible via public IP.

---

## 📍 Server Information

### EC2 Instance Details
- **Instance ID**: `i-0abb38be431026f3f`
- **Public IP**: `13.220.251.240`
- **Private IP**: `172.31.85.105`
- **Instance Type**: 2 vCPUs
- **Region**: `us-east-1b`
- **AMI**: Ubuntu Noble 24.04 (ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20251212)
- **Platform**: Linux/UNIX
- **DNS**: `ec2-13-220-251-240.compute-1.amazonaws.com`

### Security Groups & Ports
| Port | Protocol | Service | Status |
|------|----------|---------|--------|
| 22 | TCP | SSH | ✅ Open |
| 5173 | TCP | React Frontend | ✅ Open |
| 8080 | TCP | Coordinator gRPC | ✅ Open |
| 8081 | TCP | Scheduler HTTP + SSE | ✅ Open |
| 5432 | TCP | PostgreSQL | ✅ Open |

---

## 🔐 SSH Access

### SSH Key Information
- **Key Pair Name**: `taskmaster`
- **Key Location**: `C:\Users\DELL\Downloads\taskmaster.pem`
- **Alternative Key**: `~/.ssh/taskmaster-deploy` (WSL - generated for automation)

### Connect via SSH

#### Method 1: Using Original Key (WSL)
```bash
wsl ssh -i ~/.ssh/taskmaster-deploy ubuntu@13.220.251.240
```

#### Method 2: Using EC2 Instance Connect (Browser)
1. Go to AWS Console → EC2 → Instances
2. Select instance `i-0abb38be431026f3f`
3. Click **Connect** button
4. Choose **EC2 Instance Connect** tab
5. Click **Connect** (opens browser terminal)

---

## 🌐 Application URLs

### Production Access
- **Frontend**: http://13.220.251.240:5173
- **Backend API (Coordinator)**: http://13.220.251.240:8080
- **Scheduler API**: http://13.220.251.240:8081
- **PostgreSQL**: `13.220.251.240:5432`

---

## 📦 Deployed Services

### Backend Services (Docker Compose)
All services run via Docker Compose in `/home/ubuntu/taskmaster/`

| Service | Container Name | Image | Port | Status |
|---------|---------------|-------|------|--------|
| PostgreSQL | taskmaster-postgres-1 | taskmaster-postgres | 5432 | ✅ Running |
| Coordinator | taskmaster-coordinator-1 | taskmaster-coordinator | 8080 | ✅ Running |
| Scheduler | taskmaster-scheduler-1 | taskmaster-scheduler | 8081 | ✅ Running |
| Worker 1 | taskmaster-worker-1 | taskmaster-worker | - | ✅ Running |
| Worker 2 | taskmaster-worker-2 | taskmaster-worker | - | ✅ Running |
| Worker 3 | taskmaster-worker-3 | taskmaster-worker | - | ✅ Running |

### Frontend Service
- **Framework**: React + Vite (Development mode)
- **Location**: `/home/ubuntu/taskmaster/client`
- **Process**: Node.js (npm run dev)
- **Port**: 5173

---

## 🛠️ Management Commands

### SSH into Server
```bash
# From Windows (WSL)
wsl ssh -i ~/.ssh/taskmaster-deploy ubuntu@13.220.251.240

# Or use EC2 Instance Connect via browser
```

### Check Docker Services
```bash
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml ps
```

### View Service Logs
```bash
# All services
sudo docker compose -f docker-compose-node.yml logs

# Specific service
sudo docker compose -f docker-compose-node.yml logs coordinator
sudo docker compose -f docker-compose-node.yml logs scheduler
sudo docker compose -f docker-compose-node.yml logs worker
sudo docker compose -f docker-compose-node.yml logs postgres
```

### Restart Backend Services
```bash
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml down
sudo docker compose -f docker-compose-node.yml up --scale worker=3 -d
```

### Manage Frontend
```bash
# Check if running
ps aux | grep "npm run dev"

# Stop frontend
pkill -f "npm run dev"

# Start frontend
cd ~/taskmaster/client
npm run dev -- --host 0.0.0.0 --port 5173 &

# View frontend logs
tail -f /tmp/frontend.log
```

### Scale Workers
```bash
# Scale to 5 workers
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml up --scale worker=5 -d

# Scale to 1 worker
sudo docker compose -f docker-compose-node.yml up --scale worker=1 -d
```

---

## 🔄 Deployment Process (For Reference)

### 1. Initial Setup
```bash
# Update system
sudo apt-get update -y && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Upload Project Files
```bash
# From local machine (WSL)
cd /mnt/c/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master
rsync -avz --exclude 'node_modules' --exclude 'data' -e 'ssh -i ~/.ssh/taskmaster-deploy' . ubuntu@13.220.251.240:~/taskmaster/
```

### 3. Start Backend
```bash
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml up --build --scale worker=3 -d
```

### 4. Setup Frontend
```bash
cd ~/taskmaster/client
npm install
npm run dev -- --host 0.0.0.0 --port 5173 &
```

---

## 🔧 Troubleshooting

### Frontend Not Loading
```bash
# Check if frontend is running
lsof -i :5173

# Check logs
tail -50 /tmp/frontend.log

# Restart
pkill -f "npm run dev"
cd ~/taskmaster/client && npm run dev -- --host 0.0.0.0 --port 5173 &
```

### Backend Services Down
```bash
# Check status
sudo docker compose -f ~/taskmaster/docker-compose-node.yml ps

# Restart all
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml down
sudo docker compose -f docker-compose-node.yml up --scale worker=3 -d
```

### Database Issues
```bash
# Connect to PostgreSQL
docker exec -it taskmaster-postgres-1 psql -U taskmaster -d taskmaster

# View tables
\dt

# Check tasks
SELECT * FROM tasks LIMIT 10;
```

### Port Already in Use
```bash
# Find process on port
lsof -i :5173

# Kill it
lsof -ti :5173 | xargs kill -9
```

---

## 📊 Monitoring

### Check System Resources
```bash
# CPU and Memory
htop

# Disk usage
df -h

# Docker stats
sudo docker stats
```

### View Live Task Updates
Visit: http://13.220.251.240:5173
- Monitor tasks in real-time via SSE
- Create bulk tasks
- Scale workers dynamically
- Test fault tolerance

---

## 🔒 Security Notes

1. **SSH Key**: Keep `taskmaster.pem` secure and never commit to Git
2. **Ports**: Only required ports are open (22, 5173, 8080, 8081, 5432)
3. **HTTP Warning**: Application uses HTTP (not HTTPS) - suitable for demo/dev
4. **Database**: PostgreSQL exposed on public IP - secure for production use

---

## 💾 Backup & Recovery

### Backup Database
```bash
docker exec taskmaster-postgres-1 pg_dump -U taskmaster taskmaster > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker exec -i taskmaster-postgres-1 psql -U taskmaster taskmaster
```

---

## 🚦 Health Checks

### Quick Health Check Script
```bash
#!/bin/bash
echo "=== TaskMaster Health Check ==="
echo ""
echo "Frontend (5173):"
curl -s http://localhost:5173 > /dev/null && echo "✅ UP" || echo "❌ DOWN"

echo "Coordinator (8080):"
curl -s http://localhost:8080 > /dev/null && echo "✅ UP" || echo "❌ DOWN"

echo "PostgreSQL (5432):"
pg_isready -h localhost -p 5432 && echo "✅ UP" || echo "❌ DOWN"

echo ""
echo "Docker Containers:"
sudo docker compose -f ~/taskmaster/docker-compose-node.yml ps
```

---

## 📝 Notes

- Frontend runs in development mode for live updates
- Docker Compose manages backend microservices
- Workers auto-register with Coordinator on startup
- Tasks are distributed round-robin across available workers
- SSE provides real-time task updates to UI

---

## 🆘 Emergency Commands

### Stop Everything
```bash
# Stop Docker services
sudo docker compose -f ~/taskmaster/docker-compose-node.yml down

# Stop frontend
pkill -f "npm run dev"
```

### Restart Everything
```bash
# Start Docker services
cd ~/taskmaster
sudo docker compose -f docker-compose-node.yml up --scale worker=3 -d

# Start frontend
cd ~/taskmaster/client
npm run dev -- --host 0.0.0.0 --port 5173 &
```

### Reboot EC2 Instance
```bash
sudo reboot
```
*Note: After reboot, manually restart frontend as Docker services auto-start*

---

## 📞 Quick Reference

| What | Where | How |
|------|-------|-----|
| Access App | Browser | http://13.220.251.240:5173 |
| SSH Access | Terminal | `wsl ssh -i ~/.ssh/taskmaster-deploy ubuntu@13.220.251.240` |
| View Logs | SSH | `sudo docker compose -f ~/taskmaster/docker-compose-node.yml logs` |
| Restart | SSH | See "Restart Everything" above |

---

**Last Updated**: February 3, 2026  
**Deployed By**: Automated deployment script  
**Status**: ✅ Operational
