#!/bin/bash
# Robust Linera installation with progress tracking

set -e

LINERA_DIR="/tmp/linera-protocol"
INSTALL_LOG="$HOME/linera-install.log"
PROGRESS_FILE="$HOME/linera-install-progress"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$INSTALL_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$INSTALL_LOG"
    exit 1
}

check_step() {
    grep -q "^$1$" "$PROGRESS_FILE" 2>/dev/null
}

mark_step() {
    echo "$1" >> "$PROGRESS_FILE"
    log "✓ Completed: $1"
}

log "=== Linera Installation Started ==="

# Step 1: System dependencies
if ! check_step "deps_installed"; then
    log "Installing system dependencies..."
    sudo apt-get update >> "$INSTALL_LOG" 2>&1
    sudo apt-get install -y build-essential pkg-config libssl-dev clang protobuf-compiler >> "$INSTALL_LOG" 2>&1
    mark_step "deps_installed"
fi

# Step 2: Clone repository
if ! check_step "repo_cloned"; then
    log "Cloning linera-protocol (Conway testnet branch)..."
    rm -rf "$LINERA_DIR"
    git clone --depth 1 --branch testnet_conway https://github.com/linera-io/linera-protocol.git "$LINERA_DIR" >> "$INSTALL_LOG" 2>&1
    mark_step "repo_cloned"
fi

# Step 3: Install linera-service
if ! check_step "linera_service"; then
    log "==================================================================="
    log "Installing linera-service (10-20 minutes)..."
    log "Log: $INSTALL_LOG"
    log "==================================================================="
    
    cd "$LINERA_DIR"
    source "$HOME/.cargo/env"
    
    cargo install --locked --path linera-service >> "$INSTALL_LOG" 2>&1
    mark_step "linera_service"
fi

# Step 4: Verify
if ! check_step "verified"; then
    source "$HOME/.cargo/env"
    if ! command -v linera &> /dev/null; then
        error "linera not found after installation"
    fi
    log "✓ Linera installed: $(linera --version)"
    mark_step "verified"
fi

log "==================================================================="
log "✓ INSTALLATION COMPLETE!"
log "==================================================================="

rm -f "$PROGRESS_FILE"
