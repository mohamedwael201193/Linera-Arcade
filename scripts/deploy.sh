#!/bin/bash
# Deploy the Linera Arcade Hub to Conway testnet

set -e

echo "🎮 Deploying Linera Arcade Hub to Conway..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build first if needed
if [ ! -f "target/wasm32-unknown-unknown/release/arcade_hub_contract.wasm" ]; then
    echo "📦 Building contracts first..."
    ./scripts/build.sh
fi

# Faucet URL
FAUCET_URL="https://faucet.testnet-conway.linera.net"

# Check if wallet exists, create if not
if ! linera wallet show &>/dev/null; then
    echo "💳 Creating new wallet..."
    linera wallet init --faucet "$FAUCET_URL"
fi

# Get the default chain ID (this will be the hub chain)
HUB_CHAIN_ID=$(linera wallet show | grep "Chain ID" | head -1 | awk '{print $3}')
echo "📍 Hub Chain ID: $HUB_CHAIN_ID"

# Create instantiation argument
INSTANTIATION_ARG=$(cat <<EOF
{
    "hub_chain_id": "$HUB_CHAIN_ID"
}
EOF
)

echo "📝 Instantiation argument:"
echo "$INSTANTIATION_ARG"

# Publish and create the application
echo "🚀 Publishing and creating application..."

APP_ID=$(linera publish-and-create \
    target/wasm32-unknown-unknown/release/arcade_hub_contract.wasm \
    target/wasm32-unknown-unknown/release/arcade_hub_service.wasm \
    --json-argument "$INSTANTIATION_ARG")

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📱 Application ID: $APP_ID"
echo "🔗 Hub Chain ID: $HUB_CHAIN_ID"
echo ""
echo "Update your frontend .env file:"
echo "VITE_APPLICATION_ID=$APP_ID"
echo ""
echo "To start the frontend:"
echo "cd frontend && npm install && npm run dev"
