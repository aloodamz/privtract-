#[cfg(test)]
mod tests;

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest as Sha2Digest};
use thiserror::Error;

pub type Hash256 = [u8; 32];

#[inline]
pub fn sha256_digest(data: &[u8]) -> Hash256 {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

#[inline]
pub fn sha256_str(s: &str) -> Hash256 {
    sha256_digest(s.as_bytes())
}

#[inline]
pub fn blake3_digest(data: &[u8]) -> Hash256 {
    *blake3::hash(data).as_bytes()
}

#[inline]
pub fn blake3_str(s: &str) -> Hash256 {
    blake3_digest(s.as_bytes())
}

#[inline]
pub fn ct_hash_eq(a: &Hash256, b: &Hash256) -> bool {
    let mut acc: u8 = 0;
    for i in 0..32 {
        acc |= a[i] ^ b[i];
    }
    acc == 0
}

#[inline]
pub fn fmt_sha256(h: &Hash256) -> String {
    format!("sha256:{}", hex::encode(h))
}

#[inline]
pub fn fmt_blake3(h: &Hash256) -> String {
    format!("blake3:{}", hex::encode(h))
}

pub fn decode_solana_pubkey(s: &str) -> Result<[u8; 32], SdkError> {
    let bytes = bs58::decode(s.trim())
        .into_vec()
        .map_err(|e| SdkError::InvalidAddress(format!("base58 decode: {e}")))?;
    if bytes.len() != 32 {
        return Err(SdkError::InvalidAddress(format!(
            "expected 32 bytes, got {}", bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(arr)
}

#[inline]
pub fn encode_solana_pubkey(bytes: &[u8; 32]) -> String {
    bs58::encode(bytes).into_string()
}

pub fn pda_seeds_wallet_config(authority: &[u8; 32]) -> Vec<Vec<u8>> {
    vec![
        b"wallet-config".to_vec(),
        authority.to_vec(),
    ]
}

pub fn pda_seeds_agent_state(agent_id: u64) -> Vec<Vec<u8>> {
    vec![
        b"agent-state".to_vec(),
        agent_id.to_le_bytes().to_vec(),
    ]
}

#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyDenial {
    #[error("DENIED: Global emergency kill-switch is active. All transactions halted.")]
    KillSwitchActive,
    #[error("DENIED: Agent identity not authenticated. Hash does not match any registered agent.")]
    AgentNotAuthenticated,
    #[error("DENIED: Recipient address/hash not found in the allowlist.")]
    RecipientNotWhitelisted,
    #[error("DENIED: Transaction value exceeds the per-transaction limit.")]
    TransactionLimitExceeded,
    #[error("DENIED: Agent cumulative daily spend would exceed daily cap.")]
    AgentDailyCapExceeded,
    #[error("DENIED: Wallet-wide cumulative daily spend cap exceeded.")]
    WalletDailyCapExceeded,
    #[error("DENIED: Target cluster/chain ID does not match the configured network.")]
    ClusterIdMismatch,
    #[error("DENIED: Priority fee exceeds the maximum allowed ceiling.")]
    PriorityFeeTooHigh,
    #[error("DENIED: Program instruction calls are globally disabled.")]
    InstructionCallsNotAllowed,
    #[error("DENIED: Instruction discriminator not in the approved selector list.")]
    InstructionSelectorNotWhitelisted,
    #[error("DENIED: Agent daily transaction count limit reached.")]
    TransactionCountLimitExceeded,
}

#[derive(Error, Debug)]
pub enum SdkError {
    #[error("Config load error: {0}")]
    ConfigLoad(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Invalid hex: {0}")]
    InvalidHex(String),
    #[error("Policy denied: {0}")]
    PolicyDenied(#[from] PolicyDenial),
    #[error("Gateway error: {0}")]
    GatewayError(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentId {
    Raw(u64),
    Sha256(Hash256),
    Blake3(Hash256),
}

impl AgentId {
    pub fn to_wire(&self) -> String {
        match self {
            AgentId::Raw(id) => id.to_string(),
            AgentId::Sha256(h) => fmt_sha256(h),
            AgentId::Blake3(h) => fmt_blake3(h),
        }
    }

    pub fn from_sha256(agent_id: u64) -> Self {
        AgentId::Sha256(sha256_str(&agent_id.to_string()))
    }

    pub fn from_blake3(agent_id: u64) -> Self {
        AgentId::Blake3(blake3_str(&agent_id.to_string()))
    }
}

impl std::str::FromStr for AgentId {
    type Err = SdkError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();
        if let Some(h) = s.strip_prefix("sha256:") {
            let bytes = hex::decode(h).map_err(|e| SdkError::InvalidHex(e.to_string()))?;
            if bytes.len() != 32 {
                return Err(SdkError::InvalidHex("invalid sha256 hash length".to_string()));
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            Ok(AgentId::Sha256(arr))
        } else if let Some(h) = s.strip_prefix("blake3:") {
            let bytes = hex::decode(h).map_err(|e| SdkError::InvalidHex(e.to_string()))?;
            if bytes.len() != 32 {
                return Err(SdkError::InvalidHex("invalid blake3 hash length".to_string()));
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            Ok(AgentId::Blake3(arr))
        } else {
            let id = s.parse::<u64>().map_err(|e| SdkError::ConfigLoad(e.to_string()))?;
            Ok(AgentId::Raw(id))
        }
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum AgentIdOrStr {
    Int(u64),
    Str(String),
}

impl<'de> Deserialize<'de> for AgentId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let helper = AgentIdOrStr::deserialize(deserializer)?;
        match helper {
            AgentIdOrStr::Int(v) => Ok(AgentId::Raw(v)),
            AgentIdOrStr::Str(s) => std::str::FromStr::from_str(&s).map_err(serde::de::Error::custom),
        }
    }
}

impl Serialize for AgentId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_wire())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Recipient {
    Raw(String),
    Sha256(Hash256),
    Blake3(Hash256),
}

impl Recipient {
    pub fn to_wire(&self) -> String {
        match self {
            Recipient::Raw(s) => s.clone(),
            Recipient::Sha256(h) => fmt_sha256(h),
            Recipient::Blake3(h) => fmt_blake3(h),
        }
    }

    pub fn from_sha256(address: &str) -> Self {
        Recipient::Sha256(sha256_str(address))
    }

    pub fn from_blake3(address: &str) -> Self {
        Recipient::Blake3(blake3_str(address))
    }
}

impl std::str::FromStr for Recipient {
    type Err = SdkError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();
        if let Some(h) = s.strip_prefix("sha256:") {
            let bytes = hex::decode(h).map_err(|e| SdkError::InvalidHex(e.to_string()))?;
            if bytes.len() != 32 {
                return Err(SdkError::InvalidHex("invalid sha256 hash length".to_string()));
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            Ok(Recipient::Sha256(arr))
        } else if let Some(h) = s.strip_prefix("blake3:") {
            let bytes = hex::decode(h).map_err(|e| SdkError::InvalidHex(e.to_string()))?;
            if bytes.len() != 32 {
                return Err(SdkError::InvalidHex("invalid blake3 hash length".to_string()));
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&bytes);
            Ok(Recipient::Blake3(arr))
        } else {
            let bytes = bs58::decode(s).into_vec().map_err(|e| SdkError::InvalidAddress(e.to_string()))?;
            if bytes.len() != 32 {
                return Err(SdkError::InvalidAddress(format!("expected 32-byte Solana pubkey, got {} bytes", bytes.len())));
            }
            Ok(Recipient::Raw(s.to_string()))
        }
    }
}

impl<'de> Deserialize<'de> for Recipient {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        std::str::FromStr::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl Serialize for Recipient {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_wire())
    }
}

fn deserialize_value_u64<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Val {
        Int(u64),
        Str(String),
    }

    let val = Val::deserialize(deserializer)?;
    match val {
        Val::Int(v) => Ok(v),
        Val::Str(s) => {
            let s = s.trim();
            if let Some(h) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
                u64::from_str_radix(h, 16).map_err(serde::de::Error::custom)
            } else {
                s.parse::<u64>().map_err(serde::de::Error::custom)
            }
        }
    }
}

fn serialize_value_u64<S>(val: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&val.to_string())
}

fn deserialize_calldata<'de, D>(deserializer: D) -> Result<Option<Vec<u8>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt: Option<String> = serde::Deserialize::deserialize(deserializer)?;
    match opt {
        Some(s) if !s.is_empty() => {
            let clean = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")).unwrap_or(&s);
            hex::decode(clean)
                .map(Some)
                .map_err(serde::de::Error::custom)
        }
        _ => Ok(None),
    }
}

fn serialize_calldata<S>(opt: &Option<Vec<u8>>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match opt {
        Some(bytes) => serializer.serialize_some(&format!("0x{}", hex::encode(bytes))),
        None => serializer.serialize_none(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkTransaction {
    pub from_agent: AgentId,
    pub to: Recipient,
    #[serde(rename = "value", deserialize_with = "deserialize_value_u64", serialize_with = "serialize_value_u64")]
    pub value_lamports: u64,
    #[serde(rename = "gas_price_gwei")]
    pub priority_fee: u64,
    #[serde(rename = "chain_id")]
    pub cluster_id: u64,
    #[serde(
        rename = "calldata",
        default,
        deserialize_with = "deserialize_calldata",
        serialize_with = "serialize_calldata"
    )]
    pub instruction_data: Option<Vec<u8>>,
}

impl SdkTransaction {
    #[must_use]
    pub fn builder() -> SdkTransactionBuilder {
        SdkTransactionBuilder::default()
    }
}

#[derive(Debug, Default)]
pub struct SdkTransactionBuilder {
    from_agent: Option<AgentId>,
    to: Option<Recipient>,
    value_lamports: Option<u64>,
    priority_fee: Option<u64>,
    cluster_id: Option<u64>,
    instruction_data: Option<Vec<u8>>,
}

impl SdkTransactionBuilder {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn from_agent(mut self, from_agent: AgentId) -> Self {
        self.from_agent = Some(from_agent);
        self
    }

    #[must_use]
    pub fn to(mut self, to: Recipient) -> Self {
        self.to = Some(to);
        self
    }

    #[must_use]
    pub fn value_lamports(mut self, value_lamports: u64) -> Self {
        self.value_lamports = Some(value_lamports);
        self
    }

    #[must_use]
    pub fn priority_fee(mut self, priority_fee: u64) -> Self {
        self.priority_fee = Some(priority_fee);
        self
    }

    #[must_use]
    pub fn cluster_id(mut self, cluster_id: u64) -> Self {
        self.cluster_id = Some(cluster_id);
        self
    }

    #[must_use]
    pub fn instruction_data(mut self, instruction_data: Vec<u8>) -> Self {
        self.instruction_data = Some(instruction_data);
        self
    }

    pub fn build(self) -> Result<SdkTransaction, SdkError> {
        let from_agent = self.from_agent.ok_or_else(|| SdkError::ConfigLoad("Missing from_agent".into()))?;
        let to = self.to.ok_or_else(|| SdkError::ConfigLoad("Missing to".into()))?;
        let value_lamports = self.value_lamports.unwrap_or(0);
        let priority_fee = self.priority_fee.unwrap_or(0);
        let cluster_id = self.cluster_id.ok_or_else(|| SdkError::ConfigLoad("Missing cluster_id".into()))?;
        Ok(SdkTransaction {
            from_agent,
            to,
            value_lamports,
            priority_fee,
            cluster_id,
            instruction_data: self.instruction_data,
        })
    }
}

#[derive(Debug, Clone)]
pub struct EvalReceipt {
    pub approved: bool,
    pub message: String,
    pub agent_daily_spend: u64,
    pub agent_daily_tx_count: u64,
    pub wallet_daily_spend: u64,
}

#[derive(Debug, Clone)]
pub struct SdkAgentConfig {
    pub tx_limit: u64,
    pub daily_cap: u64,
    pub daily_tx_count_limit: u64,
}

#[derive(Debug, Default)]
pub struct SdkAgentState {
    pub daily_spend: AtomicU64,
    pub daily_tx_count: AtomicU64,
    pub sol_balance: AtomicU64,
    pub usdc_balance: AtomicU64,
    pub bonk_balance: AtomicU64,
}

#[derive(Debug)]
pub struct SdkWalletConfig {
    pub kill_switch: AtomicBool,
    pub allowed_chain_id: u64,
    pub wallet_tx_limit: u64,
    pub wallet_daily_cap: u64,
    pub max_priority_fee: u64,
    pub contract_calls_allowed: bool,
    pub recipient_whitelist: HashSet<[u8; 32]>,
    pub function_selector_whitelist: HashSet<Vec<u8>>,
}

#[derive(Deserialize)]
struct RawConfigFile {
    wallet: RawWallet,
    agents: HashMap<String, RawAgent>,
}

#[derive(Deserialize)]
struct RawWallet {
    kill_switch: bool,
    allowed_chain_id: u64,
    wallet_tx_limit: String,
    wallet_daily_cap: String,
    max_gas_price_gwei: u64,
    contract_calls_allowed: bool,
    recipient_whitelist: Vec<String>,
    function_selector_whitelist: Vec<String>,
}

#[derive(Deserialize)]
struct RawAgent {
    tx_limit: String,
    daily_cap: String,
    daily_tx_count_limit: u64,
}

fn parse_limit_value(s: &str) -> Result<u64, SdkError> {
    let s = s.trim();
    if let Some(h) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(h, 16)
            .map_err(|e| SdkError::ConfigLoad(format!("bad hex limit '{}': {}", s, e)))
    } else {
        s.parse::<u64>()
            .map_err(|e| SdkError::ConfigLoad(format!("bad decimal limit '{}': {}", s, e)))
    }
}

fn decode_hex_selector(s: &str) -> Result<Vec<u8>, SdkError> {
    let clean = s.strip_prefix("0x")
        .or_else(|| s.strip_prefix("0X"))
        .unwrap_or(s);
    hex::decode(clean)
        .map_err(|e| SdkError::InvalidHex(format!("selector '{}': {}", s, e)))
}

pub trait SdkMode: std::fmt::Debug + Send + Sync {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Embedded;
impl SdkMode for Embedded {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Gateway;
impl SdkMode for Gateway {}

pub struct PrivTractSDK<M: SdkMode = Embedded> {
    pub wallet: Option<SdkWalletConfig>,
    pub agents: HashMap<u64, (SdkAgentConfig, SdkAgentState)>,
    pub wallet_daily_spend: AtomicU64,
    pub server_url: Option<String>,
    pub admin_token: Option<String>,
    pub http_client: reqwest::Client,
    _mode: std::marker::PhantomData<M>,
}

impl<M: SdkMode> PrivTractSDK<M> {
    pub fn wallet(&self) -> Option<&SdkWalletConfig> {
        self.wallet.as_ref()
    }

    pub fn agents(&self) -> &HashMap<u64, (SdkAgentConfig, SdkAgentState)> {
        &self.agents
    }

    pub fn wallet_daily_spend(&self) -> u64 {
        self.wallet_daily_spend.load(Ordering::Acquire)
    }

    pub fn hash_agent_sha256(&self, agent_id: u64) -> AgentId {
        AgentId::from_sha256(agent_id)
    }

    pub fn hash_agent_blake3(&self, agent_id: u64) -> AgentId {
        AgentId::from_blake3(agent_id)
    }

    pub fn hash_address_sha256(&self, address: &str) -> Recipient {
        Recipient::from_sha256(address)
    }

    pub fn hash_address_blake3(&self, address: &str) -> Recipient {
        Recipient::from_blake3(address)
    }

    pub fn dual_hash_agent(&self, agent_id: u64) -> (String, String) {
        let id_str = agent_id.to_string();
        (fmt_sha256(&sha256_str(&id_str)), fmt_blake3(&blake3_str(&id_str)))
    }
}

impl PrivTractSDK<Embedded> {
    pub fn from_config(path: &str) -> Result<Self, SdkError> {
        let raw_text = std::fs::read_to_string(path)
            .map_err(|e| SdkError::ConfigLoad(format!("{}: {}", path, e)))?;

        let raw: RawConfigFile = toml::from_str(&raw_text)
            .map_err(|e| SdkError::ConfigLoad(format!("TOML parse: {e}")))?;

        let mut whitelist = HashSet::new();
        for addr_str in &raw.wallet.recipient_whitelist {
            let pubkey = decode_solana_pubkey(addr_str)?;
            whitelist.insert(pubkey);
        }

        let mut selectors = HashSet::new();
        for sel_str in &raw.wallet.function_selector_whitelist {
            let sel_bytes = decode_hex_selector(sel_str)?;
            selectors.insert(sel_bytes);
        }

        let wallet_cfg = SdkWalletConfig {
            kill_switch: AtomicBool::new(raw.wallet.kill_switch),
            allowed_chain_id: raw.wallet.allowed_chain_id,
            wallet_tx_limit: parse_limit_value(&raw.wallet.wallet_tx_limit)?,
            wallet_daily_cap: parse_limit_value(&raw.wallet.wallet_daily_cap)?,
            max_priority_fee: raw.wallet.max_gas_price_gwei,
            contract_calls_allowed: raw.wallet.contract_calls_allowed,
            recipient_whitelist: whitelist,
            function_selector_whitelist: selectors,
        };

        let mut agents_map = HashMap::new();
        for (id_str, raw_agent) in &raw.agents {
            let id: u64 = id_str.parse()
                .map_err(|e| SdkError::ConfigLoad(format!("bad agent id '{}': {}", id_str, e)))?;
            let cfg = SdkAgentConfig {
                tx_limit: parse_limit_value(&raw_agent.tx_limit)?,
                daily_cap: parse_limit_value(&raw_agent.daily_cap)?,
                daily_tx_count_limit: raw_agent.daily_tx_count_limit,
            };
            agents_map.insert(id, (cfg, SdkAgentState::default()));
        }

        Ok(Self {
            wallet: Some(wallet_cfg),
            agents: agents_map,
            wallet_daily_spend: AtomicU64::new(0),
            server_url: None,
            admin_token: None,
            http_client: reqwest::Client::new(),
            _mode: std::marker::PhantomData,
        })
    }

    #[must_use]
    pub fn evaluate(&self, tx: &SdkTransaction) -> Result<EvalReceipt, SdkError> {
        let wallet = self.wallet.as_ref()
            .ok_or_else(|| SdkError::ConfigLoad(
                "SDK not in embedded mode — call from_config()".into()
            ))?;

        if wallet.kill_switch.load(Ordering::Acquire) {
            return Err(SdkError::PolicyDenied(PolicyDenial::KillSwitchActive));
        }

        if tx.cluster_id != wallet.allowed_chain_id {
            return Err(SdkError::PolicyDenied(PolicyDenial::ClusterIdMismatch));
        }

        if tx.priority_fee > wallet.max_priority_fee {
            return Err(SdkError::PolicyDenied(PolicyDenial::PriorityFeeTooHigh));
        }

        let recipient_ok = match &tx.to {
            Recipient::Raw(addr_str) => {
                match decode_solana_pubkey(addr_str) {
                    Ok(pubkey) => wallet.recipient_whitelist.contains(&pubkey),
                    Err(_) => false,
                }
            }
            Recipient::Sha256(submitted_hash) => {
                wallet.recipient_whitelist.iter().any(|raw_pubkey| {
                    let addr_str = encode_solana_pubkey(raw_pubkey);
                    let computed = sha256_str(&addr_str);
                    ct_hash_eq(&computed, submitted_hash)
                })
            }
            Recipient::Blake3(submitted_hash) => {
                wallet.recipient_whitelist.iter().any(|raw_pubkey| {
                    let addr_str = encode_solana_pubkey(raw_pubkey);
                    let computed = blake3_str(&addr_str);
                    ct_hash_eq(&computed, submitted_hash)
                })
            }
        };
        if !recipient_ok {
            return Err(SdkError::PolicyDenied(PolicyDenial::RecipientNotWhitelisted));
        }

        if let Some(data) = &tx.instruction_data {
            if !wallet.contract_calls_allowed {
                return Err(SdkError::PolicyDenied(PolicyDenial::InstructionCallsNotAllowed));
            }
            let matched = wallet.function_selector_whitelist.iter().any(|sel| {
                data.starts_with(sel)
            });
            if !matched {
                return Err(SdkError::PolicyDenied(PolicyDenial::InstructionSelectorNotWhitelisted));
            }
        }

        let agent_id = match &tx.from_agent {
            AgentId::Raw(id) => {
                if !self.agents.contains_key(id) {
                    return Err(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated));
                }
                *id
            }
            AgentId::Sha256(submitted_hash) => {
                let found = self.agents.keys().find(|&&id| {
                    let computed = sha256_str(&id.to_string());
                    ct_hash_eq(&computed, submitted_hash)
                });
                match found {
                    Some(&id) => id,
                    None => return Err(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated)),
                }
            }
            AgentId::Blake3(submitted_hash) => {
                let found = self.agents.keys().find(|&&id| {
                    let computed = blake3_str(&id.to_string());
                    ct_hash_eq(&computed, submitted_hash)
                });
                match found {
                    Some(&id) => id,
                    None => return Err(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated)),
                }
            }
        };

        let (agent_cfg, agent_state) = self.agents.get(&agent_id)
            .ok_or(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated))?;
        let value = tx.value_lamports;

        let limit = std::cmp::min(agent_cfg.tx_limit, wallet.wallet_tx_limit);
        if value > limit {
            return Err(SdkError::PolicyDenied(PolicyDenial::TransactionLimitExceeded));
        }

        let current_agent_spend = agent_state.daily_spend.load(Ordering::Acquire);
        if current_agent_spend + value > agent_cfg.daily_cap {
            return Err(SdkError::PolicyDenied(PolicyDenial::AgentDailyCapExceeded));
        }

        let current_agent_tx_count = agent_state.daily_tx_count.load(Ordering::Acquire);
        if current_agent_tx_count + 1 > agent_cfg.daily_tx_count_limit {
            return Err(SdkError::PolicyDenied(PolicyDenial::TransactionCountLimitExceeded));
        }

        let current_wallet_spend = self.wallet_daily_spend.load(Ordering::Acquire);
        if current_wallet_spend + value > wallet.wallet_daily_cap {
            return Err(SdkError::PolicyDenied(PolicyDenial::WalletDailyCapExceeded));
        }

        let new_agent_spend = agent_state.daily_spend.fetch_add(value, Ordering::AcqRel) + value;
        let new_agent_count = agent_state.daily_tx_count.fetch_add(1, Ordering::AcqRel) + 1;
        let new_wallet_spend = self.wallet_daily_spend.fetch_add(value, Ordering::AcqRel) + value;

        Ok(EvalReceipt {
            approved: true,
            message: format!(
                "Transaction APPROVED — {} lamports ({:.4} SOL) from agent {} to {}",
                value,
                value as f64 / 1_000_000_000.0,
                agent_id,
                tx.to.to_wire(),
            ),
            agent_daily_spend: new_agent_spend,
            agent_daily_tx_count: new_agent_count,
            wallet_daily_spend: new_wallet_spend,
        })
    }

    pub fn reset_daily_state(&self) {
        self.wallet_daily_spend.store(0, Ordering::Release);
        for (_, (_, state)) in &self.agents {
            state.daily_spend.store(0, Ordering::Release);
            state.daily_tx_count.store(0, Ordering::Release);
        }
    }

    pub fn set_kill_switch(&self, active: bool) {
        if let Some(ref wallet) = self.wallet {
            wallet.kill_switch.store(active, Ordering::Release);
        }
    }
}

impl PrivTractSDK<Gateway> {
    pub fn gateway(server_url: &str, admin_token: Option<String>) -> Self {
        Self {
            wallet: None,
            agents: HashMap::new(),
            wallet_daily_spend: AtomicU64::new(0),
            server_url: Some(server_url.trim_end_matches('/').to_string()),
            admin_token,
            http_client: reqwest::Client::new(),
            _mode: std::marker::PhantomData,
        }
    }

    pub async fn evaluate_remote(&self, tx: &SdkTransaction) -> Result<GatewayResponse, SdkError> {
        let base = self.server_url.as_ref()
            .ok_or_else(|| SdkError::GatewayError("No server URL configured".into()))?;

        let payload = serde_json::json!({
            "from_agent": tx.from_agent.to_wire(),
            "to": tx.to.to_wire(),
            "value": tx.value_lamports.to_string(),
            "gas_price_gwei": tx.priority_fee,
            "chain_id": tx.cluster_id,
            "calldata": tx.instruction_data.as_ref().map(|d| format!("0x{}", hex::encode(d))),
        });

        let resp = self.http_client
            .post(format!("{}/api/validate", base))
            .json(&payload)
            .send()
            .await
            .map_err(|e| SdkError::GatewayError(format!("HTTP request failed: {e}")))?;

        let status = resp.status();
        let body: GatewayResponse = resp.json().await
            .map_err(|e| SdkError::GatewayError(format!("Response parse error: {e}")))?;

        if status.is_success() {
            Ok(body)
        } else {
            Err(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated))
        }
    }

    pub async fn get_remote_state(&self) -> Result<RemoteState, SdkError> {
        let base = self.server_url.as_ref()
            .ok_or_else(|| SdkError::GatewayError("No server URL configured".into()))?;

        let resp = self.http_client
            .get(format!("{}/api/state", base))
            .send()
            .await
            .map_err(|e| SdkError::GatewayError(format!("HTTP: {e}")))?;

        resp.json::<RemoteState>().await
            .map_err(|e| SdkError::GatewayError(format!("Parse: {e}")))
    }

    pub async fn remote_toggle_kill_switch(&self, active: bool) -> Result<GatewayResponse, SdkError> {
        let base = self.server_url.as_ref()
            .ok_or_else(|| SdkError::GatewayError("No server URL configured".into()))?;
        let token = self.admin_token.as_ref()
            .ok_or_else(|| SdkError::GatewayError("Admin token not configured".into()))?;

        let resp = self.http_client
            .post(format!("{}/api/kill-switch", base))
            .header("x-admin-token", token)
            .json(&serde_json::json!({ "active": active }))
            .send()
            .await
            .map_err(|e| SdkError::GatewayError(format!("HTTP: {e}")))?;

        resp.json::<GatewayResponse>().await
            .map_err(|e| SdkError::GatewayError(format!("Parse: {e}")))
    }

    pub async fn remote_register_agent(
        &self,
        agent_id: u64,
        tx_limit: &str,
        daily_cap: &str,
        daily_tx_count_limit: u64,
    ) -> Result<GatewayResponse, SdkError> {
        let base = self.server_url.as_ref()
            .ok_or_else(|| SdkError::GatewayError("No server URL configured".into()))?;
        let token = self.admin_token.as_ref()
            .ok_or_else(|| SdkError::GatewayError("Admin token not configured".into()))?;

        let resp = self.http_client
            .post(format!("{}/api/agents", base))
            .header("x-admin-token", token)
            .json(&serde_json::json!({
                "id": agent_id,
                "tx_limit": tx_limit,
                "daily_cap": daily_cap,
                "daily_tx_count_limit": daily_tx_count_limit,
            }))
            .send()
            .await
            .map_err(|e| SdkError::GatewayError(format!("HTTP: {e}")))?;

        resp.json::<GatewayResponse>().await
            .map_err(|e| SdkError::GatewayError(format!("Parse: {e}")))
    }

    pub async fn remote_update_policies(
        &self,
        policies: serde_json::Value,
    ) -> Result<GatewayResponse, SdkError> {
        let base = self.server_url.as_ref()
            .ok_or_else(|| SdkError::GatewayError("No server URL configured".into()))?;
        let token = self.admin_token.as_ref()
            .ok_or_else(|| SdkError::GatewayError("Admin token not configured".into()))?;

        let resp = self.http_client
            .post(format!("{}/api/policies", base))
            .header("x-admin-token", token)
            .json(&policies)
            .send()
            .await
            .map_err(|e| SdkError::GatewayError(format!("HTTP: {e}")))?;

        resp.json::<GatewayResponse>().await
            .map_err(|e| SdkError::GatewayError(format!("Parse: {e}")))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayResponse {
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAgentInfo {
    pub tx_limit: String,
    pub daily_cap: String,
    pub daily_spend: String,
    pub daily_tx_count_limit: u64,
    pub daily_tx_count: u64,
    pub sha256_hash: String,
    pub blake3_hash: String,
    pub sol_balance: String,
    pub usdc_balance: String,
    pub bonk_balance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteState {
    pub wallet_daily_spend: String,
    pub wallet_daily_cap: String,
    pub wallet_tx_limit: String,
    pub kill_switch: bool,
    pub allowed_chain_id: u64,
    pub max_gas_price_gwei: u64,
    pub contract_calls_allowed: bool,
    pub recipient_whitelist: Vec<String>,
    pub function_selector_whitelist: Vec<String>,
    pub agents: HashMap<String, RemoteAgentInfo>,
    pub admin_controls_configured: bool,
}
