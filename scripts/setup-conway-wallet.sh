#!/bin/bash
# Setup Conway testnet wallet

set -e

FAUCET_URL="https://faucet.testnet-conway.linera.net"

echo "🎮 Setting up Conway testnet wallet..."

source "$HOME/.cargo/env"

if ! command -v linera &> /dev/null; then
    echo "❌ Linera CLI not found. Run: ./scripts/install-linera-robust.sh"
    exit 1
fi

echo "📡 Connecting to Conway faucet: $FAUCET_URL"

# Initialize wallet with Conway faucet
linera wallet init --faucet "$FAUCET_URL"

echo ""
echo "✅ Wallet initialized!"
echo ""
echo "Your wallet info:"
linera wallet show
echo ""
echo "Next: ./scripts/build.sh"
