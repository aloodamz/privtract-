use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct WalletConfig {
    pub admin: Pubkey,
    pub kill_switch: bool,
    pub allowed_cluster_id: u64,
    pub wallet_tx_limit: u64,
    pub wallet_daily_cap: u64,
    pub wallet_daily_spend: u64,
    pub last_reset_timestamp: i64,
    pub max_priority_fee: u64,
    pub contract_calls_allowed: bool,
    pub recipient_whitelist: Vec<Pubkey>,
    pub function_selector_whitelist: Vec<Vec<u8>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct AgentState {
    pub agent_id: u64,
    pub tx_limit: u64,
    pub daily_cap: u64,
    pub daily_spend: u64,
    pub daily_tx_count_limit: u64,
    pub daily_tx_count: u64,
    pub last_reset_timestamp: i64,
}
