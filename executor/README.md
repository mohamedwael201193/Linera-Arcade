# Linera Arcade Executor

**On-Chain Resolution Service for Crypto Prediction Rounds**

This Rust service resolves crypto prediction rounds on-chain using the Linera blockchain. It follows the same patterns as the official Linera Faucet service, using `linera-client` directly (NOT CLI subprocess).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCADE EXECUTOR                          │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   Timer     │───▶│   Query     │───▶│   Resolve   │    │
│   │   Loop      │    │   Rounds    │    │   On-Chain  │    │
│   │   (30s)     │    │             │    │             │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                  │                   │            │
│         ▼                  ▼                   ▼            │
│   ┌─────────────────────────────────────────────────┐      │
│   │              LINERA CLIENT                       │      │
│   │   (ChainClient, execute_operation, sync)         │      │
│   └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┼──────┘
                                                      │
                                                      ▼
                                         ┌─────────────────────┐
                                         │   LINERA VALIDATORS │
                                         │   (Conway Testnet)  │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │   SMART CONTRACT    │
                                         │   (Arcade Hub)      │
                                         │                     │
                                         │   ResolveCryptoRound│
                                         │   - Fetch winners   │
                                         │   - Distribute coins│
                                         │   - Update state    │
                                         └─────────────────────┘
```

## Key Features

- ✅ **Direct Linera Client** - Uses `linera-client` library, not CLI subprocess
- ✅ **On-Chain Resolution** - Smart contract handles winner calculation and payouts
- ✅ **Price Oracle** - Fetches BTC/ETH prices from Coinbase API
- ✅ **Wasmer Runtime** - Supports WASM application interaction
- ✅ **Production Ready** - Systemd service file included

## Prerequisites

1. **Linera Wallet** - Must have a wallet initialized on Conway testnet:
   ```bash
   linera wallet init --faucet https://faucet.testnet-conway.linera.net
   linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net
   ```

2. **Rust Toolchain** - Rust 1.70+ with cargo

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUB_CHAIN_ID` | Chain ID where Arcade Hub is deployed | Required |
| `APPLICATION_ID` | Application ID of Arcade Hub | Required |
| `LINERA_FAUCET_URL` | Faucet URL for genesis config | `https://faucet.testnet-conway.linera.net` |
| `RESOLUTION_INTERVAL_SECS` | How often to check for expired rounds | `30` |
| `LINERA_KEYSTORE` | Path to keystore.json | `~/.config/linera/keystore.json` |

## Building

```bash
cd /home/devmo/linera
cargo build --release -p arcade-executor
```

The binary will be at `target/release/arcade-executor`.

## Running

```bash
export HUB_CHAIN_ID="925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44"
export APPLICATION_ID="6c827a8df45212cdc97eaca2d286f4608511e632396dd6fea7783ef83d573782"
export RESOLUTION_INTERVAL_SECS="30"

./target/release/arcade-executor
```

## Systemd Deployment

1. Copy the service file:
   ```bash
   sudo cp executor/arcade-executor.service /etc/systemd/system/
   ```

2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable arcade-executor
   sudo systemctl start arcade-executor
   ```

3. Check status:
   ```bash
   sudo systemctl status arcade-executor
   sudo journalctl -u arcade-executor -f
   ```

## How It Works

1. **Startup**
   - Load signer from keystore
   - Fetch genesis config from faucet
   - Create in-memory storage with Wasmer runtime
   - Initialize ChainClient for hub chain
   - Synchronize with validators

2. **Resolution Loop** (every 30s)
   - Query active crypto rounds via GraphQL
   - For each expired round:
     - Fetch current BTC/ETH price from Coinbase
     - Create `ResolveCryptoRound` operation
     - Execute via `chain_client.execute_operation()`
   - Smart contract handles:
     - Winner determination (up vs down)
     - Payout calculation
     - Coin transfers to winners

## Operation Format

The `ResolveCryptoRound` operation is serialized with BCS (Binary Canonical Serialization):

```rust
enum ArcadeOperation {
    RegisterPlayer { name: String },
    PlayGame { game_id: String, score: u64, duration_ms: u64 },
    ResolveCryptoRound { round_id: u64, end_price: u64 },
    // ...
}
```

## Logs

```
2026-01-22T05:29:04.610306Z  INFO arcade_executor: 🎮 Linera Arcade Executor starting...
2026-01-22T05:29:04.610321Z  INFO arcade_executor:    Version: 0.1.0
2026-01-22T05:29:04.947733Z  INFO arcade_executor: 🔧 Initializing storage with genesis config...
2026-01-22T05:29:20.049564Z  INFO arcade_executor: 🚀 Starting crypto round executor...
2026-01-22T05:29:20.078041Z  INFO arcade_executor::executor: 🔁 Starting resolution loop (interval: 30s)
```

## Troubleshooting

### "Wasm runtime is required"
Ensure the `wasmer` feature is enabled for `linera-execution` in Cargo.toml.

### "CryptoProvider" panic
Install TLS provider at startup:
```rust
rustls::crypto::ring::default_provider()
    .install_default()
    .expect("Failed to install rustls crypto provider");
```

### "Failed to synchronize with validators"
Check network connectivity and faucet URL. Sync can take 10-20 seconds.

## License

Apache-2.0
