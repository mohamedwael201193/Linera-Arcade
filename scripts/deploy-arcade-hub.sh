#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hub chain ID (our default chain)
HUB_CHAIN_ID="925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44"

# Repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${BLUE}🎮 Linera Arcade Hub Deployment Script${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/7]${NC} Checking prerequisites..."

if ! command -v linera &> /dev/null; then
    echo -e "${RED}❌ Error: 'linera' command not found${NC}"
    echo "Please install Linera CLI first: cargo install linera-service"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Error: 'cargo' command not found${NC}"
    echo "Please install Rust: https://rustup.rs/"
    exit 1
fi

WASM_OPT_AVAILABLE=false
if command -v wasm-opt &> /dev/null; then
    WASM_OPT_AVAILABLE=true
    echo -e "${GREEN}✓${NC} wasm-opt found (will optimize service WASM)"
else
    echo -e "${YELLOW}⚠${NC} wasm-opt not found (skipping optimization)"
    echo "  Install with: sudo apt install binaryen"
fi

echo -e "${GREEN}✓${NC} Prerequisites OK\n"

# Step 2: Confirm default chain
echo -e "${YELLOW}[2/7]${NC} Checking wallet configuration..."

WALLET_OUTPUT=$(linera wallet show 2>&1 || true)
DEFAULT_CHAIN=$(echo "$WALLET_OUTPUT" | grep -B 1 "DEFAULT" | grep "Chain ID" | awk '{print $3}' || true)

if [ -z "$DEFAULT_CHAIN" ]; then
    echo -e "${RED}❌ Error: No default chain found in wallet${NC}"
    echo "Please set default chain:"
    echo "  linera wallet set-default $HUB_CHAIN_ID"
    exit 1
fi

if [ "$DEFAULT_CHAIN" != "$HUB_CHAIN_ID" ]; then
    echo -e "${YELLOW}⚠ Warning: Default chain ($DEFAULT_CHAIN) differs from hub chain ($HUB_CHAIN_ID)${NC}"
    echo "  Recommend setting: linera wallet set-default $HUB_CHAIN_ID"
    echo "  Continuing with current default chain..."
    # Use the actual default chain for deployment
    HUB_CHAIN_ID="$DEFAULT_CHAIN"
fi

echo -e "${GREEN}✓${NC} Default chain: $HUB_CHAIN_ID\n"

# Step 3: Build WASM
echo -e "${YELLOW}[3/7]${NC} Building WASM contracts..."

cargo build --release --target wasm32-unknown-unknown -p arcade-hub

CONTRACT_WASM="target/wasm32-unknown-unknown/release/arcade_hub_contract.wasm"
SERVICE_WASM="target/wasm32-unknown-unknown/release/arcade_hub_service.wasm"

if [ ! -f "$CONTRACT_WASM" ]; then
    echo -e "${RED}❌ Error: Contract WASM not found at $CONTRACT_WASM${NC}"
    exit 1
fi

if [ ! -f "$SERVICE_WASM" ]; then
    echo -e "${RED}❌ Error: Service WASM not found at $SERVICE_WASM${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} WASM built successfully"
echo "  Contract: $(du -h $CONTRACT_WASM | cut -f1)"
echo "  Service:  $(du -h $SERVICE_WASM | cut -f1)\n"

# Step 4: Optional wasm-opt
PUBLISH_SERVICE_WASM="$SERVICE_WASM"

if [ "$WASM_OPT_AVAILABLE" = true ]; then
    echo -e "${YELLOW}[4/7]${NC} Optimizing service WASM..."
    
    SERVICE_WASM_OPT="target/wasm32-unknown-unknown/release/arcade_hub_service_opt.wasm"
    
    wasm-opt -Oz --enable-bulk-memory \
        "$SERVICE_WASM" \
        -o "$SERVICE_WASM_OPT"
    
    if [ -f "$SERVICE_WASM_OPT" ]; then
        PUBLISH_SERVICE_WASM="$SERVICE_WASM_OPT"
        echo -e "${GREEN}✓${NC} Service WASM optimized"
        echo "  Original: $(du -h $SERVICE_WASM | cut -f1)"
        echo "  Optimized: $(du -h $SERVICE_WASM_OPT | cut -f1)\n"
    else
        echo -e "${YELLOW}⚠${NC} Optimization failed, using original\n"
    fi
