#!/bin/bash
# Setup script for Linera Arcade Executor
# This initializes the wallet and runs the executor

set -e

echo "🎮 Linera Arcade Executor Setup"
echo "================================"

# Configuration
export FAUCET_URL="${FAUCET_URL:-https://faucet.testnet-conway.linera.net}"
export HUB_CHAIN_ID="${HUB_CHAIN_ID:-925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44}"
export APPLICATION_ID="${APPLICATION_ID:-6c827a8df45212cdc97eaca2d286f4608511e632396dd6fea7783ef83d573782}"
export RESOLUTION_INTERVAL_SECS="${RESOLUTION_INTERVAL_SECS:-60}"

# Check for existing wallet
LINERA_DIR="${HOME}/.linera"
if [ ! -f "${LINERA_DIR}/wallet.json" ]; then
    echo "📦 Initializing wallet with faucet..."
    linera wallet init --faucet "${FAUCET_URL}"
    
    echo "🔗 Requesting a new chain from faucet..."
    linera wallet request-chain --faucet "${FAUCET_URL}"
else
    echo "✅ Wallet already exists at ${LINERA_DIR}"
fi

# Show wallet info
echo ""
echo "📋 Wallet Info:"
linera wallet show

# Set wallet paths
export LINERA_WALLET="${LINERA_DIR}/wallet.json"
export LINERA_KEYSTORE="${LINERA_DIR}/keystore.json"

echo ""
echo "🚀 Starting Arcade Executor..."
echo "   Hub Chain: ${HUB_CHAIN_ID:0:16}..."
echo "   Application: ${APPLICATION_ID:0:16}..."
echo "   Faucet: ${FAUCET_URL}"
echo ""

# Run the executor
cd "$(dirname "$0")"
cargo run --release
