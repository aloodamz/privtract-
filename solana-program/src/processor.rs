use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::Sysvar,
};

use crate::{
    instruction::PolicyInstruction,
    state::{AgentState, WalletConfig},
};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = PolicyInstruction::try_from_slice(instruction_data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            PolicyInstruction::Initialize {
                allowed_cluster_id,
                wallet_tx_limit,
                wallet_daily_cap,
                max_priority_fee,
                contract_calls_allowed,
                recipient_whitelist,
                function_selector_whitelist,
            } => {
                msg!("Instruction: Initialize");
                Self::process_initialize(
                    program_id,
                    accounts,
                    allowed_cluster_id,
                    wallet_tx_limit,
                    wallet_daily_cap,
                    max_priority_fee,
                    contract_calls_allowed,
                    recipient_whitelist,
                    function_selector_whitelist,
                )
            }
            PolicyInstruction::ToggleKillSwitch { active } => {
                msg!("Instruction: ToggleKillSwitch");
                Self::process_toggle_kill_switch(program_id, accounts, active)
            }
            PolicyInstruction::RegisterAgent {
                agent_id,
                tx_limit,
                daily_cap,
                daily_tx_count_limit,
            } => {
                msg!("Instruction: RegisterAgent");
                Self::process_register_agent(
                    program_id,
                    accounts,
                    agent_id,
                    tx_limit,
                    daily_cap,
                    daily_tx_count_limit,
                )
            }
            PolicyInstruction::ValidateTransaction {
                agent_id,
                value,
                priority_fee,
                cluster_id,
                recipient,
                calldata,
            } => {
                msg!("Instruction: ValidateTransaction");
                Self::process_validate_transaction(
                    program_id,
                    accounts,
                    agent_id,
                    value,
                    priority_fee,
                    cluster_id,
                    recipient,
                    calldata,
                )
            }
        }
    }

    fn process_initialize(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        allowed_cluster_id: u64,
        wallet_tx_limit: u64,
        wallet_daily_cap: u64,
        max_priority_fee: u64,
        contract_calls_allowed: bool,
        recipient_whitelist: Vec<Pubkey>,
        function_selector_whitelist: Vec<Vec<u8>>,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let config_account = next_account_info(account_info_iter)?;
        let admin_account = next_account_info(account_info_iter)?;

        if !admin_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Verify config account size and PDA seeds or ownership
        // In native Solana, we check if the account is owned by our program
        if config_account.owner != _program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        let wallet_config = WalletConfig {
            admin: *admin_account.key,
            kill_switch: false,
            allowed_cluster_id,
            wallet_tx_limit,
            wallet_daily_cap,
            wallet_daily_spend: 0,
            last_reset_timestamp: current_time,
            max_priority_fee,
            contract_calls_allowed,
            recipient_whitelist,
            function_selector_whitelist,
        };

        wallet_config.serialize(&mut *config_account.data.borrow_mut())?;
        msg!("Policy Engine successfully initialized.");
        Ok(())
    }

    fn process_toggle_kill_switch(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        active: bool,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let config_account = next_account_info(account_info_iter)?;
        let admin_account = next_account_info(account_info_iter)?;

        if !admin_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let mut config_data = config_account.data.borrow_mut();
        let mut config = WalletConfig::try_from_slice(&config_data)?;

        if config.admin != *admin_account.key {
            msg!("Error: Only admin can toggle the kill switch");
            return Err(ProgramError::InvalidAccountData);
        }

        config.kill_switch = active;
        config.serialize(&mut *config_data)?;
        msg!("Kill switch toggled to: {}", active);
        Ok(())
    }

    fn process_register_agent(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        agent_id: u64,
        tx_limit: u64,
        daily_cap: u64,
        daily_tx_count_limit: u64,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let agent_account = next_account_info(account_info_iter)?;
        let admin_account = next_account_info(account_info_iter)?;

        if !admin_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        if agent_account.owner != _program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        let agent_state = AgentState {
            agent_id,
            tx_limit,
            daily_cap,
            daily_spend: 0,
            daily_tx_count_limit,
            daily_tx_count: 0,
            last_reset_timestamp: current_time,
        };

        agent_state.serialize(&mut *agent_account.data.borrow_mut())?;
        msg!("Agent {} successfully registered/updated.", agent_id);
        Ok(())
    }

    fn process_validate_transaction(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        agent_id: u64,
        value: u64,
        priority_fee: u64,
        cluster_id: u64,
        recipient: Pubkey,
        calldata: Option<Vec<u8>>,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let config_account = next_account_info(account_info_iter)?;
        let agent_account = next_account_info(account_info_iter)?;

        let mut config_data = config_account.data.borrow_mut();
        let mut config = WalletConfig::try_from_slice(&config_data)?;

        let mut agent_data = agent_account.data.borrow_mut();
        let mut agent = AgentState::try_from_slice(&agent_data)?;

        if config.kill_switch {
            msg!("Policy Denied: Kill Switch active");
            return Err(ProgramError::Custom(1)); // Custom error code 1
        }

        if cluster_id != config.allowed_cluster_id {
            msg!("Policy Denied: Cluster ID mismatch");
            return Err(ProgramError::Custom(2));
        }

        if priority_fee > config.max_priority_fee {
            msg!("Policy Denied: Priority fee too high");
            return Err(ProgramError::Custom(3));
        }

        if !config.recipient_whitelist.contains(&recipient) {
            msg!("Policy Denied: Recipient not whitelisted");
            return Err(ProgramError::Custom(4));
        }

        if let Some(cd) = &calldata {
            if !config.contract_calls_allowed {
                msg!("Policy Denied: Program instruction calls blocked");
                return Err(ProgramError::Custom(5));
            }
            let mut matched = false;
            for selector in &config.function_selector_whitelist {
                if cd.starts_with(selector) {
                    matched = true;
                    break;
                }
            }
            if !matched {
                msg!("Policy Denied: Program instruction discriminator not whitelisted");
                return Err(ProgramError::Custom(6));
            }
        }

        if agent.agent_id != agent_id {
            msg!("Policy Denied: Agent account mismatch");
            return Err(ProgramError::Custom(7));
        }

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        // Daily reset checks
        if current_time - config.last_reset_timestamp >= 86400 {
            config.wallet_daily_spend = 0;
            config.last_reset_timestamp = current_time;
        }

        if current_time - agent.last_reset_timestamp >= 86400 {
            agent.daily_spend = 0;
            agent.daily_tx_count = 0;
            agent.last_reset_timestamp = current_time;
        }

        let limit = std::cmp::min(agent.tx_limit, config.wallet_tx_limit);
        if value > limit {
            msg!("Policy Denied: Transaction value limit exceeded");
            return Err(ProgramError::Custom(8));
        }

        if agent.daily_spend + value > agent.daily_cap {
            msg!("Policy Denied: Agent daily expenditure cap exceeded");
            return Err(ProgramError::Custom(9));
        }

        if agent.daily_tx_count + 1 > agent.daily_tx_count_limit {
            msg!("Policy Denied: Agent daily transaction count limit exceeded");
            return Err(ProgramError::Custom(10));
        }

        if config.wallet_daily_spend + value > config.wallet_daily_cap {
            msg!("Policy Denied: Wallet daily cumulative cap exceeded");
            return Err(ProgramError::Custom(11));
        }

        // Apply validation modifications
        config.wallet_daily_spend += value;
        agent.daily_spend += value;
        agent.daily_tx_count += 1;

        // Save state changes
        config.serialize(&mut *config_data)?;
        agent.serialize(&mut *agent_data)?;

        msg!("Policy Approved: Transaction approved and limits updated.");
        Ok(())
    }
}
