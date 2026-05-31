import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, ShieldOff, Link2, Hash, Gauge,
  FileCode2, Users, Wallet, AlertOctagon, ArrowUpDown, Ban,
  Pencil, X, CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';
import { fmt } from './utils/helpers';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Sub-component: Individual Policy Rule Card
 */
const PolicyCard = ({ policy }) => {
  const { name, desc, icon, iconColor, chip, chipText, details, tags, editable } = policy;
  return (
    <div className="policy-card">
      <div className="policy-card-top">
        <div className={`policy-icon-wrap ${iconColor}`}>{icon}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {editable && (
            <span className="mono-tag" style={{ margin: 0, textTransform: 'uppercase', fontSize: '9px' }}>
              Editable
            </span>
          )}
          <span className={`policy-status-chip ${chip}`}>{chipText}</span>
        </div>
      </div>
      <div className="policy-name">{name}</div>
      <div className="policy-desc">{desc}</div>
      {details.map(([label, value], idx) => (
        <div className="policy-detail-row" key={idx}>
          <span className="policy-detail-label">{label}</span>
          <span className="policy-detail-value">{value}</span>
        </div>
      ))}
      {tags && tags.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map((t, idx) => <span className="mono-tag" key={idx} style={{ margin: 0 }}>{t}</span>)}
        </div>
      )}
    </div>
  );
};

/**
 * Sub-component: Edit Policies Modal Dialog
 */
