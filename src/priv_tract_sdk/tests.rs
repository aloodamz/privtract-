
use super::*;
use std::sync::atomic::Ordering;


const TEST_RECIPIENT: &str = "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2";

const UNLISTED_RECIPIENT: &str = "SysvarC1ock11111111111111111111111111111111";

fn test_sdk() -> PrivTractSDK {
    PrivTractSDK::from_config("config.toml").unwrap()
}

fn valid_tx() -> SdkTransaction {
    SdkTransaction {
        from_agent: AgentId::Raw(1),
        to: Recipient::Raw(TEST_RECIPIENT.to_string()),
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 1,
        instruction_data: None,
    }
}



#[test]
fn test_sha256_matches_engine() {
    let sdk_hash = sha256_str("1");
    let mut hasher = sha2::Sha256::new();
    sha2::Digest::update(&mut hasher, b"1");
    let mut expected = [0u8; 32];
    expected.copy_from_slice(&hasher.finalize());
    assert_eq!(sdk_hash, expected, "SHA-256 mismatch");
}

#[test]
fn test_blake3_matches_engine() {
    let sdk_hash = blake3_str("1");
    let expected = *blake3::hash(b"1").as_bytes();
    assert_eq!(sdk_hash, expected, "BLAKE3 mismatch");
}

#[test]
fn test_sha256_deterministic() {
    let h1 = sha256_str("test_input");
    let h2 = sha256_str("test_input");
    assert_eq!(h1, h2, "SHA-256 must be deterministic");
}

#[test]
fn test_blake3_deterministic() {
    let h1 = blake3_str("test_input");
    let h2 = blake3_str("test_input");
    assert_eq!(h1, h2, "BLAKE3 must be deterministic");
}

#[test]
fn test_sha256_vs_blake3_different() {
    let sha = sha256_str("hello");
    let blake = blake3_str("hello");
    assert_ne!(sha, blake, "SHA-256 and BLAKE3 must produce different digests");
}

#[test]
fn test_constant_time_eq_identical() {
    let a = sha256_str("hello");
    let b = sha256_str("hello");
    assert!(ct_hash_eq(&a, &b));
}

#[test]
fn test_constant_time_eq_different() {
    let a = sha256_str("hello");
    let c = sha256_str("world");
    assert!(!ct_hash_eq(&a, &c));
}

#[test]
fn test_constant_time_eq_single_bit_diff() {
    let mut a = sha256_str("test");
    let b = a;
    a[31] ^= 1; // flip one bit
    assert!(!ct_hash_eq(&a, &b), "Single-bit flip must be detected");
}

#[test]
fn test_sha256_empty_string() {
    let h = sha256_str("");
    let expected = hex::decode(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    ).unwrap();
    assert_eq!(h.to_vec(), expected);
}



#[test]
fn test_base58_roundtrip() {
    let pubkey = decode_solana_pubkey(TEST_RECIPIENT).unwrap();
    let encoded = encode_solana_pubkey(&pubkey);
    assert_eq!(encoded, TEST_RECIPIENT);
}

#[test]
fn test_base58_invalid_length() {
    let result = decode_solana_pubkey("1");
    assert!(result.is_err());
}

#[test]
fn test_base58_invalid_characters() {
    let result = decode_solana_pubkey("0OIl!!!invalid");
    assert!(result.is_err());
}

#[test]
fn test_base58_whitespace_trimmed() {
    let result = decode_solana_pubkey(&format!("  {}  ", TEST_RECIPIENT));
    assert!(result.is_ok());
    assert_eq!(
        encode_solana_pubkey(&result.unwrap()),
        TEST_RECIPIENT
    );
}



#[test]
fn test_pda_seeds_agent_state() {
    let seeds = pda_seeds_agent_state(1);
    assert_eq!(seeds.len(), 2);
    assert_eq!(seeds[0], b"agent-state");
    assert_eq!(seeds[1], 1u64.to_le_bytes().to_vec());
}

#[test]
fn test_pda_seeds_wallet_config() {
    let authority = [42u8; 32];
    let seeds = pda_seeds_wallet_config(&authority);
    assert_eq!(seeds.len(), 2);
    assert_eq!(seeds[0], b"wallet-config");
    assert_eq!(seeds[1], authority.to_vec());
}

