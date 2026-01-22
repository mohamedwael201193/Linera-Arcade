# Build stage
FROM rust:1.82-bookworm as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

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

# Create config directory
RUN mkdir -p /root/.config/linera

# Run the executor
CMD ["/app/arcade-executor"]
