# ==============================================================================
# Linera Arcade Executor - Production Dockerfile
# ==============================================================================
# 
# PINNED: Rust 1.86.0 and Linera SDK 0.15.8
# The Cargo.lock file ensures exact dependency versions.
#
# We use the SAME debian:bookworm base for build and runtime to ensure
# glibc compatibility - this prevents silent crashes at startup.
# ==============================================================================

# Build stage
FROM debian:bookworm AS builder

# Install build dependencies including Rust via rustup
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust 1.86.0 via rustup (pinned version)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    --default-toolchain 1.86.0 \
    --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# Verify Rust installation
RUN rustc --version && cargo --version

WORKDIR /app

# Copy Cargo files first - Cargo.lock ensures pinned versions
COPY Cargo.toml Cargo.lock ./

# Create dummy src to build dependencies
RUN mkdir src && echo "fn main() { println!(\"dependency build\"); }" > src/main.rs

# Build dependencies (may fail, that's ok - we're just caching deps)
RUN cargo build --release 2>&1 || echo "Dependency pre-build done"

# Remove dummy and copy actual source
RUN rm -rf src
COPY src ./src

# Touch main.rs to ensure full rebuild
RUN touch src/main.rs

# Build the actual application with verbose output
RUN cargo build --release 2>&1

# Verify build succeeded (file command not available in minimal builder)
RUN test -f target/release/arcade-executor && \
    echo "✅ Binary built successfully" && \
    ls -la target/release/arcade-executor

# ==============================================================================
# Runtime stage - use same base to ensure glibc compatibility
# ==============================================================================
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/arcade-executor /app/arcade-executor

# Ensure binary is executable
RUN chmod +x /app/arcade-executor

# Create config directory for wallet files
RUN mkdir -p /root/.config/linera

# Verify binary can at least be loaded by the dynamic linker
RUN echo "=== Binary verification ===" && \
    ls -la /app/arcade-executor && \
    ldd /app/arcade-executor || echo "(ldd check skipped)" && \
    echo "✅ Binary copied successfully"

# Create comprehensive entrypoint script with full diagnostics
# NOTE: Using POSIX sh syntax (no bash-isms like ${#var} or ${var:0:60})
COPY <<'ENTRYPOINT_EOF' /app/entrypoint.sh
#!/bin/sh
set -e

echo "========================================================"
echo "🎮 Linera Arcade Executor - Starting Up"
echo "========================================================"
echo "Timestamp: $(date -Iseconds)"
echo "Hostname: $(hostname)"
echo ""

# Verify binary exists and is executable
echo "📦 Binary verification:"
if [ ! -f /app/arcade-executor ]; then
    echo "❌ FATAL: Binary not found at /app/arcade-executor"
    exit 1
fi
if [ ! -x /app/arcade-executor ]; then
    echo "❌ FATAL: Binary is not executable"
    exit 1
fi
echo "   ✅ Binary exists and is executable"
ls -la /app/arcade-executor
echo ""

# Check critical environment variables (POSIX-compliant)
echo "🔍 Required environment variables:"
check_required() {
    VAR_NAME=$1
    VAR_VALUE=$(printenv "$VAR_NAME" 2>/dev/null || echo "")
    if [ -z "$VAR_VALUE" ]; then
        echo "   ❌ $VAR_NAME: NOT SET"
        return 1
    else
        case $VAR_NAME in
            *JSON*|*SECRET*|*KEY*)
                # For sensitive vars, just show it's set
                echo "   ✅ $VAR_NAME: SET"
                ;;
            *)
                echo "   ✅ $VAR_NAME: $VAR_VALUE"
                ;;
        esac
        return 0
    fi
}

MISSING=0
check_required "HUB_CHAIN_ID" || MISSING=1
check_required "APPLICATION_ID" || MISSING=1
check_required "BACKEND_URL" || MISSING=1
check_required "LINERA_WALLET_JSON" || MISSING=1
check_required "LINERA_KEYSTORE_JSON" || MISSING=1

