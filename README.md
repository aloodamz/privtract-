# Priv-Tract — AI Agent Transaction Policy Engine

[![Rust](https://github.com/aloodamz/Priv-tract-capstone-/actions/workflows/rust.yml/badge.svg)](https://github.com/aloodamz/Priv-tract-capstone-/actions/workflows/rust.yml)

A high-performance, privacy-preserving transaction policy engine and SDK for autonomous AI agents on Solana. Priv-Tract enforces structural and economic boundaries on agent transactions using SHA-256 and BLAKE3 cryptographic identity masking, deterministic policy gates, and atomic spend accounting.

```
┌────────────────────┐       ┌──────────────────────────────┐
│   AI Agent / Bot   │──────▶│      PrivTractSDK            │
│                    │       │                              │
│  tx = Transaction  │       │  ┌──────────┐ ┌───────────┐ │
│  sdk.evaluate(tx)  │       │  │ Embedded │ │ Gateway   │ │
│                    │       │  │ Engine   │ │ Client    │ │
└────────────────────┘       │  │ (local)  │ │ (remote)  │ │
                             │  └─────┬────┘ └─────┬─────┘ │
                             │  ┌─────▼────────────▼─────┐ │
                             │  │  Crypto Layer          │ │
                             │  │  SHA-256 · BLAKE3      │ │
                             │  │  bs58 · hex · U256     │ │
                             │  └────────────────────────┘ │
                             └──────────────────────────────┘
```

## Features

- **Rust SDK** — Embed the full policy engine directly in your agent's binary. Zero network I/O, sub-microsecond latency.
- **Privacy-Preserving Identity** — Submit agent IDs and recipient addresses as SHA-256 or BLAKE3 hashes. The engine resolves them via constant-time comparison — no plaintext ever crosses the wire.
- **Solana-Native** — Base58 address encoding, lamport arithmetic, PDA seed derivation, cluster ID enforcement (mainnet=101, devnet=102, testnet=103).
- **11-Gate Evaluation Pipeline** — Deterministic, ordered policy checks: kill switch → cluster ID → priority fee → recipient whitelist → instruction selector → agent auth → per-tx limit → daily cap → tx count → wallet cap → atomic commit.
- **Lock-Free Concurrency** — Atomic `u64` counters with `Acquire`/`Release` ordering for multi-threaded agent contexts without mutex contention.
- **Remote Gateway** — Optional HTTP client mode to evaluate transactions against a centralized `priv-tract-server` when shared state is needed.
- **On-Chain Enforcement** — Companion Solana program with Borsh-serialized state, PDA accounts, and daily auto-reset via `Clock` sysvar.

## Prerequisites

- [Rust Toolchain](https://rustup.rs/) (1.75.0 or higher)
- For gateway mode: a running `priv-tract-server` instance

---

## Quick Start — SDK Installation

### Add as a Dependency

```toml
# Cargo.toml
[dependencies]
priv-tract = { git = "https://github.com/aloodamz/Priv-tract-capstone-.git" }
tokio = { version = "1", features = ["full"] }
```

### Or Clone and Build Locally

```bash
git clone https://github.com/aloodamz/Priv-tract-capstone-.git
cd Priv-tract-capstone-
cargo build --release
```

---

## SDK Usage

> [!NOTE]
> For a full end-to-end technical explanation of every function, the cryptographic privacy shields, memory barriers, and the detailed execution flow, see the [SDK Integration & Technical Manual](file:///Users/arindampanigrahi/Desktop/policy-engine%20copy/SDK_DOCUMENTATION.md).

### Mode 1: Embedded Engine (Recommended for Agents)

Load policies from `config.toml` and evaluate transactions locally with zero network dependencies:

```rust
use priv_tract::priv_tract_sdk::*;

fn main() {
    // ── 1. Initialize the SDK from config ──
    let sdk = PrivTractSDK::from_config("config.toml")
        .expect("Failed to load policy config");

    // ── 2. Hash identities for privacy ──
    let agent = sdk.hash_agent_sha256(1);
    let recipient = sdk.hash_address_sha256(
        "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"
    );

    // ── 3. Build the transaction ──
    let tx = SdkTransaction {
        from_agent: agent,
        to: recipient,
        value_lamports: 1_000_000,       // 0.001 SOL
        priority_fee: 5000,              // micro-lamports per CU
        cluster_id: 1,                   // must match config
        instruction_data: None,          // simple transfer
    };

    // ── 4. Evaluate against all 11 policy gates ──
    match sdk.evaluate(&tx) {
        Ok(receipt) => {
            println!("✅ {}", receipt.message);
            println!("   Agent daily spend:  {} lamports", receipt.agent_daily_spend);
            println!("   Wallet daily spend: {} lamports", receipt.wallet_daily_spend);
        }
        Err(e) => {
            eprintln!("❌ {}", e);
        }
    }
}
```

### Mode 2: Remote Gateway Client

Connect to a centralized `priv-tract-server` for multi-agent orchestration:

```rust
use priv_tract::priv_tract_sdk::*;

#[tokio::main]
async fn main() {
    // ── Connect to gateway ──
    let sdk = PrivTractSDK::gateway(
        "http://127.0.0.1:3001",
        Some("my-admin-token".to_string()),
    );

    // ── Validate via HTTP ──
    let tx = SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2".into()),
        value_lamports: 500_000,
        priority_fee: 5000,
        cluster_id: 1,
        instruction_data: None,
    };

    match sdk.evaluate_remote(&tx).await {
        Ok(resp) => println!("✅ {}: {}", resp.status, resp.message),
        Err(e) => eprintln!("❌ {}", e),
    }

    // ── Admin: toggle kill switch remotely ──
    sdk.remote_toggle_kill_switch(true).await.unwrap();

    // ── Admin: register a new agent ──
    sdk.remote_register_agent(2, "0x2000", "0x5000", 20).await.unwrap();
}
```

---

## Cryptographic Privacy Layer

Priv-Tract supports three identity submission modes:

| Mode | Agent ID Format | Recipient Format | Use Case |
|------|----------------|-----------------|----------|
| **Raw** | `AgentId::Raw(1)` | `Recipient::Raw("SRM...")` | Internal / trusted networks |
| **SHA-256** | `sdk.hash_agent_sha256(1)` | `sdk.hash_address_sha256("SRM...")` | Standard privacy |
| **BLAKE3** | `sdk.hash_agent_blake3(1)` | `sdk.hash_address_blake3("SRM...")` | High-throughput privacy |

### How It Works

1. **Client-side**: The SDK hashes the agent ID or address string using SHA-256 or BLAKE3.
2. **Wire format**: The hash is transmitted as `sha256:<64-hex-chars>` or `blake3:<64-hex-chars>`.
3. **Server-side**: The engine iterates over registered agents/addresses, hashing each and comparing using constant-time `ct_hash_eq` to prevent timing attacks.

### Dual Hash Audit

```rust
let (sha_fingerprint, blake_fingerprint) = sdk.dual_hash_agent(1);
println!("SHA-256: {}", sha_fingerprint);
println!("BLAKE3:  {}", blake_fingerprint);
```

---

## Configuration Reference

### `config.toml`

```toml
[wallet]
kill_switch = false
allowed_chain_id = 1                  # Must match SdkTransaction.cluster_id
wallet_tx_limit = "0x1000"            # Max value per single transaction
wallet_daily_cap = "0x10000"          # Wallet-wide daily cumulative cap
max_gas_price_gwei = 100              # Priority fee ceiling
contract_calls_allowed = true         # Enable program instruction validation
recipient_whitelist = [
    "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"
]
function_selector_whitelist = [
    "0xa9059cbb"                      # ERC-20 transfer selector
]

[agents.1]
tx_limit = "0x1000"                   # Per-tx limit for agent 1
daily_cap = "0x1000"                  # Daily spend cap for agent 1
daily_tx_count_limit = 10             # Max transactions per day
```

### Environment Variables (Server Mode)

```bash
export POLICY_SERVER_ADMIN_TOKEN="replace-with-a-long-random-secret"
export POLICY_SERVER_ALLOWED_ORIGINS="http://localhost:5173"
```

---

## SDK API Reference

### Core Types

| Type | Description |
|------|-------------|
| `PrivTractSDK` | Main SDK entry point (embedded or gateway) |
| `SdkTransaction` | Transaction to evaluate |
| `AgentId` | `Raw(u64)` / `Sha256([u8;32])` / `Blake3([u8;32])` |
| `Recipient` | `Raw(String)` / `Sha256([u8;32])` / `Blake3([u8;32])` |
| `EvalReceipt` | Successful evaluation receipt with updated counters |
| `PolicyDenial` | Enum of all 11 denial reasons |
| `SdkError` | Top-level error type |

### SDK Methods

| Method | Description |
|--------|-------------|
| `PrivTractSDK::from_config(path)` | Create embedded SDK from TOML config |
| `PrivTractSDK::gateway(url, token)` | Create gateway SDK pointing at remote server |
| `sdk.evaluate(&tx)` | Evaluate locally (embedded mode) |
| `sdk.evaluate_remote(&tx).await` | Evaluate via HTTP (gateway mode) |
| `sdk.hash_agent_sha256(id)` | Hash agent ID with SHA-256 |
| `sdk.hash_agent_blake3(id)` | Hash agent ID with BLAKE3 |
| `sdk.hash_address_sha256(addr)` | Hash address with SHA-256 |
| `sdk.hash_address_blake3(addr)` | Hash address with BLAKE3 |
| `sdk.dual_hash_agent(id)` | Get both SHA-256 and BLAKE3 fingerprints |
| `sdk.set_kill_switch(bool)` | Toggle kill switch (embedded) |
| `sdk.reset_daily_state()` | Reset all spend counters |
| `sdk.remote_toggle_kill_switch(bool)` | Toggle kill switch (gateway) |
| `sdk.remote_register_agent(...)` | Register agent on remote server |
| `sdk.get_remote_state()` | Fetch full engine state from server |

### Crypto Utility Functions

| Function | Description |
|----------|-------------|
| `sha256_digest(data)` | SHA-256 hash of raw bytes |
| `sha256_str(s)` | SHA-256 hash of a UTF-8 string |
| `blake3_digest(data)` | BLAKE3 hash of raw bytes |
| `blake3_str(s)` | BLAKE3 hash of a UTF-8 string |
| `ct_hash_eq(a, b)` | Constant-time 32-byte comparison |
| `decode_solana_pubkey(s)` | Base58 → `[u8; 32]` |
| `encode_solana_pubkey(bytes)` | `[u8; 32]` → Base58 |
| `pda_seeds_wallet_config(authority)` | PDA seeds for wallet config |
| `pda_seeds_agent_state(agent_id)` | PDA seeds for agent state |

---

## Policy Gate Pipeline

The SDK evaluates transactions through 11 sequential gates. If any gate fails, the transaction is immediately denied with a specific `PolicyDenial` variant:

```
 GATE  │ CHECK                        │ DENIAL CODE
───────┼──────────────────────────────┼─────────────────────────────
  1    │ Kill switch active?           │ KillSwitchActive
  2    │ Cluster/chain ID matches?     │ ClusterIdMismatch
  3    │ Priority fee ≤ ceiling?       │ PriorityFeeTooHigh
  4    │ Recipient in whitelist?       │ RecipientNotWhitelisted
  5    │ Instruction selector valid?   │ InstructionSelectorNotWhitelisted
  6    │ Agent authenticated?          │ AgentNotAuthenticated
  7    │ Value ≤ per-tx limit?         │ TransactionLimitExceeded
  8    │ Agent daily spend OK?         │ AgentDailyCapExceeded
  9    │ Agent daily tx count OK?      │ TransactionCountLimitExceeded
 10    │ Wallet daily spend OK?        │ WalletDailyCapExceeded
 11    │ Atomic counter commit         │ (success)
```

---

## Dashboard Server

```bash
# Set admin credentials
export POLICY_SERVER_ADMIN_TOKEN="replace-with-a-long-random-secret"
export POLICY_SERVER_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# Start both backend and frontend
bash dev.sh
```

- Backend: `http://127.0.0.1:3001`
- Frontend: `http://localhost:5173`

---

## Testing

Run the full test suite including SDK tests:

```bash
cargo test
```

SDK-specific tests:

```bash
cargo test --lib priv_tract_sdk
```

Tests verify:
- SHA-256/BLAKE3 parity between SDK and engine
- Constant-time hash comparison
- Base58 roundtrip encoding
- PDA seed derivation
- All 11 policy gates (approval + denial)
- Daily counter reset behavior
- Instruction selector validation

---

## On-Chain Solana Program

The `solana-program/` directory contains a native Solana BPF program that enforces the same policy logic on-chain:

- **Initialize** — Set up wallet config PDA with admin, limits, and whitelists
- **ToggleKillSwitch** — Admin-only emergency halt
- **RegisterAgent** — Create/update agent state PDAs with individual limits
- **ValidateTransaction** — Full policy enforcement with automatic daily reset via `Clock` sysvar

---

## Disclaimer

This codebase is provided as-is. Administer rigorous auditing of your `config.toml` prior to deploying against mainnet liquidity.
