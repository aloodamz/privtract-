# Solana Policy Program

This is the on-chain smart contract for the Policy Engine on Solana. It replicates the deterministic boundary checks of the Policy Engine on-chain, acting as a gatekeeper for agent transactions.

## Program Architecture

The program maintains two state accounts:
1. **`WalletConfig`**: Stores global wallet policies (Kill switch, cumulative limits, daily caps, and recipient/selector whitelists).
2. **`AgentState`**: Tracks daily spending bounds and counts for each individual Agent PDA.

## Directory Structure

- `src/lib.rs`: Entrypoint routing instructions.
- `src/state.rs`: Serialization of config and agent accounts using Borsh.
- `src/instruction.rs`: Definitions of initialize, toggle-kill, update config, register agent, and validate instructions.
- `src/processor.rs`: Enforces policy state machines, limits, and clocks.

## How to Build & Deploy

Ensure you have the [Solana Tool Suite](https://docs.solanapay.com/developing/intro/install-sdk) installed.

### 1. Build the Program
To build the BPF/SBF bytecode target:
```bash
cargo build-sbf
```
The compiled program bytecode will be output to `target/deploy/solana_policy_program.so`.

### 2. Deploy to Devnet/Localnet
Start a local validator if deploying locally:
```bash
solana-test-validator
```

Deploy the program:
```bash
solana program deploy target/deploy/solana_policy_program.so
```
This returns a **Program ID** (e.g., `3M95ZfVb1iU8dK5nFjL3298hV8V1b2y2j...`).

## Instruction Payload Layouts

### 1. Initialize
Sets up the initial limits and whitelist keys.
- **Accounts**:
  1. `[writable]` Configuration PDA/Keypair.
  2. `[signer]` Administrator.
  3. `[]` System Program.

### 2. Register Agent
Initializes policy bounds for a specific agent.
- **Accounts**:
  1. `[writable]` Agent PDA (derived from `[b"agent", agent_id]`).
  2. `[signer]` Admin.
  3. `[]` System Program.

### 3. Validate Transaction
Simulates a transaction spend. If any limits are breached, it reverts with custom errors:
- `1`: Kill Switch Active
- `2`: Cluster ID Mismatch
- `3`: Priority Fee Ceiling Breached
- `4`: Recipient Not Whitelisted
- `5`: Program Calls Blocked
- `6`: Instruction Not Whitelisted
- `7`: Agent Mismatch
- `8`: Single Transaction limit breached
- `9`: Daily Agent Cap breached
- `10`: Daily Agent Count limit breached
- `11`: Daily Wallet Cap breached
