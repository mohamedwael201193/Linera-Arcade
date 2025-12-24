#!/bin/bash

# Start backend services for Linera Arcade
# This script starts PostgreSQL and the backend API server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

echo "🎮 Starting Linera Arcade Backend Services"
echo "==========================================="

# Check if Docker is available
if command -v docker &> /dev/null; then
  echo "📦 Starting PostgreSQL via Docker..."
  cd "$BACKEND_DIR"
  docker-compose up -d
  
  # Wait for PostgreSQL to be ready
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 3
  
  # Check if PostgreSQL is ready
  for i in {1..30}; do
    if docker exec linera-arcade-db pg_isready -U arcade -d linera_arcade > /dev/null 2>&1; then
      echo "✅ PostgreSQL is ready!"
      break
    fi
    sleep 1
  done
else
  echo "⚠️ Docker not found. Please ensure PostgreSQL is running manually."
  echo "   Connection: postgresql://arcade:arcade123@localhost:5432/linera_arcade"
fi

# Run migrations
echo "📊 Running database migrations..."
cd "$BACKEND_DIR"
npm run db:migrate

# Start the backend server
echo "🚀 Starting backend server..."
npm run dev
