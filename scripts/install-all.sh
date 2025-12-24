#!/bin/bash
# Complete installation - handles sudo upfront

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

step() {
    echo -e "${BLUE}==>${NC} $1"
}

# Get sudo upfront
step "Requesting sudo access..."
sudo -v

log "✓ Sudo access granted"
echo ""

# Step 1: Install system dependencies
step "STEP 1/7: Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y build-essential pkg-config libssl-dev clang protobuf-compiler git curl -qq
log "✓ System dependencies installed"
echo ""

# Step 2: Verify Rust
step "STEP 2/7: Checking Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Please run:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"
    echo "   source \$HOME/.cargo/env"
    exit 1
fi
source "$HOME/.cargo/env"
log "✓ Rust $(rustc --version)"
echo ""

# Step 3: Add WASM target
step "STEP 3/7: Adding wasm32-unknown-unknown target..."
rustup target add wasm32-unknown-unknown
log "✓ WASM target added"
echo ""

# Step 4: Clone linera-protocol
step "STEP 4/7: Cloning linera-protocol (testnet_conway branch)..."
LINERA_DIR="/tmp/linera-protocol"
rm -rf "$LINERA_DIR"
git clone --depth 1 --branch testnet_conway https://github.com/linera-io/linera-protocol.git "$LINERA_DIR"
log "✓ Repository cloned"
echo ""

# Step 5: Install Linera CLI (THE LONG STEP)
step "STEP 5/7: Installing Linera CLI..."
echo "⏳ This will take 10-20 minutes. Please be patient..."
echo "   Compiling Linera toolchain from source..."
echo ""

cd "$LINERA_DIR"
cargo install --locked --path linera-service

log "✓ Linera CLI installed"
echo ""

# Step 6: Verify installation
step "STEP 6/7: Verifying installation..."
if ! command -v linera &> /dev/null; then
    echo "❌ linera command not found"
    exit 1
fi
LINERA_VERSION=$(linera --version)
log "✓ Linera CLI: $LINERA_VERSION"
echo ""

# Step 7: Summary
step "STEP 7/7: Installation complete!"
echo ""
echo "==================================================================="
echo "  ✓ System dependencies installed"
echo "  ✓ Rust $(rustc --version | cut -d' ' -f2) with wasm32 target"
echo "  ✓ $LINERA_VERSION"
echo "==================================================================="
echo ""
echo "Next steps:"
echo "  1. Setup Conway wallet:  ./scripts/setup-conway-wallet.sh"
echo "  2. Build contracts:      ./scripts/build.sh"
echo "  3. Install frontend:     cd frontend && npm install"
echo "  4. Deploy to Conway:     ./scripts/deploy.sh"
echo ""
