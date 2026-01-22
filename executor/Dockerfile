# Build stage - use Debian and install Rust via rustup for exact version control
FROM debian:bookworm-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust 1.86.0 via rustup (matches rust-toolchain.toml)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.86.0
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy Cargo files first for dependency caching
COPY Cargo.toml Cargo.lock* ./

# Create dummy src to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true

# Copy actual source
COPY src ./src

# Build the actual application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary
COPY --from=builder /app/target/release/arcade-executor /app/arcade-executor

# Create config directory for wallet files
# The wallet_loader.rs will write files here from env vars at runtime
RUN mkdir -p /root/.config/linera

# Environment variables documentation (set these in Render dashboard):
# REQUIRED:
#   HUB_CHAIN_ID - The hub chain ID
#   APPLICATION_ID - The arcade hub application ID
#   BACKEND_URL - Backend API URL
#   LINERA_WALLET_JSON - Contents of wallet.json (raw JSON)
#   LINERA_KEYSTORE_JSON - Contents of keystore.json (raw JSON)
# OPTIONAL:
#   LINERA_FAUCET_URL - Faucet URL (default: Conway testnet)
#   RESOLUTION_INTERVAL_SECS - Check interval (default: 30)
#   RUST_LOG - Log level (default: arcade_executor=info)

# Run the executor
CMD ["/app/arcade-executor"]