#[test]
fn test_pda_seeds_different_agents_differ() {
    let s1 = pda_seeds_agent_state(1);
    let s2 = pda_seeds_agent_state(2);
    assert_ne!(s1[1], s2[1], "Different agent IDs must yield different PDA seeds");
}



#[test]
fn test_fmt_sha256_format() {
    let h = sha256_str("1");
    let wire = fmt_sha256(&h);
    assert!(wire.starts_with("sha256:"));
    assert_eq!(wire.len(), 7 + 64); // "sha256:" + 64 hex chars
}

#[test]
fn test_fmt_blake3_format() {
    let h = blake3_str("1");
    let wire = fmt_blake3(&h);
    assert!(wire.starts_with("blake3:"));
    assert_eq!(wire.len(), 7 + 64);
}

#[test]
fn test_agent_id_raw_wire() {
    let id = AgentId::Raw(42);
    assert_eq!(id.to_wire(), "42");
}

#[test]
fn test_agent_id_sha256_wire() {
    let id = AgentId::Sha256(sha256_str("1"));
    let wire = id.to_wire();
    assert!(wire.starts_with("sha256:"));
}

#[test]
fn test_recipient_raw_wire() {
    let r = Recipient::Raw("SRM...".to_string());
    assert_eq!(r.to_wire(), "SRM...");
}

#[test]
fn test_dual_hash_agent() {
    let sdk = test_sdk();
    let (sha, blake) = sdk.dual_hash_agent(1);
    assert!(sha.starts_with("sha256:"));
    assert!(blake.starts_with("blake3:"));
    assert_ne!(sha, blake);
}



#[test]
fn test_kill_switch_denial() {
    let sdk = test_sdk();
    sdk.set_kill_switch(true);
    let tx = valid_tx();
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::KillSwitchActive) => {}
        other => panic!("Expected KillSwitchActive, got: {:?}", other),
    }
}

#[test]
fn test_kill_switch_toggle_on_off() {
    let sdk = test_sdk();
    sdk.set_kill_switch(true);
    assert!(sdk.evaluate(&valid_tx()).is_err());

    sdk.set_kill_switch(false);
    assert!(sdk.evaluate(&valid_tx()).is_ok());
}



#[test]
fn test_chain_id_mismatch() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        cluster_id: 999,
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::ClusterIdMismatch) => {}
        other => panic!("Expected ClusterIdMismatch, got: {:?}", other),
    }
}

#[test]
fn test_chain_id_zero() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        cluster_id: 0,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}



#[test]
fn test_priority_fee_too_high() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        priority_fee: 999_999,
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::PriorityFeeTooHigh) => {}
        other => panic!("Expected PriorityFeeTooHigh, got: {:?}", other),
    }
}

#[test]
fn test_priority_fee_exactly_at_limit() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        priority_fee: 100,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_priority_fee_one_over_limit() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        priority_fee: 101,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}



#[test]
fn test_recipient_raw_whitelisted() {
    let sdk = test_sdk();
    let tx = valid_tx();
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_recipient_raw_not_whitelisted() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        to: Recipient::Raw(UNLISTED_RECIPIENT.to_string()),
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::RecipientNotWhitelisted) => {}
        other => panic!("Expected RecipientNotWhitelisted, got: {:?}", other),
    }
}