const EditPoliciesModal = ({ state, form, setForm, loading, handleSave, onClose, adminToken }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div
      className="modal-content"
      style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', position: 'sticky', top: 0, background: 'var(--bg-card)', paddingBottom: '16px', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <div>
          <h2>Edit Policies</h2>
          <p style={{ margin: '3px 0 0' }}>Changes apply immediately to the running engine</p>
        </div>
        <button onClick={onClose} className="modal-close" style={{ position: 'static' }}>
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section: Spend Limits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>💰 Spend Limits</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '-4px' }}>Values in lamports (1 SOL = 1,000,000,000)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Wallet Tx Limit <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(lamports)</span></label>
              <input
                value={form.wallet_tx_limit}
                onChange={(e) => setForm({ ...form, wallet_tx_limit: e.target.value })}
                placeholder={state.wallet_tx_limit}
              />
            </div>
            <div className="form-field">
              <label>Wallet Daily Cap <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(lamports)</span></label>
              <input
                value={form.wallet_daily_cap}
                onChange={(e) => setForm({ ...form, wallet_daily_cap: e.target.value })}
                placeholder={state.wallet_daily_cap}
              />
            </div>
          </div>
        </div>

        {/* Section: Fee Ceiling */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>⛽ Fee Ceiling</div>
          <div className="form-field">
            <label>Max Priority Fee <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(micro-lamports)</span></label>
            <input
              type="number"
              min="0"
              value={form.max_gas_price_gwei}
              onChange={(e) => setForm({ ...form, max_gas_price_gwei: e.target.value })}
              placeholder={String(state.max_gas_price_gwei)}
            />
          </div>
        </div>

        {/* Section: Program Calls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>🔧 Program Calls</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>Allow Program/Contract Calls</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Toggle whether instructions with calldata are permitted
              </div>
            </div>
            <div
              className={`toggle-track ${form.contract_calls_allowed ? 'on' : ''}`}
              onClick={() => setForm({ ...form, contract_calls_allowed: !form.contract_calls_allowed })}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            >
              <div className="toggle-knob" />
            </div>
          </div>
        </div>

        {/* Section: Recipient Whitelist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>🛡 Recipient Whitelist</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '-4px' }}>One Base58 Solana address per line. Leave empty to keep existing.</div>
          <div className="form-field">
            <label>Whitelisted Addresses</label>
            <textarea
              rows={4}
              value={form.recipient_whitelist}
              onChange={(e) => setForm({ ...form, recipient_whitelist: e.target.value })}
              placeholder={'SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2\n...'}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '9px', padding: '10px 12px',
                color: 'var(--text-primary)', fontSize: '12px',
                fontFamily: 'SF Mono, Fira Code, monospace',
                lineHeight: '1.7', resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Current: {(state.recipient_whitelist || []).length} address(es)
            </div>
          </div>
        </div>

        {/* Section: Function Selector Whitelist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}># Instruction Discriminator Whitelist</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '-4px' }}>One 0x-prefixed hex discriminator per line. Leave empty to keep existing.</div>
          <div className="form-field">
            <label>Whitelisted Discriminators</label>
            <textarea
              rows={3}
              value={form.function_selector_whitelist}
              onChange={(e) => setForm({ ...form, function_selector_whitelist: e.target.value })}
              placeholder={'0xa9059cbb\n0x095ea7b3\n...'}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: '9px', padding: '10px 12px',
                color: 'var(--text-primary)', fontSize: '12px',
                fontFamily: 'SF Mono, Fira Code, monospace',
                lineHeight: '1.7', resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Current: {(state.function_selector_whitelist || []).length} selector(s)
            </div>
          </div>
        </div>

        {/* Admin token reminder */}
        {!adminToken && (
          <div style={{
            padding: '12px 14px', borderRadius: '10px',
            background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.25)',
            fontSize: '12px', color: '#F5A623',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertTriangle size={14} />
            Admin token not set. Go to the Dashboard page and enter your admin token before saving.
          </div>
        )}

        <button type="submit" disabled={loading} className="lux-btn-cta" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px' }}>
          {loading ? (
            <>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 size={15} />
              Save Policy Changes
            </>
          )}
        </button>
      </form>
    </div>
  </div>
);

/**
 * PoliciesPage Component
 * Renders list of rule specifications, and allows admin parameter edits.
 */
export default function PoliciesPage({ state, networkMode, adminToken, onRefresh }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({});

  const openEdit = () => {
    setForm({
      wallet_tx_limit: state.wallet_tx_limit || '',
      wallet_daily_cap: state.wallet_daily_cap || '',
      max_gas_price_gwei: String(state.max_gas_price_gwei ?? ''),
      contract_calls_allowed: state.contract_calls_allowed ?? true,
      recipient_whitelist: (state.recipient_whitelist || []).join('\n'),
      function_selector_whitelist: (state.function_selector_whitelist || []).join('\n'),
    });
    setStatus(null);
    setShowEditModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const payload = {
      contract_calls_allowed: form.contract_calls_allowed,
    };
    if (form.wallet_tx_limit.trim()) payload.wallet_tx_limit = form.wallet_tx_limit.trim();
    if (form.wallet_daily_cap.trim()) payload.wallet_daily_cap = form.wallet_daily_cap.trim();
    if (form.max_gas_price_gwei.trim()) payload.max_gas_price_gwei = parseInt(form.max_gas_price_gwei);

    const whitelist = form.recipient_whitelist.trim();
    if (whitelist) {
      payload.recipient_whitelist = whitelist.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    const selectors = form.function_selector_whitelist.trim();
    if (selectors) {
      payload.function_selector_whitelist = selectors.split('\n').map((s) => s.trim()).filter(Boolean);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken || '',
        },
        body: JSON.stringify(payload),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned a non-JSON response (HTTP ${res.status}). Is the backend running?`);
      }
      setStatus({ ok: res.ok, msg: data.message });
      if (res.ok) {
        setShowEditModal(false);
        onRefresh?.();
      }
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const unit = networkMode === 'solana' ? 'SOL' : 'ETH';
  const feeUnit = networkMode === 'solana' ? 'micro-lamports' : 'gwei';
  const netLabel = networkMode === 'solana' ? 'Cluster' : 'Chain';

  // Compute policies rule config dynamically, cached on state parameters
  const policies = useMemo(() => {
    if (!state) return [];
    return [
      {
        name: 'Kill Switch',
        desc: 'Emergency halt. When active, ALL transactions are denied regardless of other policy checks.',
        icon: <AlertOctagon size={22} />,
        iconColor: state.kill_switch ? 'red' : 'green',
        chip: state.kill_switch ? 'chip-off' : 'chip-active',
        chipText: state.kill_switch ? 'ACTIVE' : 'INACTIVE',
        details: [['Current state', state.kill_switch ? 'DENY ALL' : 'Normal operation']],
      },
      {
        name: `${netLabel} ID Enforcement`,
        desc: `Only transactions targeting the configured ${netLabel.toLowerCase()} are permitted. All other network IDs are rejected.`,
        icon: <Link2 size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [[`Allowed ${netLabel.toLowerCase()}`, `ID ${state.allowed_chain_id}`]],
      },
      {
        name: networkMode === 'solana' ? 'Priority Fee Ceiling' : 'Gas Price Ceiling',
        desc: networkMode === 'solana'
          ? 'Rejects transactions with priority fee exceeding the configured maximum to prevent overpaying.'
          : 'Rejects transactions with gas price exceeding the configured maximum to prevent overpaying.',
        icon: <Gauge size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [[networkMode === 'solana' ? 'Max priority fee' : 'Max gas price', `${state.max_gas_price_gwei} ${feeUnit}`]],
        editable: true,
      },
      {
        name: 'Recipient Whitelist',
        desc: 'Only addresses in the whitelist can receive transactions. All others are denied.',
        icon: <ShieldCheck size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [['Whitelisted', `${(state.recipient_whitelist || []).length} address(es)`]],
        tags: state.recipient_whitelist || [],
        editable: true,
      },
      {
        name: networkMode === 'solana' ? 'Instruction Discriminator Whitelist' : 'Function Selector Whitelist',
        desc: networkMode === 'solana'
          ? 'Program instructions must use a whitelisted discriminator prefix. Unknown discriminators are blocked.'
          : 'Contract calls must use a whitelisted 4-byte function selector. Unknown selectors are blocked.',
        icon: <Hash size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [['Whitelisted', `${(state.function_selector_whitelist || []).length} selector(s)`]],
        tags: state.function_selector_whitelist || [],
        editable: true,
      },
      {
        name: networkMode === 'solana' ? 'Program Call Gate' : 'Contract Call Gate',
        desc: networkMode === 'solana'
          ? 'Controls whether instructions with data are allowed at all.'
          : 'Controls whether calldata-bearing transactions (contract interactions) are allowed at all.',
        icon: <FileCode2 size={22} />,
        iconColor: state.contract_calls_allowed ? 'green' : 'red',
        chip: state.contract_calls_allowed ? 'chip-active' : 'chip-off',
        chipText: state.contract_calls_allowed ? 'ALLOWED' : 'DENIED',
        details: [[networkMode === 'solana' ? 'Program calls' : 'Contract calls', state.contract_calls_allowed ? 'Permitted' : 'Blocked']],
        editable: true,
      },
      {
        name: 'Wallet Transaction Limit',
        desc: 'Maximum value a single transaction can carry at the wallet level. Exceeding this is denied.',
        icon: <Wallet size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [['Max per tx', `${fmt(state.wallet_tx_limit, networkMode)} ${unit}`]],
        editable: true,
      },
      {
        name: 'Wallet Daily Cap',
        desc: 'Total cumulative spend across all agents in a 24h window. Exceeding this halts all transactions.',
        icon: <ArrowUpDown size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [
          ['Daily cap', `${fmt(state.wallet_daily_cap, networkMode)} ${unit}`],
          ['Spent today', `${fmt(state.wallet_daily_spend, networkMode)} ${unit}`],
        ],
        editable: true,
      },
      {
        name: 'Agent Authentication',
        desc: 'Only registered agents can submit transactions. Unknown agent IDs are rejected immediately.',
        icon: <Users size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: [['Registered agents', Object.keys(state.agents || {}).length]],
      },
      {
        name: 'Agent Transaction Limit',
        desc: 'Per-agent maximum transaction value. Capped at the lower of agent and wallet limits.',
        icon: <Ban size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: Object.entries(state.agents || {}).map(([id, a]) => [`Agent ${id} limit`, `${fmt(a.tx_limit, networkMode)} ${unit}`]),
      },
      {
        name: 'Agent Daily Cap',
        desc: 'Per-agent cumulative spend limit per day. Independent of wallet-level cap.',
        icon: <ShieldCheck size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: Object.entries(state.agents || {}).map(([id, a]) => [`Agent ${id}`, `${fmt(a.daily_spend, networkMode)}/${fmt(a.daily_cap, networkMode)} ${unit}`]),
      },
      {
        name: 'Agent Tx Count Limit',
        desc: 'Maximum number of transactions an agent can execute per day regardless of value.',
        icon: <ShieldOff size={22} />,
        iconColor: 'green',
        chip: 'chip-enforced',
        chipText: 'ENFORCED',
        details: Object.entries(state.agents || {}).map(([id, a]) => [`Agent ${id}`, `${a.daily_tx_count}/${a.daily_tx_count_limit} txns`]),
      },
    ];
  }, [state, networkMode, feeUnit, netLabel, unit]);

  const editableCount = useMemo(() => policies.filter((p) => p.editable).length, [policies]);

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
          {policies.length} policy rules active • {editableCount} configurable
        </div>
        <button onClick={openEdit} className="lux-btn-cta" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px' }}>
          <Pencil size={14} />
          Edit Policies
        </button>
      </div>

      {/* ── Policy Cards Grid ── */}
      <div className="policies-grid">
        {policies.map((p, idx) => (
          <PolicyCard policy={p} key={idx} />
        ))}
      </div>

      {/* ── EDIT POLICIES MODAL ── */}
      {showEditModal && (
        <EditPoliciesModal
          state={state}
          form={form}
          setForm={setForm}
          loading={loading}
          handleSave={handleSave}
          onClose={() => setShowEditModal(false)}
          adminToken={adminToken}
        />
      )}
    </div>
  );
}
