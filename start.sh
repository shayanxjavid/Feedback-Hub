#!/bin/bash
# =============================================================================
# Feedback Hub - Start All Services (MongoDB Edition)
# =============================================================================
# This script starts MongoDB (via Docker), Python sentiment service, 
# and Node.js API. Use Ctrl+C to stop all services.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Starting Feedback Hub Services (MongoDB Edition)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $PYTHON_PID $NODE_PID 2>/dev/null
    echo "Stopping MongoDB container..."
    docker stop feedback-mongodb 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Please install Docker or start MongoDB manually."
    echo "   Then set MONGODB_URI environment variable and re-run this script."
    echo ""
    echo "   Manual MongoDB options:"
    echo "   - Local MongoDB: mongodb://localhost:27017/feedback-hub"
    echo "   - MongoDB Atlas: mongodb+srv://user:pass@cluster.mongodb.net/feedback-hub"
    echo ""
fi

# Start MongoDB container if Docker is available
if command -v docker &> /dev/null; then
    echo "Starting MongoDB container..."
    
    # Remove existing container if it exists
    docker rm -f feedback-mongodb 2>/dev/null
    
    # Start new MongoDB container
    docker run -d \
        --name feedback-mongodb \
        -p 27017:27017 \
        mongo:7 \
        > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB started (container: feedback-mongodb)"
        sleep 3  # Wait for MongoDB to be ready
    else
        echo "❌ Failed to start MongoDB container"
        echo "   Make sure Docker is running and port 27017 is available"
        exit 1
    fi
else
    echo "⚠️  Skipping MongoDB container (Docker not available)"
    echo "   Make sure MongoDB is running externally"
fi
echo ""

# Start Python sentiment service
echo "Starting Python Sentiment Service on port 8000..."
cd "$SCRIPT_DIR/python-service"
python3 -m uvicorn sentiment_service:app --host 0.0.0.0 --port 8000 &
PYTHON_PID=$!
sleep 2

# Check if Python service started
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "❌ Failed to start Python service"
    docker stop feedback-mongodb 2>/dev/null
    exit 1
fi
echo "✅ Python service started (PID: $PYTHON_PID)"
echo ""

# Start Node.js API
echo "Starting Node.js API on port 3000..."
cd "$SCRIPT_DIR/node-api"
node server.js &
NODE_PID=$!
sleep 3

# Check if Node service started
if ! kill -0 $NODE_PID 2>/dev/null; then
    echo "❌ Failed to start Node.js API"
    kill $PYTHON_PID 2>/dev/null
    docker stop feedback-mongodb 2>/dev/null
    exit 1
fi
echo "✅ Node.js API started (PID: $NODE_PID)"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "  All Services Running:"
echo "    • MongoDB:          mongodb://localhost:27017"
echo "    • Python Sentiment: http://localhost:8000"
echo "    • Node.js API:      http://localhost:3000"
echo "    • API Docs:         http://localhost:8000/docs"
echo ""
echo "  Test with:"
echo "    curl -X POST http://localhost:3000/api/feedback \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"text\": \"I love this!\", \"user\": \"Test\"}'"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Wait for both processes
wait $PYTHON_PID $NODE_PID