#[test]
fn test_recipient_sha256_whitelisted() {
    let sdk = test_sdk();
    let recipient = sdk.hash_address_sha256(TEST_RECIPIENT);
    let tx = SdkTransaction {
        to: recipient,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_recipient_blake3_whitelisted() {
    let sdk = test_sdk();
    let recipient = sdk.hash_address_blake3(TEST_RECIPIENT);
    let tx = SdkTransaction {
        to: recipient,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_recipient_sha256_not_whitelisted() {
    let sdk = test_sdk();
    let recipient = sdk.hash_address_sha256(UNLISTED_RECIPIENT);
    let tx = SdkTransaction {
        to: recipient,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}



#[test]
fn test_valid_instruction_selector() {
    let sdk = test_sdk();
    let selector = hex::decode("a9059cbb").unwrap();
    let mut data = selector;
    data.extend_from_slice(&[0u8; 28]); // pad to simulate full calldata

    let tx = SdkTransaction {
        instruction_data: Some(data),
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_invalid_instruction_selector() {
    let sdk = test_sdk();
    let bad_selector = hex::decode("deadbeef").unwrap();
    let mut data = bad_selector;
    data.extend_from_slice(&[0u8; 28]);

    let tx = SdkTransaction {
        instruction_data: Some(data),
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::InstructionSelectorNotWhitelisted) => {}
        other => panic!("Expected InstructionSelectorNotWhitelisted, got: {:?}", other),
    }
}

#[test]
fn test_instruction_data_empty_vec_rejected() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        instruction_data: Some(vec![]),
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}



#[test]
fn test_agent_raw_authenticated() {
    let sdk = test_sdk();
    let tx = valid_tx();
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_agent_raw_not_authenticated() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        from_agent: AgentId::Raw(999),
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated) => {}
        other => panic!("Expected AgentNotAuthenticated, got: {:?}", other),
    }
}

#[test]
fn test_agent_sha256_authenticated() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_sha256(1);
    let tx = SdkTransaction {
        from_agent: agent,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_agent_blake3_authenticated() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_blake3(1);
    let tx = SdkTransaction {
        from_agent: agent,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_agent_sha256_wrong_id() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_sha256(999); // not registered
    let tx = SdkTransaction {
        from_agent: agent,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}

#[test]
fn test_agent_blake3_wrong_id() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_blake3(999);
    let tx = SdkTransaction {
        from_agent: agent,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_err());
}



#[test]
fn test_tx_limit_exceeded() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        value_lamports: 4097,
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::TransactionLimitExceeded) => {}
        other => panic!("Expected TransactionLimitExceeded, got: {:?}", other),
    }
}

#[test]
fn test_tx_limit_exactly_at_boundary() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        value_lamports: 4096,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}

#[test]
fn test_tx_value_zero() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        value_lamports: 0,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());
}



#[test]
fn test_agent_daily_cap_exceeded() {
    let sdk = test_sdk();
    let tx = SdkTransaction {
        value_lamports: 4096,
        ..valid_tx()
    };
    assert!(sdk.evaluate(&tx).is_ok());

    let tx2 = SdkTransaction {
        value_lamports: 1,
        ..valid_tx()
    };
    match sdk.evaluate(&tx2).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::AgentDailyCapExceeded) => {}
        other => panic!("Expected AgentDailyCapExceeded, got: {:?}", other),
    }
}



#[test]
fn test_tx_count_limit_exceeded() {
    let sdk = test_sdk();
    for i in 0..10 {
        let tx = SdkTransaction {
            value_lamports: 1,
            ..valid_tx()
        };
        let result = sdk.evaluate(&tx);
        assert!(result.is_ok(), "TX {} should pass", i);
    }

    let tx = SdkTransaction {
        value_lamports: 1,
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::TransactionCountLimitExceeded) => {}
        other => panic!("Expected TransactionCountLimitExceeded, got: {:?}", other),
    }
}



#[test]
fn test_wallet_daily_cap_enforcement() {
    let sdk = test_sdk();
    let wallet_cap = 65536u64;
    sdk.wallet_daily_spend.store(wallet_cap, Ordering::Release);

    let tx = SdkTransaction {
        value_lamports: 1,
        ..valid_tx()
    };
    match sdk.evaluate(&tx).unwrap_err() {
        SdkError::PolicyDenied(PolicyDenial::WalletDailyCapExceeded) => {}
        other => panic!("Expected WalletDailyCapExceeded, got: {:?}", other),
    }
}



#[test]
fn test_daily_reset_clears_all_counters() {
    let sdk = test_sdk();

    let tx = valid_tx();
    sdk.evaluate(&tx).unwrap();
    assert_eq!(sdk.wallet_daily_spend.load(Ordering::Acquire), 100);

    sdk.reset_daily_state();
    assert_eq!(sdk.wallet_daily_spend.load(Ordering::Acquire), 0);

    let (_, (_, state)) = sdk.agents.iter().next().unwrap();
    assert_eq!(state.daily_spend.load(Ordering::Acquire), 0);
    assert_eq!(state.daily_tx_count.load(Ordering::Acquire), 0);
}

#[test]
fn test_daily_reset_allows_new_transactions() {
    let sdk = test_sdk();

    let tx = SdkTransaction {
        value_lamports: 4096,
        ..valid_tx()
    };
    sdk.evaluate(&tx).unwrap();
    assert!(sdk.evaluate(&SdkTransaction { value_lamports: 1, ..valid_tx() }).is_err());

    sdk.reset_daily_state();
    assert!(sdk.evaluate(&SdkTransaction { value_lamports: 100, ..valid_tx() }).is_ok());
}



