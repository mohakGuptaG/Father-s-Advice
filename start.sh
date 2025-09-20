#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Mentor-Mentee Matching System...${NC}"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3.8 or higher.${NC}"
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}pip3 is not installed. Please install pip3.${NC}"
    exit 1
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo -e "${RED}MongoDB is not installed. Please install MongoDB 4.4 or higher.${NC}"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
    return $?
}

# Function to kill process on a port
kill_port() {
    pid=$(lsof -t -i :$1)
    if [ ! -z "$pid" ]; then
        echo "Killing process on port $1 (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
}

# Clean up existing processes
echo "Cleaning up existing processes..."
kill_port 5000
kill_port 5001
kill_port 5002
kill_port 5003

# Check MongoDB status
echo "Checking MongoDB status..."
if systemctl is-active --quiet mongod; then
    echo "MongoDB is running"
else
    echo "MongoDB is not running. Starting MongoDB..."
    sudo systemctl start mongod
    sleep 2
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Python services
echo "Starting Python services..."
python3 run_services.py > logs/python_services.log 2>&1 &
services_pid=$!

# Start mentor processor service separately
echo "Starting mentor processor service..."
python3 mentor_processor.py > logs/mentor_processor.log 2>&1 &
mentor_pid=$!

# Wait for services to initialize
echo "Waiting for Python services to initialize..."
sleep 5

# Check if services are running
echo "Checking Python services..."
failed_services=0

# Function to check service health
check_service() {
    local port=$1
    local name=$2
    local max_retries=3
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s http://localhost:$port/health >/dev/null; then
            echo "Service $name is healthy"
            return 0
        fi
        retry=$((retry + 1))
        if [ $retry -lt $max_retries ]; then
            echo "Service $name not responding, retrying..."
            sleep 2
        fi
    done
    
    echo "Warning: Service on port $port failed to start"
    return 1
}

# Check each service
check_service 5000 "API" || failed_services=$((failed_services + 1))
check_service 5001 "Algorithm" || failed_services=$((failed_services + 1))
check_service 5002 "Workflow" || failed_services=$((failed_services + 1))
check_service 5003 "Mentor Processor" || failed_services=$((failed_services + 1))

# Check logs if any service failed
if [ $failed_services -gt 0 ]; then
    echo "Checking logs..."
    cat logs/python_services.log
    echo "Killing Python services..."
    kill $services_pid 2>/dev/null
    kill $mentor_pid 2>/dev/null
    echo "Please check logs/python_services.log for details"
    exit 1
fi

echo "All services are running successfully!"
echo "Service endpoints:"
echo "- API: http://localhost:5000"
echo "- Algorithm: http://localhost:5001"
echo "- Workflow: http://localhost:5002"
echo "- Mentor Processor: http://localhost:5003"
echo ""
echo "Press Ctrl+C to stop all services"

# Keep the script running and show logs
echo "Showing logs (Ctrl+C to stop)..."
tail -f logs/python_services.log logs/mentor_processor.log 