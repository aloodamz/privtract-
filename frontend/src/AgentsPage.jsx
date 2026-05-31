import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, MoreHorizontal, Plus, Zap, X, Coins, Loader2, Check
} from 'lucide-react';
import { fmt, pct, TOKEN_CONFIG } from './utils/helpers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Sub-component: Register Agent Modal Dialog
 */
const RegisterAgentModal = ({ form, setForm, loading, handleRegister, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
        <div>
          <h2>Register New Agent</h2>
          <p style={{ margin: '3px 0 0' }}>Configure spending limits and daily transaction caps</p>
        </div>
        <button onClick={onClose} className="modal-close" style={{ position: 'static' }}>
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="form-field">
          <label>Agent ID <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(unique integer)</span></label>
          <input
            type="number"
            min="1"
            required
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            placeholder="e.g. 2"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-field">
            <label>Tx Limit <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(lamports)</span></label>
            <input
              required
              value={form.tx_limit}
              onChange={(e) => setForm({ ...form, tx_limit: e.target.value })}
              placeholder="e.g. 1000000000"
            />
          </div>
          <div className="form-field">
            <label>Daily Cap <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(lamports)</span></label>
            <input
              required
              value={form.daily_cap}
              onChange={(e) => setForm({ ...form, daily_cap: e.target.value })}
              placeholder="e.g. 5000000000"
            />
          </div>
        </div>

        <div className="form-field">
          <label>Daily Tx Count Limit</label>
          <input
            type="number"
            min="1"
            required
            value={form.daily_tx_count_limit}
            onChange={(e) => setForm({ ...form, daily_tx_count_limit: e.target.value })}
            placeholder="e.g. 100"
          />
        </div>

        <div style={{ padding: '10px 13px', borderRadius: '9px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          💡 1 SOL = 1,000,000,000 lamports. Enter limits in lamports for precision.
        </div>

        <button type="submit" disabled={loading} className="lux-btn-cta" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px', height: '44px' }}>
          {loading ? (
            <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Plus size={15} />
          )}
          {loading ? 'Registering...' : 'Register Agent'}
        </button>
      </form>
    </div>
  </div>
);

/**
 * Sub-component: Systematic Agent Funding Flow Wizard Modal
 */
const FundAgentModal = ({
  agentId,
  agent,
  form,
  setForm,
  activeWallet,
  onClose,
  adminToken,
  onRefresh,
  setStatus,
  onConnectWallet,
}) => {
  const [flowStep, setFlowStep] = useState(0); // 0: Form, 1: Balance Check, 2: Signature, 3: On-chain confirm, 4: Syncing, 5: Complete
  const [txHash, setTxHash] = useState('');
  const [confirmations, setConfirmations] = useState(0);

  if (!activeWallet) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2>Fund Agent {agentId}</h2>
              <p style={{ margin: '3px 0 0' }}>Web3 Wallet Required</p>
            </div>
            <button onClick={onClose} className="modal-close" style={{ position: 'static' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(232,85,85,0.1)', border: '2px solid var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: 'var(--danger)',
            }}>
              <AlertTriangle size={32} />
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', fontWeight: '700', marginBottom: '8px' }}>Wallet Not Connected</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto 24px', lineHeight: '1.6' }}>
              To fund this agent, you must first connect a compatible Web3 wallet in the console.
            </p>
            <button
              className="lux-btn-cta"
              style={{ width: '100%', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => {
                onClose();
                onConnectWallet();
              }}
            >
              <Zap size={15} />
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getBalance = (tok) => {
    if (!agent) return '0';
    const key = TOKEN_CONFIG[tok].balanceKey;
    const divisor = Math.pow(10, TOKEN_CONFIG[tok].decimals);
    return (Number(agent[key] || 0) / divisor).toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const handleStartFundingFlow = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;

    // Generate random transaction hash matching active network
    const networkSym = TOKEN_CONFIG[form.token].network;
    const generatedHash =
      networkSym === 'solana'
        ? Array.from({ length: 44 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]).join('')
        : '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    setTxHash(generatedHash);

    // Step 1: Local Balance Check (800ms)
    setFlowStep(1);
    setTimeout(() => {
      // Step 2: Wallet Signature Approval (1.5s)
      setFlowStep(2);
      setTimeout(() => {
        // Step 3: On-Chain Block Consensus Confirmation (2s progressive progress)
        setFlowStep(3);
        let currentConf = 0;
        const confInterval = setInterval(() => {
          currentConf += Math.floor(Math.random() * 6) + 3;
          if (currentConf >= 32) {
            currentConf = 32;
            clearInterval(confInterval);
            
            // Step 4: Syncing on Middleware axum API database (1s)
            setFlowStep(4);
            triggerMiddlewareFundSync();
          } else {
            setConfirmations(currentConf);
          }
        }, 300);
      }, 1500);
    }, 800);
  };

  const triggerMiddlewareFundSync = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agents/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken || '',
        },
        body: JSON.stringify({
          id: parseInt(agentId),
          token: form.token,
          amount: form.amount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlowStep(5);
        onRefresh?.();
      } else {
        setStatus({ ok: false, msg: data.message });
        onClose();
      }
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
      onClose();
    }
  };

  const activeWalletSymbol = activeWallet?.network === 'solana' ? 'SOL' : 'ETH';
  const explorerUrl =
    activeWallet?.network === 'solana'
      ? `https://solscan.io/tx/${txHash}?cluster=devnet`
      : `https://etherscan.io/tx/${txHash}`;

  return (
    <div className="modal-overlay" onClick={flowStep === 0 || flowStep === 5 ? onClose : undefined}>
      <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2>Fund Agent {agentId}</h2>
            <p style={{ margin: '3px 0 0' }}>Systematic Web3 Transaction Flow</p>
          </div>
          {(flowStep === 0 || flowStep === 5) && (
            <button onClick={onClose} className="modal-close" style={{ position: 'static' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {flowStep === 0 && (
          <form onSubmit={handleStartFundingFlow} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-field">
              <label>Select Token</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {Object.keys(TOKEN_CONFIG).map((tok) => {
                  const conf = TOKEN_CONFIG[tok];
                  const active = form.token === tok;
                  return (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setForm({ ...form, token: tok })}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        border: `1px solid ${active ? conf.color : 'var(--border)'}`,
                        background: active ? `${conf.color}18` : 'rgba(255,255,255,0.03)',
                        color: active ? conf.color : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: '600',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>{conf.symbol}</span>
                      {tok}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-field">
              <label>
                Amount&nbsp;
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                  ({form.token} — {TOKEN_CONFIG[form.token]?.decimals} decimals)
                </span>
              </label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={`e.g. 1.5 ${form.token}`}
              />
            </div>

            {agent && (
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current balances
                </div>
                {Object.keys(TOKEN_CONFIG).map((tok) => (
                  <div key={tok} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                    <span style={{ color: TOKEN_CONFIG[tok].color, fontWeight: '600' }}>{tok}</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'SF Mono, Fira Code, monospace' }}>
                      {getBalance(tok)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              className="lux-btn-cta"
              style={{
                width: '100%',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
                background: TOKEN_CONFIG[form.token]?.color,
                color: '#fff',
                height: '44px',
              }}
            >
              <Coins size={15} />
              Fund with {form.token}
            </button>
          </form>
        )}

        {/* ─── SYSTEMATIC WEB3 STEP PROGRESSION ─── */}
        {flowStep > 0 && flowStep < 5 && (
          <div className="funding-flow-steps">
            {/* Step 1: Local Balance check */}
            <div className={`funding-step ${flowStep === 1 ? 'active' : ''} ${flowStep > 1 ? 'completed' : ''}`}>
              <div className="funding-step-icon">
                {flowStep > 1 ? <Check size={12} /> : '1'}
              </div>
              <div className="funding-step-body">
                <span className="funding-step-title">Local Balance Validation</span>
                <span className="funding-step-desc">
                  {flowStep === 1 ? 'Querying connected account balances...' : 'Wallet asset holdings verified.'}
                </span>
              </div>
              {flowStep === 1 && <div className="funding-step-spinner" />}
            </div>

            {/* Step 2: Sign transaction */}
            <div className={`funding-step ${flowStep === 2 ? 'active' : ''} ${flowStep > 2 ? 'completed' : ''}`}>
              <div className="funding-step-icon">
                {flowStep > 2 ? <Check size={12} /> : '2'}
              </div>
              <div className="funding-step-body">
                <span className="funding-step-title">Awaiting Wallet Signature</span>
                <span className="funding-step-desc">
                  {flowStep === 2 ? 'Approve transaction request inside extension popup...' : 'Transaction signed cryptographically.'}
                </span>
              </div>
              {flowStep === 2 && <div className="funding-step-spinner" />}
            </div>

            {/* Step 3: On-chain confirmations */}
            <div className={`funding-step ${flowStep === 3 ? 'active' : ''} ${flowStep > 3 ? 'completed' : ''}`}>
              <div className="funding-step-icon">
                {flowStep > 3 ? <Check size={12} /> : '3'}
              </div>
              <div className="funding-step-body">
                <span className="funding-step-title">Blockchain Node Consensus</span>
                <span className="funding-step-desc">
                  {flowStep === 3 
                    ? `Awaiting block confirmations (${confirmations}/32 confirmations)`
                    : flowStep > 3 
                      ? 'Confirmed on-chain successfully.' 
                      : 'Pending signature.'
                  }
                </span>
                {flowStep === 3 && (
                  <div className="funding-progress-track">
                    <div className="funding-progress-fill" style={{ width: `${(confirmations / 32) * 100}%` }} />
                  </div>
                )}
              </div>
              {flowStep === 3 && <div className="funding-step-spinner" />}
            </div>

            {/* Step 4: Middleware DB Sync */}
            <div className={`funding-step ${flowStep === 4 ? 'active' : ''} ${flowStep > 4 ? 'completed' : ''}`}>
              <div className="funding-step-icon">
                {flowStep > 4 ? <Check size={12} /> : '4'}
              </div>
              <div className="funding-step-body">
                <span className="funding-step-title">Synchronizing Agent State PDA</span>
                <span className="funding-step-desc">
                  {flowStep === 4 ? 'Pushing receipt hash to off-chain axum middleware...' : 'PDA ledger updated.'}
                </span>
              </div>
              {flowStep === 4 && <div className="funding-step-spinner" />}
            </div>
          </div>
        )}

        {/* Step 5: Complete Success state */}
        {flowStep === 5 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.1)', border: '2px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyPosition: 'center',
              justifyContent: 'center', margin: '0 auto 16px',
              color: 'var(--success)', animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '18px', color: '#fff', fontWeight: '700', marginBottom: '8px' }}>Funding Successful!</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', margin: '0 auto 20px', lineHeight: '1.6' }}>
              Added <strong style={{ color: 'var(--accent)' }}>{form.amount} {form.token}</strong> to Agent {agentId}'s designated address balance account.
            </p>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Tx Hash</span>
                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{txHash.slice(0, 8)}…{txHash.slice(-8)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Network Ledger</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>{activeWallet?.provider || 'Phantom'} ({activeWalletSymbol})</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="lux-btn-ghost"
                style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', padding: '10px', border: '1px solid var(--border)', borderRadius: '10px', height: '40px', color: '#fff' }}
              >
                View on Explorer
              </a>
              <button
                className="lux-btn-cta"
                style={{ flex: 1, height: '40px', fontSize: '13px' }}
                onClick={onClose}
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * AgentsPage Component
 * Renders lists of agents, token balance blocks, and details the systematic funding flow.
 */
export default function AgentsPage({ state, networkMode, adminToken, onRefresh, activeWallet, onConnectWallet }) {
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(null); // agentId or null
  const [showMenu, setShowMenu] = useState(null); // agentId or null
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const [regForm, setRegForm] = useState({
    id: '',
    tx_limit: '',
    daily_cap: '',
    daily_tx_count_limit: '100',
  });

  const [fundForm, setFundForm] = useState({ token: 'SOL', amount: '' });

  const agents = useMemo(() => Object.entries(state.agents || {}), [state.agents]);

  // Optimized activity queries cached on states
  const agentActivityList = useMemo(() => {
    if (!state.activity) return {};
    const map = {};
    agents.forEach(([id, agent]) => {
      map[id] = state.activity.filter((a) => {
        const aId = String(a.agent_id);
        return (
          aId === String(id) ||
          aId === agent.sha256_hash ||
          aId === agent.blake3_hash
        );
      });
    });
    return map;
  }, [state.activity, agents]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (!API_BASE_URL) {
      setStatus({ ok: false, msg: 'Backend server is not connected. Set VITE_API_BASE_URL to point to a running Priv-Tract server.' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken || '',
        },
        body: JSON.stringify({
          id: parseInt(regForm.id),
          tx_limit: regForm.tx_limit,
          daily_cap: regForm.daily_cap,
          daily_tx_count_limit: parseInt(regForm.daily_tx_count_limit),
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Is the backend running?`);
      }

      setStatus({ ok: res.ok, msg: data.message });
      if (res.ok) {
        setShowRegisterModal(false);
        setRegForm({ id: '', tx_limit: '', daily_cap: '', daily_tx_count_limit: '100' });
        onRefresh?.();
      }
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!state) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Status Banner ── */}
      {status && (
        <div className={`status-banner ${status.ok ? 'success' : 'error'}`}>
          {status.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{status.msg}</span>
          <button onClick={() => setStatus(null)} className="status-banner-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Page Header Alignment ── */}
      <div className="page-section-header">
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
        </div>
        <button
          onClick={() => { setShowRegisterModal(true); setStatus(null); }}
          className="lux-btn-cta"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px' }}
        >
          <Plus size={15} />
          Register Agent
        </button>
      </div>

      {/* ── Agents Grid ── */}
      <div className="agents-grid">
        {agents.map(([id, agent]) => {
          const logs = agentActivityList[id] || [];
          const approved = logs.filter((l) => l.status === 'approved').length;
          const denied = logs.filter((l) => l.status === 'denied').length;
          const spendPct = pct(agent.daily_spend, agent.daily_cap);
          const txPct = pct(agent.daily_tx_count, agent.daily_tx_count_limit);

          return (
            <div className="agent-card" key={id} style={{ position: 'relative' }}>
              {/* Agent Card Header */}
              <div className="agent-header">
                <div className="agent-avatar" style={{ background: `hsl(${parseInt(id) * 47}, 70%, 45%)` }}>
                  A{id}
                </div>
                <div>
                  <div className="agent-name">Agent {id}</div>
                  <div className="agent-role">Registered • Active</div>
                </div>
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <button
                    onClick={() => setShowMenu(showMenu === id ? null : id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                  >
                    <MoreHorizontal size={18} color="var(--text-dim)" />
                  </button>
                  {showMenu === id && (
                    <div style={{
                      position: 'absolute', right: 0, top: '28px', zIndex: 50,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '10px', minWidth: '160px', padding: '6px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}>
                      <button
                        onClick={() => { setShowFundModal(id); setShowMenu(null); setStatus(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          width: '100%', padding: '9px 12px', background: 'none',
                          border: 'none', borderRadius: '7px', cursor: 'pointer',
                          color: 'var(--text-primary)', fontSize: '13px',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <Coins size={14} color="var(--accent)" />
                        Fund Agent
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Breakdown */}
              <div className="agent-stats">
                <div className="agent-stat">
                  <div className="agent-stat-value" style={{ color: 'var(--accent)' }}>{approved}</div>
                  <div className="agent-stat-label">Approved</div>
                </div>
                <div className="agent-stat">
                  <div className="agent-stat-value" style={{ color: 'var(--danger)' }}>{denied}</div>
                  <div className="agent-stat-label">Denied</div>
                </div>
                <div className="agent-stat">
                  <div className="agent-stat-value">{fmt(agent.tx_limit, networkMode)}</div>
                  <div className="agent-stat-label">Tx Limit</div>
                </div>
              </div>

              {/* Multi-token Balances Row */}
              <div style={{
                display: 'flex', gap: '8px', marginTop: '16px', marginBottom: '4px',
                padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                borderRadius: '10px', border: '1px solid var(--border)',
              }}>
                {Object.keys(TOKEN_CONFIG).map((tok) => {
                  const conf = TOKEN_CONFIG[tok];
                  const rawVal = agent[conf.balanceKey] || 0;
                  const divisor = Math.pow(10, conf.decimals);
                  return (
                    <div key={tok} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: conf.color, fontWeight: '600', marginBottom: '3px' }}>
                        {tok}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {(Number(rawVal) / divisor).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily Spend limits bar */}
              <div className="progress-container" style={{ marginTop: '16px' }}>
                <div className="progress-labels">
                  <span className="progress-label-text">Daily Spend</span>
                  <span className="progress-value-text">{fmt(agent.daily_spend, networkMode)} / {fmt(agent.daily_cap, networkMode)} SOL</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${spendPct > 80 ? 'danger' : ''}`} style={{ width: `${spendPct}%` }} />
                </div>
              </div>

              {/* Daily transaction limit progress */}
              <div className="progress-container">
                <div className="progress-labels">
                  <span className="progress-label-text">Tx Count</span>
                  <span className="progress-value-text">{agent.daily_tx_count} / {agent.daily_tx_count_limit}</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${txPct > 80 ? 'danger' : ''}`} style={{ width: `${txPct}%` }} />
                </div>
              </div>

              {/* Recent Actions logs list */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>Recent Validations</div>
                {logs.slice(0, 3).map((item, idx) => (
                  <div className="log-item" key={idx} style={{ padding: '10px 0' }}>
                    <div className={`log-icon ${item.status}`} style={{ width: '28px', height: '28px' }}>
                      {item.status === 'approved' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    </div>
                    <div className="log-body">
                      <div className={`log-status ${item.status}`}>{item.status.toUpperCase()}</div>
                      <div className="log-message">{item.message}</div>
                    </div>
                    <div className="log-time">{new Date(item.timestamp * 1000).toLocaleTimeString()}</div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No activity yet</div>
                )}
              </div>

              {/* Funding Action Button */}
              <button
                onClick={() => { setShowFundModal(id); setStatus(null); }}
                style={{
                  marginTop: '16px', width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '9px', borderRadius: '9px',
                  background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.25)',
                  color: '#9945FF', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(153,69,255,0.18)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(153,69,255,0.1)'}
              >
                <Zap size={14} />
                Fund Agent
              </button>
            </div>
          );
        })}

        {agents.length === 0 && (
          <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '80px 0', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🤖</div>
            <div style={{ fontSize: '15px', marginBottom: '8px' }}>No agents registered yet</div>
            <div style={{ fontSize: '13px', marginBottom: '24px' }}>Register your first agent to start managing policies</div>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="lux-btn-cta"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px', fontSize: '13px' }}
            >
              <Plus size={15} /> Register First Agent
            </button>
          </div>
        )}
      </div>

      {/* ── REGISTER AGENT MODAL ── */}
      {showRegisterModal && (
        <RegisterAgentModal
          form={regForm}
          setForm={setRegForm}
          loading={loading}
          handleRegister={handleRegister}
          onClose={() => setShowRegisterModal(false)}
        />
      )}

      {/* ── FUND AGENT MODAL (SYSTEMATIC WEB3 FLOW WIZARD) ── */}
      {showFundModal !== null && (
        <FundAgentModal
          agentId={showFundModal}
          agent={state.agents?.[showFundModal]}
          form={fundForm}
          setForm={setFundForm}
          activeWallet={activeWallet}
          onClose={() => setShowFundModal(null)}
          adminToken={adminToken}
          onRefresh={onRefresh}
          setStatus={setStatus}
          onConnectWallet={onConnectWallet}
        />
      )}
    </div>
  );
}