#[test]
fn test_receipt_counters_accurate() {
    let sdk = test_sdk();

    let r1 = sdk.evaluate(&SdkTransaction { value_lamports: 100, ..valid_tx() }).unwrap();
    assert!(r1.approved);
    assert_eq!(r1.agent_daily_spend, 100);
    assert_eq!(r1.agent_daily_tx_count, 1);
    assert_eq!(r1.wallet_daily_spend, 100);

    let r2 = sdk.evaluate(&SdkTransaction { value_lamports: 200, ..valid_tx() }).unwrap();
    assert_eq!(r2.agent_daily_spend, 300);
    assert_eq!(r2.agent_daily_tx_count, 2);
    assert_eq!(r2.wallet_daily_spend, 300);
}

#[test]
fn test_receipt_message_contains_sol_amount() {
    let sdk = test_sdk();
    let receipt = sdk.evaluate(&SdkTransaction {
        value_lamports: 100,
        ..valid_tx()
    }).unwrap();
    assert!(receipt.message.contains("SOL"));
    assert!(receipt.message.contains("APPROVED"));
}



#[test]
fn test_full_pipeline_sha256() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_sha256(1);
    let recipient = sdk.hash_address_sha256(TEST_RECIPIENT);
    let tx = SdkTransaction {
        from_agent: agent,
        to: recipient,
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 1,
        instruction_data: None,
    };
    let result = sdk.evaluate(&tx);
    assert!(result.is_ok(), "SHA-256 E2E failed: {:?}", result.err());
}

#[test]
fn test_full_pipeline_blake3() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_blake3(1);
    let recipient = sdk.hash_address_blake3(TEST_RECIPIENT);
    let tx = SdkTransaction {
        from_agent: agent,
        to: recipient,
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 1,
        instruction_data: None,
    };
    let result = sdk.evaluate(&tx);
    assert!(result.is_ok(), "BLAKE3 E2E failed: {:?}", result.err());
}

#[test]
fn test_full_pipeline_mixed_sha256_agent_blake3_recipient() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_sha256(1);
    let recipient = sdk.hash_address_blake3(TEST_RECIPIENT);
    let tx = SdkTransaction {
        from_agent: agent,
        to: recipient,
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 1,
        instruction_data: None,
    };
    assert!(sdk.evaluate(&tx).is_ok(), "Mixed hash modes should work");
}

#[test]
fn test_full_pipeline_with_instruction_data() {
    let sdk = test_sdk();
    let agent = sdk.hash_agent_sha256(1);
    let recipient = sdk.hash_address_sha256(TEST_RECIPIENT);
    let mut data = hex::decode("a9059cbb").unwrap();
    data.extend_from_slice(&[0u8; 28]);

    let tx = SdkTransaction {
        from_agent: agent,
        to: recipient,
        value_lamports: 100,
        priority_fee: 50,
        cluster_id: 1,
        instruction_data: Some(data),
    };
    assert!(sdk.evaluate(&tx).is_ok());
}



#[test]
fn test_policy_denial_display() {
    let denial = PolicyDenial::KillSwitchActive;
    let msg = format!("{}", denial);
    assert!(msg.contains("DENIED"));
    assert!(msg.contains("kill-switch"));
}

#[test]
fn test_sdk_error_display() {
    let err = SdkError::PolicyDenied(PolicyDenial::AgentNotAuthenticated);
    let msg = format!("{}", err);
    assert!(msg.contains("DENIED"));
    assert!(msg.contains("Agent"));
}

#[test]
fn test_config_load_error_display() {
    let err = SdkError::ConfigLoad("file not found".into());
    assert!(format!("{}", err).contains("Config load error"));
}

#[test]
fn test_gateway_error_display() {
    let err = SdkError::GatewayError("connection refused".into());
    assert!(format!("{}", err).contains("Gateway error"));
}



// Note: test_gateway_mode_rejects_local_evaluate has been removed
// because local evaluation on a gateway SDK is now checked at compile time
// via the SdkMode typestate pattern (Embedded vs Gateway).

#[test]
fn test_gateway_url_trailing_slash_stripped() {
    let sdk = PrivTractSDK::gateway("http://localhost:3001/", None);
    assert_eq!(sdk.server_url.unwrap(), "http://localhost:3001");
}
