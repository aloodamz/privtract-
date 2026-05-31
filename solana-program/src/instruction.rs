use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum PolicyInstruction {

    Initialize {
        allowed_cluster_id: u64,
        wallet_tx_limit: u64,
        wallet_daily_cap: u64,
        max_priority_fee: u64,
        contract_calls_allowed: bool,
        recipient_whitelist: Vec<Pubkey>,
        function_selector_whitelist: Vec<Vec<u8>>,
    },

    /// Toggles the emergency kill switch.
    ///
    /// Accounts expected:
    /// 1. `[writable]` The config account
    /// 2. `[signer]` The admin signer
    ToggleKillSwitch {
        active: bool,
    },

    /// Registers or updates an agent's policy bounds.
    ///
    /// Accounts expected:
    /// 1. `[writable]` The AgentState account (usually a PDA of [b"agent", agent_id])
    /// 2. `[signer]` The admin signer
    /// 3. `[]` System program
    RegisterAgent {
        agent_id: u64,
        tx_limit: u64,
        daily_cap: u64,
        daily_tx_count_limit: u64,
    },

    /// Validates a transaction request against policies and updates spending logs.
    ///
    /// Accounts expected:
    /// 1. `[writable]` The config account
    /// 2. `[writable]` The AgentState account
    /// 3. `[]` The Clock sysvar (for daily reset timing check)
    ValidateTransaction {
        agent_id: u64,
        value: u64,
        priority_fee: u64,
        cluster_id: u64,
        recipient: Pubkey,
        calldata: Option<Vec<u8>>,
    },
}
