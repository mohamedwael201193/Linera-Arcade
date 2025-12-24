#!/bin/bash
# Build the Linera Arcade Hub contract

set -e

echo "🎮 Building Linera Arcade Hub..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the WASM contracts
echo "📦 Compiling Rust contracts to WASM..."
cargo build --release --target wasm32-unknown-unknown

# Check if build was successful
if [ -f "target/wasm32-unknown-unknown/release/arcade_hub_contract.wasm" ]; then
    echo "✅ Contract WASM built successfully!"
    ls -lh target/wasm32-unknown-unknown/release/arcade_hub_*.wasm
else
    echo "❌ Build failed - WASM files not found"
    exit 1
fi

echo ""
echo "🎉 Build complete!"
echo ""
echo "Next steps:"
echo "1. Deploy with: ./scripts/deploy.sh"
echo "2. Or manually deploy using linera CLI"