else
    echo -e "${YELLOW}[4/7]${NC} Skipping WASM optimization (wasm-opt not available)\n"
fi

# Step 5: Run publish-and-create
echo -e "${YELLOW}[5/7]${NC} Deploying to Conway testnet..."
echo "  This may take 1-2 minutes..."

DEPLOY_LOG=$(mktemp)

set +e
linera publish-and-create \
    "$CONTRACT_WASM" \
    "$PUBLISH_SERVICE_WASM" \
    --json-argument "{\"hub_chain_id\":\"$HUB_CHAIN_ID\"}" \
    > "$DEPLOY_LOG" 2>&1
DEPLOY_EXIT_CODE=$?
set -e

if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}\n"
    
    # Check for known network issues
    if grep -q "handle_pending_blob" "$DEPLOY_LOG" || \
       grep -q "Timeout expired" "$DEPLOY_LOG" || \
       grep -q "Blobs not found" "$DEPLOY_LOG"; then
        
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}⚠  Conway Testnet Network Issue Detected${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "This is a temporary Conway validator availability issue."
        echo "Common causes:"
        echo "  • Validators not synchronized"
        echo "  • Network congestion"
        echo "  • Blob distribution timeout"
        echo ""
        echo "Solutions:"
        echo "  1. Wait 5-10 minutes and retry: ./scripts/deploy-arcade-hub.sh"
        echo "  2. Try during off-peak hours"
        echo "  3. Check Conway testnet status"
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
    
    echo ""
    echo "Last 20 lines of deployment log:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -n 20 "$DEPLOY_LOG"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Full log saved to: $DEPLOY_LOG"
    exit 1
fi

echo -e "${GREEN}✓${NC} Deployment successful\n"

# Step 6: Extract Application ID
echo -e "${YELLOW}[6/7]${NC} Extracting Application ID..."

# Look for 64-character hex string (application ID)
APP_ID=$(grep -oE '[0-9a-f]{64}' "$DEPLOY_LOG" | head -n 1 || true)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Error: Could not extract Application ID from deployment output${NC}"
    echo ""
    echo "Please manually inspect the deployment log:"
    echo "  cat $DEPLOY_LOG"
    echo ""
    echo "Look for a 64-character hex string (Application ID) and update:"
    echo "  frontend/.env"
    exit 1
fi

echo -e "${GREEN}✓${NC} Application ID: $APP_ID\n"

# Step 7: Update frontend/.env
echo -e "${YELLOW}[7/7]${NC} Updating frontend/.env..."

ENV_FILE="frontend/.env"

# Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    touch "$ENV_FILE"
fi

# Function to update or add env variable
update_env_var() {
    local key=$1
    local value=$2
    local file=$3
    
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Update existing
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        # Add new
        echo "${key}=${value}" >> "$file"
    fi
}

# Update env variables
update_env_var "VITE_APPLICATION_ID" "$APP_ID" "$ENV_FILE"
update_env_var "VITE_LINERA_FAUCET_URL" "https://faucet.testnet-conway.linera.net" "$ENV_FILE"
update_env_var "VITE_DYNAMIC_ENVIRONMENT_ID" "c933f1ef-2c15-4e0b-97ad-d83b6d4f9d12" "$ENV_FILE"

echo -e "${GREEN}✓${NC} Frontend .env updated\n"

# Final output
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Arcade Hub deployed to Conway testnet!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Deployment Info:${NC}"
echo "  HUB_CHAIN_ID  = $HUB_CHAIN_ID"
echo "  APP_ID        = $APP_ID"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start Linera service (in new terminal):"
echo "     ${YELLOW}linera service --port 8080${NC}"
echo ""
echo "  2. Start frontend dev server:"
echo "     ${YELLOW}cd frontend && npm run dev${NC}"
echo ""
echo "  3. Open browser to the URL shown by Vite"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Cleanup
rm -f "$DEPLOY_LOG"
