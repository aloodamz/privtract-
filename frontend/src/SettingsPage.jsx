import React from 'react';
import { fmt, TOKEN_CONFIG } from './utils/helpers';

/**
 * SettingsPage Component
 * Displays system status, wallet constraints, whitelists, and live counter states.
 */
export default function SettingsPage({ state, networkMode, walletAddress }) {
  if (!state) return null;

  const unit = networkMode === 'solana' ? 'lamports' : 'wei';
  const feeUnit = networkMode === 'solana' ? 'micro-lamports' : 'gwei';

  // Format minor units with commas
  const formatRaw = (val) => (val ? Number(val).toLocaleString() : '0');

  // Unified render helper for row items
  const SettingsRow = ({ label, desc, value, valStyle }) => (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-sublabel">{desc}</div>
      </div>
      <div className="settings-row-value" style={valStyle}>
        {value}
      </div>
    </div>
  );

  return (
    <div className="settings-container">
      {/* Wallet Configuration */}
      <div className="settings-section">
        <div className="settings-section-title">Wallet Configuration</div>
        <div className="settings-section-desc">Global constraints loaded from config.toml</div>

        <SettingsRow
          label="Connected Wallet"
          desc="The active account signed in"
          value={walletAddress || 'None (Local Mock)'}
          valStyle={{ color: walletAddress ? 'var(--success)' : 'var(--text-dim)' }}
        />

        <SettingsRow
          label="Kill Switch"
          desc="Emergency halt for all transactions"
          value={state.kill_switch ? 'ACTIVE' : 'Inactive'}
          valStyle={{ color: state.kill_switch ? 'var(--danger)' : 'var(--success)' }}
        />

        <SettingsRow
          label={`Allowed ${networkMode === 'solana' ? 'Cluster' : 'Chain'} ID`}
          desc={`Only this ${networkMode === 'solana' ? 'cluster' : 'network'} is permitted`}
          value={state.allowed_chain_id}
        />

        <SettingsRow
          label="Wallet Transaction Limit"
          desc="Max value per single transaction"
          value={`${formatRaw(state.wallet_tx_limit)} ${unit}`}
        />

        <SettingsRow
          label="Wallet Daily Cap"
          desc="Max cumulative spend per day across all agents"
          value={`${formatRaw(state.wallet_daily_cap)} ${unit}`}
        />

        <SettingsRow
          label={`Max ${networkMode === 'solana' ? 'Priority Fee' : 'Gas Price'}`}
          desc={`Transactions above this ${networkMode === 'solana' ? 'priority fee' : 'gas price'} are rejected`}
          value={`${state.max_gas_price_gwei} ${feeUnit}`}
        />

        <SettingsRow
          label={networkMode === 'solana' ? 'Program Instructions' : 'Contract Calls'}
          desc={`Whether ${networkMode === 'solana' ? 'instruction data' : 'calldata-bearing'} transactions are allowed`}
          value={state.contract_calls_allowed ? 'Allowed' : 'Denied'}
          valStyle={{ color: state.contract_calls_allowed ? 'var(--success)' : 'var(--danger)' }}
        />
      </div>

      {/* Whitelists */}
      <div className="settings-section">
        <div className="settings-section-title">Whitelists</div>
        <div className="settings-section-desc">Approved recipients and function selectors</div>

        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
          <div className="settings-row-label">Recipient Whitelist</div>
          <div>
            {(state.recipient_whitelist || []).map((addr, i) => (
              <span className="mono-tag" key={i}>{addr}</span>
            ))}
            {(!state.recipient_whitelist || state.recipient_whitelist.length === 0) && (
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No addresses configured</span>
            )}
          </div>
        </div>

        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
          <div className="settings-row-label">Function Selector Whitelist</div>
          <div>
            {(state.function_selector_whitelist || []).map((sel, i) => (
              <span className="mono-tag" key={i}>{sel}</span>
            ))}
            {(!state.function_selector_whitelist || state.function_selector_whitelist.length === 0) && (
              <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>No selectors configured</span>
            )}
          </div>
        </div>
      </div>

      {/* Agent Configurations */}
      <div className="settings-section">
        <div className="settings-section-title">Agent Configurations</div>
        <div className="settings-section-desc">Per-agent limits and caps from config.toml</div>

        {Object.entries(state.agents || {}).map(([id, agent]) => (
          <div key={id} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--accent)' }}>
              Agent {id}
            </div>
            <SettingsRow
              label="Transaction Limit"
              desc=""
              value={`${formatRaw(agent.tx_limit)} ${unit}`}
            />
            <SettingsRow
              label="Daily Cap"
              desc=""
              value={`${formatRaw(agent.daily_cap)} ${unit}`}
            />
            <SettingsRow
              label="Daily Transaction Count Limit"
              desc=""
              value={agent.daily_tx_count_limit}
            />
          </div>
        ))}
      </div>

      {/* Runtime State */}
      <div className="settings-section">
        <div className="settings-section-title">Runtime State</div>
        <div className="settings-section-desc">Live counters — reset daily</div>

        <SettingsRow
          label="Wallet Daily Spend"
          desc=""
          value={`${formatRaw(state.wallet_daily_spend)} ${unit}`}
        />

        {Object.entries(state.agents || {}).map(([id, agent]) => (
          <React.Fragment key={id}>
            <SettingsRow
              label={`Agent ${id} Daily Spend`}
              desc=""
              value={`${formatRaw(agent.daily_spend)} ${unit}`}
            />
            <SettingsRow
              label={`Agent ${id} Tx Count`}
              desc=""
              value={`${agent.daily_tx_count} / {agent.daily_tx_count_limit}`}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
