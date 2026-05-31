use priv_tract::{
    PrivTractSDK, SdkTransaction, AgentId, Recipient, SdkError, PolicyDenial
};
use std::fs;
use std::path::PathBuf;

fn create_temp_config(name: &str, content: &str) -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(name);
    fs::write(&path, content).expect("Failed to write temp config");
    path
}

fn hex_to_bytes(s: &str) -> Vec<u8> {
    let s = s.strip_prefix("0x").unwrap_or(s);
    hex::decode(s).unwrap()
}

fn default_tx() -> SdkTransaction {
    SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2".to_string()),
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 102,
        instruction_data: None,
    }
}

const TEST_CONFIG: &str = r#"
[wallet]
kill_switch = false
allowed_chain_id = 102
wallet_tx_limit = "0x1000"
wallet_daily_cap = "0x10000"
max_gas_price_gwei = 100
contract_calls_allowed = true
recipient_whitelist = ["SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"]
function_selector_whitelist = ["0xa9059cbb"]

[agents.1]
tx_limit = "0x1000"
daily_cap = "0x1000"
daily_tx_count_limit = 10

[agents.2]
tx_limit = "0x50"
daily_cap = "0x50"
daily_tx_count_limit = 1
"#;

#[test]
fn test_approved_transaction() {
    let config_path = create_temp_config("test_approved.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let tx = default_tx();
    assert!(engine.evaluate(&tx).is_ok());
}

#[test]
fn test_unwhitelisted_recipient() {
    let config_path = create_temp_config("test_bad_recipient.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.to = Recipient::Raw("SysvarC1ock11111111111111111111111111111111".to_string());
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::RecipientNotWhitelisted))
    ));
}

#[test]
fn test_gas_too_high() {
    let config_path = create_temp_config("test_bad_gas.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.priority_fee = 150;
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::PriorityFeeTooHigh))
    ));
}

#[test]
fn test_chain_id_mismatch() {
    let config_path = create_temp_config("test_bad_chain.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.cluster_id = 99;
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::ClusterIdMismatch))
    ));
}

#[test]
fn test_agent_tx_limit() {
    let config_path = create_temp_config("test_agent_tx_limit.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.value_lamports = 5000;
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::TransactionLimitExceeded))
    ));
}

#[test]
fn test_agent_daily_cap_and_count() {
    let config_path = create_temp_config("test_agent_daily.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();

    let mut tx = default_tx();
    tx.from_agent = AgentId::Raw(2);
    tx.value_lamports = 50;

    assert!(engine.evaluate(&tx).is_ok());

    let mut tx2 = default_tx();
    tx2.from_agent = AgentId::Raw(2);
    tx2.value_lamports = 10;
    assert!(matches!(
        engine.evaluate(&tx2),
        Err(SdkError::PolicyDenied(PolicyDenial::TransactionCountLimitExceeded))
    ));
}

#[test]
fn test_contract_call_valid_selector() {
    let config_path = create_temp_config("test_calldata_valid.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.instruction_data = Some(hex_to_bytes("0xa9059cbb000000000000000000000000"));
    assert!(engine.evaluate(&tx).is_ok());
}

#[test]
fn test_contract_call_invalid_selector() {
    let config_path = create_temp_config("test_calldata_invalid.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let mut tx = default_tx();
    tx.instruction_data = Some(hex_to_bytes("0xdeadbeef000000000000000000000000"));
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::InstructionSelectorNotWhitelisted))
    ));
}

#[test]
fn test_kill_switch() {
    let config_with_kill = r#"
[wallet]
kill_switch = true
allowed_chain_id = 102
wallet_tx_limit = "0x1000"
wallet_daily_cap = "0x10000"
max_gas_price_gwei = 100
contract_calls_allowed = true
recipient_whitelist = ["SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"]
function_selector_whitelist = ["0xa9059cbb"]

[agents.1]
tx_limit = "0x1000"
daily_cap = "0x1000"
daily_tx_count_limit = 10
    "#;
    let config_path = create_temp_config("test_killswitch.toml", config_with_kill);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let tx = default_tx();
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::KillSwitchActive))
    ));
}