echo ""
echo "📋 Optional configuration:"
check_required "LINERA_FAUCET_URL" || echo "   ℹ️  LINERA_FAUCET_URL: using default (Conway testnet)"
check_required "RESOLUTION_INTERVAL_SECS" || echo "   ℹ️  RESOLUTION_INTERVAL_SECS: using default (30)"
check_required "RUST_LOG" || echo "   ℹ️  RUST_LOG: using default"

if [ "$MISSING" = "1" ]; then
    echo ""
    echo "========================================================"
    echo "❌ FATAL: Missing required environment variables!"
    echo "========================================================"
    echo ""
    echo "Please set all required variables in Render dashboard:"
    echo "  - HUB_CHAIN_ID"
    echo "  - APPLICATION_ID"
    echo "  - BACKEND_URL"
    echo "  - LINERA_WALLET_JSON (raw JSON content of wallet.json)"
    echo "  - LINERA_KEYSTORE_JSON (raw JSON content of keystore.json)"
    exit 1
fi

# Validate JSON format for wallet/keystore
echo ""
echo "🔐 Validating JSON format..."

# Check wallet JSON starts with {
WALLET_FIRST_CHAR=$(printf '%s' "$LINERA_WALLET_JSON" | cut -c1)
if [ "$WALLET_FIRST_CHAR" != "{" ]; then
    echo "❌ FATAL: LINERA_WALLET_JSON does not appear to be valid JSON"
    echo "   First character is '$WALLET_FIRST_CHAR' (expected '{')"
    echo "   This often means the value is base64 encoded - it should be raw JSON"
    exit 1
fi
echo "   ✅ LINERA_WALLET_JSON starts with '{'"

# Check keystore JSON starts with {
KEYSTORE_FIRST_CHAR=$(printf '%s' "$LINERA_KEYSTORE_JSON" | cut -c1)
if [ "$KEYSTORE_FIRST_CHAR" != "{" ]; then
    echo "❌ FATAL: LINERA_KEYSTORE_JSON does not appear to be valid JSON"
    echo "   First character is '$KEYSTORE_FIRST_CHAR' (expected '{')"
    exit 1
fi
echo "   ✅ LINERA_KEYSTORE_JSON starts with '{'"

# Prepare config directory
echo ""
echo "📂 Preparing Linera config directory..."
mkdir -p /root/.config/linera
chmod 700 /root/.config/linera
echo "   ✅ /root/.config/linera created with secure permissions"

# Set default RUST_LOG if not provided
RUST_LOG="${RUST_LOG:-arcade_executor=info,linera_client=warn,linera_core=warn}"
export RUST_LOG
export RUST_BACKTRACE=1

echo ""
echo "📊 Runtime configuration:"
echo "   RUST_LOG: $RUST_LOG"
echo "   RUST_BACKTRACE: $RUST_BACKTRACE"

echo ""
echo "========================================================"
echo "🚀 Launching arcade-executor..."
echo "========================================================"
echo ""

# Execute the binary - use exec to replace shell process
# All stdout/stderr will go to Render logs
exec /app/arcade-executor
ENTRYPOINT_EOF

RUN chmod +x /app/entrypoint.sh

# Environment variables documentation (set in Render dashboard):
# REQUIRED:
#   HUB_CHAIN_ID - Hub chain ID (e.g., 925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44)
#   APPLICATION_ID - Arcade hub app ID (e.g., 6c827a8df45212cdc97eaca2d286f4608511e632396dd6fea7783ef83d573782)
#   BACKEND_URL - Backend API URL (https://linera-arcade-backend.onrender.com)
#   LINERA_WALLET_JSON - FULL contents of wallet.json as RAW JSON (not base64!)
#   LINERA_KEYSTORE_JSON - FULL contents of keystore.json as RAW JSON (not base64!)
# OPTIONAL:
#   LINERA_FAUCET_URL - Faucet URL (default: https://faucet.testnet-conway.linera.net)
#   RESOLUTION_INTERVAL_SECS - Resolution check interval (default: 30)
#   RUST_LOG - Log level filter (default: arcade_executor=info,linera_client=warn,linera_core=warn)

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
