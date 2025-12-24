#!/bin/bash
# Run the Linera node service for the arcade hub

set -e

echo "🎮 Starting Linera Arcade Hub service..."

cd "$(dirname "$0")/.."

# Check for application ID
if [ -z "$1" ]; then
    echo "Usage: ./scripts/run-service.sh <APPLICATION_ID>"
    echo ""
    echo "Get your application ID from the deployment output."
    exit 1
fi

APP_ID=$1

echo "📡 Starting service for application: $APP_ID"

# Run the linera service
linera service --port 8080 &

echo ""
echo "🚀 Service running at http://localhost:8080"
echo "📊 GraphQL endpoint: http://localhost:8080/applications/$APP_ID"
echo ""
echo "Press Ctrl+C to stop the service"

wait