const TEST_SOLANA_CONFIG: &str = r#"
[wallet]
kill_switch = false
allowed_chain_id = 102
wallet_tx_limit = "5000000000"
wallet_daily_cap = "100000000000"
max_gas_price_gwei = 1000000
contract_calls_allowed = true
recipient_whitelist = ["SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"]
function_selector_whitelist = ["f0867823f663d2dc"]

[agents.1]
tx_limit = "50000000"
daily_cap = "100000000"
daily_tx_count_limit = 5
"#;

#[test]
fn test_solana_approved_transaction() {
    let config_path = create_temp_config("test_solana_approved.toml", TEST_SOLANA_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let tx = SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2".to_string()),
        value_lamports: 1000000,
        priority_fee: 5000,
        cluster_id: 102,
        instruction_data: None,
    };
    assert!(engine.evaluate(&tx).is_ok());
}

#[test]
fn test_solana_unwhitelisted_recipient() {
    let config_path = create_temp_config("test_solana_bad_recipient.toml", TEST_SOLANA_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    let tx = SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw("SysvarC1ock11111111111111111111111111111111".to_string()),
        value_lamports: 1000000,
        priority_fee: 5000,
        cluster_id: 102,
        instruction_data: None,
    };
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::RecipientNotWhitelisted))
    ));
}

#[test]
fn test_solana_instruction_selector() {
    let config_path = create_temp_config("test_solana_calldata.toml", TEST_SOLANA_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();
    
    let mut tx = SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2".to_string()),
        value_lamports: 0,
        priority_fee: 5000,
        cluster_id: 102,
        instruction_data: Some(hex::decode("f0867823f663d2dc01020304").unwrap()),
    };
    assert!(engine.evaluate(&tx).is_ok());

    tx.instruction_data = Some(hex::decode("deadbeef01020304").unwrap());
    assert!(matches!(
        engine.evaluate(&tx),
        Err(SdkError::PolicyDenied(PolicyDenial::InstructionSelectorNotWhitelisted))
    ));
}

#[test]
fn test_private_transactions() {
    let config_path = create_temp_config("test_private.toml", TEST_CONFIG);
    let engine = PrivTractSDK::from_config(config_path.to_str().unwrap()).unwrap();

    let agent_hash = priv_tract::sha256_str("1");
    let target_hash = priv_tract::sha256_str("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2");
    
    let tx_sha256 = SdkTransaction {
        from_agent: AgentId::Sha256(agent_hash),
        to: Recipient::Sha256(target_hash),
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 102,
        instruction_data: None,
    };
    assert!(engine.evaluate(&tx_sha256).is_ok());

    let agent_hash_b3 = priv_tract::blake3_str("1");
    let target_hash_b3 = priv_tract::blake3_str("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2");
    
    let tx_blake3 = SdkTransaction {
        from_agent: AgentId::Blake3(agent_hash_b3),
        to: Recipient::Blake3(target_hash_b3),
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 102,
        instruction_data: None,
    };
    assert!(engine.evaluate(&tx_blake3).is_ok());

    let bad_agent_hash = priv_tract::sha256_str("99");
    let mut tx_bad_agent = tx_sha256.clone();
    tx_bad_agent.from_agent = AgentId::Sha256(bad_agent_hash);
    assert!(matches!(
        engine.evaluate(&tx_bad_agent),
        Err(SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated))
    ));

    let bad_target_hash = priv_tract::sha256_str("SysvarC1ock11111111111111111111111111111111");
    let mut tx_bad_target = tx_sha256.clone();
    tx_bad_target.to = Recipient::Sha256(bad_target_hash);
    assert!(matches!(
        engine.evaluate(&tx_bad_target),
        Err(SdkError::PolicyDenied(PolicyDenial::RecipientNotWhitelisted))
    ));
}
