import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Terminal,
  Shield,
  Key,
  Cpu,
  HelpCircle,
  Code,
  Copy,
  Check,
  Globe,
} from "lucide-react";

// Static document menu structure
const MENU_GROUPS = [
  {
    group: "Getting Started",
    items: [
      { id: "intro", label: "Introduction", icon: <BookOpen size={15} /> },
      { id: "quickstart", label: "Quick Start", icon: <Terminal size={15} /> },
      { id: "rules", label: "Policy Configurations", icon: <Shield size={15} /> },
    ],
  },
  {
    group: "Transaction Privacy",
    items: [
      { id: "hashing", label: "Cryptographic Hashing", icon: <Key size={15} /> },
      { id: "zkp-routing", label: "Private Routing Logs", icon: <Cpu size={15} /> },
    ],
  },
  {
    group: "On-Chain Validation",
    items: [
      { id: "solana-setup", label: "Solana PDA Program", icon: <HelpCircle size={15} /> },
    ],
  },
  {
    group: "Developer Tools",
    items: [
      { id: "rust-sdk", label: "Rust SDK Integration", icon: <Code size={15} /> },
      { id: "api-specs", label: "API Reference", icon: <Code size={15} /> },
    ],
  },
];

const CONFIG_SNIPPET = `[wallet]
kill_switch = false
allowed_chain_id = 102                      # Solana Devnet (101 for Mainnet)
wallet_tx_limit = "5000000000"              # 5 SOL in lamports
wallet_daily_cap = "50000000000"            # 50 SOL in lamports
max_gas_price_gwei = 1000000                # Max priority fee in micro-lamports
contract_calls_allowed = true
recipient_whitelist = [
  "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2",
  "4zMMC9ZQnS3M4yXzW6Zs89J184QJrx3zs7d15VWMzZzZ"
]
function_selector_whitelist = ["f0867823f663d2dc"]  # Anchor instruction discriminator

[agents.1]
tx_limit = "1000000000"                     # 1 SOL limit
daily_cap = "5000000000"                    # 5 SOL daily cap
daily_tx_count_limit = 5`;

const CURL_SNIPPET = `curl -X POST http://127.0.0.1:3001/api/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "from_agent": "sha256:7bc582c40c83a123f...",
    "to": "sha256:a591a6d40bf420404a011...",
    "value": "5000000000",
    "gas_price_gwei": 5000,
    "chain_id": 102
  }'`;

const RESPONSE_SUCCESS_SNIPPET = `{
  "approved": true,
  "message": "Transaction complies with all active wallet and agent policies.",
  "tx_hash": "2tY9B3iQnN87vXmU4sY..."
}`;

const RESPONSE_DENIED_SNIPPET = `{
  "approved": false,
  "message": "DENIED: Transaction value of 6.5 SOL exceeds Agent 1's transaction limit of 1.0 SOL.",
  "blocked_by": "AgentTxLimitRule"
}`;

/**
 * Sub-component: Copyable terminal command block
 */
const TerminalBlock = ({ title, code, blockId, copiedId, onCopy }) => (
  <div className="dash-activity-section" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
      <span>{title}</span>
      <button onClick={() => onCopy(code, blockId)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}>
        {copiedId === blockId ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
    <pre style={{ margin: 0, fontSize: "13px", color: "#a2d4a8", fontFamily: "monospace", overflowX: "auto" }}>{code}</pre>
  </div>
);

/**
 * DocsPage Component
 * Structured system manuals, API definitions, and TOML schema lists.
 */
export default function DocsPage({ onBack, onEnterDashboard }) {
  const [activeSection, setActiveSection] = useState("intro");
  const [copiedId, setCopiedId] = useState(null);

  const triggerCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="luxury-root">
      {/* ─── THIN BACKGROUND GRID & SPOTLIGHT GLOWS ─── */}
      <div className="luxury-grid-overlay" />
      <div className="luxury-spotlight spotlight-1" />
      <div className="luxury-spotlight spotlight-2" />
      <div className="luxury-spotlight spotlight-3" />

      {/* ─── STICKY FLOATING GLASS NAVBAR ─── */}
      <nav className="lux-nav">
        <div className="lux-nav-inner liquid-glass">
          <button className="lux-btn-ghost" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowLeft size={16} />
            <span>Back to Landing</span>
          </button>
          
          <div className="lux-nav-brand">
            <Globe size={18} className="glow-icon" />
            <span>Priv-Tract Docs</span>
          </div>

          <button className="lux-btn-cta liquid-glass" onClick={onEnterDashboard} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Try Simulator</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* ─── MAIN SYSTEM DOCUMENTATION GRID ─── */}
      <div className="lux-container" style={{ paddingTop: "110px", paddingBottom: "80px", position: "relative", zIndex: 10 }}>
        <div className="lux-showcase-grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start", gap: "40px" }}>
          
          {/* Left Sidebar Navigation */}
          <aside className="liquid-glass" style={{ borderRadius: "20px", padding: "24px", minHeight: "calc(100vh - 200px)", position: "sticky", top: "110px" }}>
            {MENU_GROUPS.map((group, idx) => (
              <div key={idx} style={{ marginBottom: "28px" }}>
                <h5 style={{ fontSize: "11px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginBottom: "12px", fontWeight: 600 }}>
                  {group.group}
                </h5>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                  {group.items.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          className={`lux-sidebar-item ${active ? "active" : ""}`}
                          onClick={() => setActiveSection(item.id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            background: active ? "rgba(255,255,255,0.04)" : "transparent",
                            border: "none",
                            borderRadius: "10px",
                            padding: "10px 14px",
                            color: active ? "#fff" : "rgba(255,255,255,0.55)",
                            fontSize: "13px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            fontWeight: 500,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>

          {/* Right Main Content Panel */}
          <main className="liquid-glass" style={{ borderRadius: "24px", padding: "40px", minHeight: "calc(100vh - 200px)" }}>
            {activeSection === "intro" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Introduction
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  The <strong style={{ color: "#fff", fontWeight: 600 }}>Priv-Tract Policy Engine SDK</strong> is a high-performance, developer-focused security framework written in pure, concurrent Rust. It acts as an off-chain and hybrid on-chain gatekeeper for autonomous AI agents, ensuring all transaction requests comply with strict safety policies before signing.
                </p>
                
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>
                  Direct Agent SDK Execution
                </h3>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  Traditional transaction security relies on users connecting their wallets and manually confirming each action. For autonomous AI agents, this model fails. By embedding the Priv-Tract SDK directly inside the agent's runtime, developers can enforce safety policies in-process:
                </p>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "12px", color: "rgba(255,255,255,0.65)", fontWeight: 300, fontSize: "14px", marginBottom: "24px" }}>
                  <li><strong style={{ color: "#fff" }}>Zero Wallet Consensuses:</strong> Policies are validated in-process, allowing autonomous operation without manual signatures.</li>
                  <li><strong style={{ color: "#fff" }}>Sub-Microsecond Latency:</strong> In-memory check execution takes less than 1 microsecond, avoiding network I/O overhead.</li>
                  <li><strong style={{ color: "#fff" }}>Prompt Injection Shielding:</strong> Prevents compromised LLM plans from draining wallets by blocking unauthorized contract addresses or values.</li>
                </ul>

                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>
                  How the Framework Works
                </h3>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  The SDK runs in two modes. In <strong>Embedded Mode</strong>, policies are loaded from a local TOML file, and transaction limits are tracked using atomic registers in memory. In <strong>Gateway Mode</strong>, the SDK queries a centralized policy server to synchronize spending caps across multiple agent nodes.
                </p>
              </article>
            )}

            {activeSection === "quickstart" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Quick Start Guide
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  Get the SDK integrated into your Rust project and verify your first transaction policy in less than 5 minutes.
                </p>

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>1. Add the Dependency</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  Add the dependency to your agent's <code>Cargo.toml</code> file:
                </p>
                <TerminalBlock
                  title="Cargo.toml"
                  code={`[dependencies]\npriv-tract = { git = "https://github.com/aloodamz/Priv-tract-capstone-.git" }\ntokio = { version = "1", features = ["full"] }`}
                  blockId="qs-cargo"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>2. Create config.toml</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  Define policy constraints in a local <code>config.toml</code> file:
                </p>
                <TerminalBlock
                  title="config.toml"
                  code={`[wallet]\nkill_switch = false\nallowed_chain_id = 102 # Devnet\nwallet_tx_limit = "2000000000" # 2 SOL\nwallet_daily_cap = "10000000000" # 10 SOL\nmax_gas_price_gwei = 5000\ncontract_calls_allowed = false\nrecipient_whitelist = ["SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"]\nfunction_selector_whitelist = []\n\n[agents.1]\ntx_limit = "1000000000" # 1 SOL\ndaily_cap = "5000000000" # 5 SOL\ndaily_tx_count_limit = 10`}
                  blockId="qs-toml"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>3. Evaluate Policies</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  Load the SDK in embedded mode and pass a transaction payload to the validator:
                </p>
                <TerminalBlock
                  title="src/main.rs"
                  code={`use priv_tract::priv_tract_sdk::*;\n\n#[tokio::main]\nasync fn main() {\n    // Load local config\n    let sdk = PrivTractSDK::from_config("config.toml").unwrap();\n\n    // Construct transaction payload\n    let tx = SdkTransaction {\n        from_agent: AgentId::Raw(1),\n        to: Recipient::Raw("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2".to_string()),\n        value_lamports: 500_000_000,  // 0.5 SOL\n        priority_fee: 1000,\n        cluster_id: 102,\n        instruction_data: None,\n    };\n\n    // Evaluate locally\n    match sdk.evaluate(&tx) {\n        Ok(receipt) => println!("✅ Approved: {}", receipt.message),\n        Err(err) => println!("❌ Denied: {}", err),\n    }\n}`}
                  blockId="qs-rs"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />
              </article>
            )}

            {activeSection === "rules" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Policy Spec Configurations
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  Customize your wallet spending ceilings, agent daily caps, and recipient allowlists inside your local <code>config.toml</code> file:
                </p>

                <TerminalBlock
                  title="config.toml"
                  code={CONFIG_SNIPPET}
                  blockId="toml"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h3 style={{ fontSize: "1.4rem", fontWeight: 500, color: "#fff", margin: "36px 0 16px" }}>
                  Configuration Schema Reference
                </h3>
                <div style={{ overflowX: "auto", marginTop: "16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "rgba(255,255,255,0.75)", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                        <th style={{ padding: "10px", fontWeight: 600, color: "#fff" }}>Key</th>
                        <th style={{ padding: "10px", fontWeight: 600, color: "#fff" }}>Type</th>
                        <th style={{ padding: "10px", fontWeight: 600, color: "#fff" }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>kill_switch</td>
                        <td style={{ padding: "12px 10px" }}>Boolean</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Emergency toggle. When active, all transactions are rejected.</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>allowed_chain_id</td>
                        <td style={{ padding: "12px 10px" }}>Integer</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Target chain/cluster ID (e.g. 102 for Solana devnet).</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>wallet_tx_limit</td>
                        <td style={{ padding: "12px 10px" }}>String (BigInt)</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Maximum allowed value per transaction in minor units (lamports/wei).</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>wallet_daily_cap</td>
                        <td style={{ padding: "12px 10px" }}>String (BigInt)</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Cumulative spending limit across all agents in a 24-hour cycle.</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>recipient_whitelist</td>
                        <td style={{ padding: "12px 10px" }}>Array of Strings</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Permitted Base58/hex destination addresses. Any other recipient is blocked.</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td style={{ padding: "12px 10px", fontFamily: "monospace", color: "var(--accent)" }}>daily_tx_count_limit</td>
                        <td style={{ padding: "12px 10px" }}>Integer</td>
                        <td style={{ padding: "12px 10px", color: "rgba(255,255,255,0.55)" }}>Total number of transaction requests an agent is allowed to execute daily.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {activeSection === "hashing" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Cryptographic Hashing
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  Directly transmitting raw recipient addresses and parameter values over networks exposes critical agent details to front-runners, sandwich bots, and address-harvesting networks.
                </p>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  To guarantee absolute transaction privacy:
                </p>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "12px", color: "rgba(255,255,255,0.65)", fontWeight: 300, fontSize: "14px", marginBottom: "24px" }}>
                  <li><strong style={{ color: "#fff" }}>Hashed Destination Checks:</strong> Agents hash target addresses locally using SHA-256 or BLAKE3 and submit the hash for policy validation.</li>
                  <li><strong style={{ color: "#fff" }}>Hashed Whitelist Match:</strong> Priv-Tract holds lists of hashed recipient destinations and verifies hashes locally via <code style={{ color: "var(--accent)" }}>O(1)</code> lock-striping lookups without decrypting the data.</li>
                  <li><strong style={{ color: "#fff" }}>Data Protection:</strong> Hashed parameters remain encrypted over local and external networks, eliminating correlation attacks.</li>
                </ul>

                <h3 style={{ fontSize: "1.4rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>Cryptographic Pipeline Workflow</h3>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "16px", padding: "24px", color: "rgba(255,255,255,0.6)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "flex", gap: "12px" }}><span style={{ color: "var(--accent)" }}>1. Local Hashing:</span> Agent computes Hash = SHA256(Target Address)</div>
                    <div style={{ display: "flex", gap: "12px" }}><span style={{ color: "var(--accent)" }}>2. Payload POST:</span> Agent submits JSON request with Hashed recipient address</div>
                    <div style={{ display: "flex", gap: "12px" }}><span style={{ color: "var(--accent)" }}>3. Engine Lookup:</span> Engine compares Hash against Whitelist in O(1) time</div>
                    <div style={{ display: "flex", gap: "12px" }}><span style={{ color: "var(--accent)" }}>4. Validation Response:</span> Engine returns APPROVED or DENIED payload</div>
                  </div>
                </div>
              </article>
            )}

            {activeSection === "zkp-routing" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Private Routing Logs
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  Operational accountability must not compromise absolute transaction privacy. Priv-Tract maintains highly secure, anonymized audit logs of all transaction actions.
                </p>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  Every audit log retains transaction details (value, gas limits, and outcomes) but masks agent IDs and target addresses into short, unique cryptographic signatures (e.g. <code>sha256:7bc582...</code>).
                  The Priv-Tract secure admin dashboard automatically resolves these masked logs <strong style={{ color: "#fff", fontWeight: 600 }}>client-side</strong> by mapping the hashes back to clean, human-readable labels stored in the local memory state.
                  This ensures that even if external logs are intercepted, zero private destination addresses are ever leaked.
                </p>
              </article>
            )}

            {activeSection === "solana-setup" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Solana PDA Program
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  For enterprise-grade security, Priv-Tract features a dual-layer validation model: fast off-chain checks and absolute on-chain authority via a companion Solana program.
                </p>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  The program enforces absolute limits on-chain by maintaining state within two distinct <strong style={{ color: "#fff", fontWeight: 600 }}>Program Derived Address (PDA)</strong> accounts:
                </p>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "12px", color: "rgba(255,255,255,0.65)", fontWeight: 300, fontSize: "14px", marginBottom: "24px" }}>
                  <li><strong style={{ color: "#fff" }}>WalletConfig Account:</strong> Derived from the seeds <code>[b"wallet-config", authority.key()]</code>. It stores the global daily caps, transaction limits, whitelists, and the emergency Kill Switch state on-chain.</li>
                  <li><strong style={{ color: "#fff" }}>AgentState Account:</strong> Derived from <code>[b"agent-state", agent_id_bytes]</code>. It maintains real-time on-chain logs of an agent's daily transaction count and spend counters to prevent double-spending attacks.</li>
                </ul>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  By combining off-chain sub-millisecond validations with direct on-chain PDA guards, agents enjoy the best of both worlds: ultra-low latency execution and cryptographically guaranteed on-chain safety.
                </p>
              </article>
            )}

            {activeSection === "rust-sdk" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  Rust SDK Technical Specification & Integration Manual
                </h1>
                <p style={{ fontSize: "15.5px", lineHeight: "1.7", color: "rgba(255,255,255,0.7)", marginBottom: "28px", fontWeight: 300 }}>
                  The <strong style={{ color: "#fff", fontWeight: 600 }}>Priv-Tract Policy Engine Rust SDK</strong> is an enterprise-grade compliance library designed to run directly inside your AI agent's runtime process. By checking transactions against rules locally, it avoids network round-trips to achieve sub-microsecond validation latency (&lt;1 µs).
                </p>

                {/* SYSTEM DIAGRAM */}
                <h3 style={{ fontSize: "1.4rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>Embedded SDK System Flow</h3>
                <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "20px", fontFamily: "monospace", fontSize: "12px", color: "#a2d4a8", lineHeight: "1.5", overflowX: "auto", marginBottom: "28px" }}>
{`  [ Spender Agent ] ────( SdkTransaction )────► [ PrivTractSDK Engine ]
                                                         │
     ┌───────────────────────────────────────────────────┼────────────────────────────────────────┐
     │ 11-Gate Pipeline (In-Process)                     │ Cryptographic Privacy Shield           │
     │                                                   ▼                                        │
     │  - Gate 1:  Kill Switch Check             ┌───────────────┐                                │
     │  - Gate 2:  Solana Cluster ID Verification│  Crypto Layer │                                │
     │  - Gate 3:  Priority Fee Ceiling Check    │  SHA-256      ├─► Masks address with 32-byte   │
     │  - Gate 4:  Recipient Whitelist Gate      │  BLAKE3       │   digests for private lookups  │
     │  - Gate 5:  Anchor Discriminator Check    └───────┬───────┘                                │
     │  - Gate 6:  Agent Authentication Gate             │                                        │
     │  - Gate 7:  Per-Transaction Value Limit           ▼                                        │
     │  - Gate 8:  Agent Daily Spend Cap         ┌───────────────┐                                │
     │  - Gate 9:  Agent Daily Frequency Gate    │ Atomic Commit │                                │
     │  - Gate 10: Global Wallet Daily Cap       │ AcqRel registers─► Updates spending logs without │
     │  - Gate 11: Atomic Commit Phase           └───────────────┘   thread block contentions     │
     └────────────────────────────────────────────────────────────────────────────────────────────┘`}
                </div>

                {/* THE 11-GATE DETAILED RUNTIME */}
                <h3 style={{ fontSize: "1.4rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>The 11-Gate Enforcement Pipeline</h3>
                <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  Calling <code>sdk.evaluate(&tx)</code> runs the transaction through 11 sequential gates in a deterministic order. The pipeline utilizes an **atomic-abort** pattern: if any check fails, execution returns a specific error variant and stops immediately, guaranteeing no counter adjustments are written to memory.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "24px 0" }}>
                  {[
                    ["Gate 1: Kill Switch Check (kill_switch)", "Reads the global emergency switch via Ordering::Acquire memory barriers. If active, block transaction and return PolicyDenial::KillSwitchActive."],
                    ["Gate 2: Solana Cluster Verification (cluster_id)", "Asserts target cluster matches allowed configuration (101 mainnet-beta, 102 devnet). Blocks cross-cluster signature replay exploits, returning PolicyDenial::ClusterIdMismatch."],
                    ["Gate 3: Priority Fee Ceiling Check (priority_fee)", "Asserts priority fee is below the max allowed ceiling. Shielding capital from fee-market manipulation or priority fee spikes, returning PolicyDenial::PriorityFeeTooHigh."],
                    ["Gate 4: Recipient Whitelist Gate (to)", "Verifies destination address matches allowed recipients. Supports local hashing (SHA-256/BLAKE3) matched against allowlists in constant-time using ct_hash_eq, returning PolicyDenial::RecipientNotWhitelisted."],
                    ["Gate 5: Anchor Instruction Selector Check (instruction_data)", "Asserts that contract calls are enabled. If enabled, parses the 8-byte Anchor discriminator prefix and matches against whitelisted selector lists, returning PolicyDenial::InstructionSelectorNotWhitelisted."],
                    ["Gate 6: Agent Authentication Gate (from_agent)", "Resolves the agent identifier (raw or hashed ID) in the agent ledger. If unregistered, returns PolicyDenial::AgentNotAuthenticated."],
                    ["Gate 7: Per-Transaction Value Limit (value_lamports)", "Enforces spending caps: value <= min(agent.tx_limit, wallet.wallet_tx_limit), returning PolicyDenial::TransactionLimitExceeded on failure."],
                    ["Gate 8: Agent Daily Spend Cap (daily_cap)", "Compares current accumulated daily spending against limits: current_spend + tx_value <= agent_daily_cap, returning PolicyDenial::AgentDailyCapExceeded on failure."],
                    ["Gate 9: Agent Daily Frequency Gate (daily_tx_count_limit)", "Ensures agent daily transactions do not exceed limits: current_count + 1 <= daily_tx_count_limit, preventing transaction spam. Returns PolicyDenial::TransactionCountLimitExceeded on failure."],
                    ["Gate 10: Global Wallet Daily Cap (wallet_daily_cap)", "Checks aggregate daily spending across all agents combined to limit hot-wallet exposure. Returns PolicyDenial::WalletDailyCapExceeded on failure."],
                    ["Gate 11: Atomic Commit Phase (AcqRel updates)", "If all checks pass, commits spend counter increments atomically using Acquire/Release memory-barriered CPU registers, preventing race conditions or double-spending. Emits EvalReceipt."]
                  ].map(([title, desc], idx) => (
                    <div key={idx} style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 18px" }}>
                      <span style={{ color: "var(--accent)", fontWeight: "600", fontSize: "13px", display: "block" }}>{title}</span>
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12.5px", lineHeight: "1.4", display: "block", marginTop: "6px" }}>{desc}</span>
                    </div>
                  ))}
                </div>

                {/* FUNCTION BY FUNCTION SPECIFICATION */}
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", margin: "36px 0 16px" }}>Detailed Function Specifications</h3>
                <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.65)", marginBottom: "20px", fontWeight: 300 }}>
                  Below is the exhaustive technical reference of all helper methods and core evaluation functions implemented inside the SDK code (<code>src/priv_tract_sdk/mod.rs</code>):
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px", margin: "24px 0" }}>
                  <div style={{ padding: "20px", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px" }}>
                    <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>1. Cryptographic Primitives</h4>
                    
                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>sha256_digest(data: &[u8]) -&gt; [u8; 32]</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Computes the standard SHA-256 hash of raw byte input. Leverages target hardware crypto instructions (SHA-NI) on modern CPUs for accelerated computation.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>sha256_str(s: &str) -&gt; [u8; 32]</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Helper function that takes a string reference, extracts its UTF-8 bytes, and calls <code>sha256_digest</code> to return its 32-byte digest array.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>blake3_digest(data: &[u8]) -&gt; [u8; 32]</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Generates a highly optimized BLAKE3 digest. Utilizes hardware vector registers (AVX-512, AVX2, or NEON) to calculate hashes at gigabytes per second.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>blake3_str(s: &str) -&gt; [u8; 32]</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Helper function that converts a string reference to raw bytes and computes its BLAKE3 hash digest.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>ct_hash_eq(a: &[u8; 32], b: &[u8; 32]) -&gt; bool</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Compares two 32-byte digests in constant time. It aggregates differences across all 32 bytes using bitwise XOR and OR operations. Because it evaluates every byte index instead of exiting early on mismatch, it prevents timing side-channel exploits.
                      </p>
                    </div>

                    <div>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>fmt_sha256(h: &[u8; 32]) -&gt; String</code> & <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>fmt_blake3(h: &[u8; 32]) -&gt; String</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Serializes 32-byte hash digests into standardized prefixed strings (e.g. <code>"sha256:&lt;hex&gt;"</code>) for wire transmission and server parsing.
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: "20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px" }}>
                    <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>2. Solana Native Helpers</h4>
                    
                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>decode_solana_pubkey(s: &str) -&gt; Result&lt;[u8; 32], SdkError&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Accepts a Solana Base58 public key string, trims surrounding whitespaces, decodes it into a byte vector, and validates that it is exactly 32 bytes long, returning a raw byte array.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>encode_solana_pubkey(bytes: &[u8; 32]) -&gt; String</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Encodes a raw 32-byte public key array back into a standard Base58 string representation.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>pda_seeds_wallet_config(authority: &[u8; 32]) -&gt; Vec&lt;Vec&lt;u8&gt;&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Returns the deterministic seeds vector (<code>[b"wallet-config", authority_pubkey]</code>) used to derive the <code>WalletConfig</code> PDA account on-chain.
                      </p>
                    </div>

                    <div>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>pda_seeds_agent_state(agent_id: u64) -&gt; Vec&lt;Vec&lt;u8&gt;&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Returns the seeds vector (<code>[b"agent-state", agent_id.to_le_bytes()]</code>) used to derive the <code>AgentState</code> PDA account on-chain.
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: "20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px" }}>
                    <h4 style={{ color: "#fff", fontSize: "15px", fontWeight: "600", marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "6px" }}>3. Core SDK Engine Methods</h4>
                    
                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>PrivTractSDK::from_config(path: &str) -&gt; Result&lt;Self, SdkError&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Loads and parses a local <code>config.toml</code> file. Decodes whitelisted Base58 addresses and hex function selectors, and initializes all agent daily spend counters to 0 using atomic registers.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>PrivTractSDK::gateway(url: &str, token: Option&lt;String&gt;) -&gt; Self</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Initializes the SDK in gateway client mode, pointing to a remote REST server URL. Used when multiple agent instances need to sync thresholds via a centralized policy server.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>sdk.evaluate(tx: &SdkTransaction) -&gt; Result&lt;EvalReceipt, SdkError&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Enforces local transaction evaluation. It executes Gates 1 through 10 sequentially and commits the counter changes atomically on Gate 11.
                      </p>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>sdk.reset_daily_state()</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Resets all spend counters (wallet and agents) back to zero. Should be called by a cron scheduler at midnight UTC. Uses <code>Ordering::Release</code> to safely propagate updates across all threads.
                      </p>
                    </div>

                    <div>
                      <code style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>sdk.evaluate_remote(tx: &SdkTransaction) -&gt; Result&lt;GatewayResponse, SdkError&gt;</code>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", marginTop: "4px", lineHeight: "1.5" }}>
                        Sends transaction payloads to the remote gateway server endpoint (<code>POST /api/validate</code>) for centralized threshold checks.
                      </p>
                    </div>
                  </div>
                </div>

                {/* CONCURRENCY MODEL */}
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>Lock-Free Concurrency & Memory Barriers</h3>
                <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.7)", marginBottom: "20px", fontWeight: 300, lineHeight: "1.6" }}>
                  To guarantee sub-microsecond validation, the SDK avoids traditional locking mechanisms like Mutexes, which cause thread contention bottlenecks. Instead, it utilizes atomic types (<code>AtomicU64</code>, <code>AtomicBool</code>) with specific memory barriers to achieve lock-free thread safety:
                </p>
                <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", color: "rgba(255,255,255,0.65)", fontWeight: 300, fontSize: "14px", marginBottom: "32px" }}>
                  <li><strong>Acquire Memory Ordering (load):</strong> Ensures that subsequent memory reads/writes cannot be reordered before this operation, guaranteeing that the thread reads the absolute latest spend data committed by other threads.</li>
                  <li><strong>Release Memory Ordering (store):</strong> Ensures that preceding memory operations are committed and visible to other threads before this write is executed.</li>
                  <li><strong>AcqRel Memory Ordering (fetch_add):</strong> Used for read-modify-write operations when committing increments. Combines both barriers to update spend counters atomically without locking the CPU cores.</li>
                </ul>

                {/* INSTALLATION GUIDE */}
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#fff", margin: "32px 0 16px" }}>Full Installation Guide</h3>
                <p style={{ fontSize: "14.5px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  Follow these step-by-step instructions to download, compile, and configure the SDK for your project environment.
                </p>

                <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "600", margin: "20px 0 10px" }}>Step 1: System Requirements</h4>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "12px", fontWeight: 300 }}>
                  Make sure your developer environment has the Rust toolchain (version 1.75.0 or higher) installed. Run <code>rustc --version</code> to verify. If not installed, get it via:
                </p>
                <TerminalBlock
                  title="Terminal"
                  code="curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
                  blockId="inst-rust"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "600", margin: "20px 0 10px" }}>Step 2: Add git Dependency</h4>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "12px", fontWeight: 300 }}>
                  Add the dependency directly inside your project's <code>Cargo.toml</code> file, pointing to the secure repository:
                </p>
                <TerminalBlock
                  title="Cargo.toml"
                  code={`[dependencies]\npriv-tract = { git = "https://github.com/aloodamz/Priv-tract-capstone-.git" }\ntokio = { version = "1", features = ["full"] }\nserde = { version = "1", features = ["derive"] }\nserde_json = "1"\nreqwest = { version = "0.11", features = ["json"] }\nsha2 = "0.10"\nblake3 = "1.5"\nbs58 = "0.5"\ntoml = "0.8"\nhex = "0.4"`}
                  blockId="inst-cargo"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "600", margin: "20px 0 10px" }}>Step 3: Setup Local Configurations</h4>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "12px", fontWeight: 300 }}>
                  Create a <code>config.toml</code> file in your project's root folder to configure allowed spend ceilings:
                </p>
                <TerminalBlock
                  title="config.toml"
                  code={`[wallet]\nkill_switch = false\nallowed_chain_id = 102 # Devnet\nwallet_tx_limit = "5000000000" # 5 SOL\nwallet_daily_cap = "20000000000" # 20 SOL\nmax_gas_price_gwei = 10000\ncontract_calls_allowed = true\nrecipient_whitelist = [\n  "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2"\n]\nfunction_selector_whitelist = [\n  "a9059cbb" # ERC-20 transfer selector\n]\n\n[agents.1]\ntx_limit = "1000000000" # 1 SOL\ndaily_cap = "3000000000" # 3 SOL\ndaily_tx_count_limit = 10`}
                  blockId="inst-toml"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h4 style={{ color: "#fff", fontSize: "14px", fontWeight: "600", margin: "20px 0 10px" }}>Step 4: Initialize and Verify</h4>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", marginBottom: "12px", fontWeight: 300 }}>
                  Write your main agent execution loop in <code>src/main.rs</code>, hashing identities locally to enable the Privacy Shield:
                </p>
                <TerminalBlock
                  title="src/main.rs"
                  code={`use priv_tract::priv_tract_sdk::*;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n    // Load embedded engine policies\n    let sdk = PrivTractSDK::from_config("config.toml")?;\n\n    // Generate cryptographic masks locally\n    let agent_shield = sdk.hash_agent_sha256(1);\n    let recipient_shield = sdk.hash_address_sha256("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2");\n\n    // Create SdkTransaction payload\n    let tx = SdkTransaction {\n        from_agent: agent_shield,\n        to: recipient_shield,\n        value_lamports: 1_200_000_000, // 1.2 SOL\n        priority_fee: 2500,\n        cluster_id: 102,\n        instruction_data: None,\n    };\n\n    // Evaluate policies locally in process (zero network latency)\n    match sdk.evaluate(&tx) {\n        Ok(receipt) => {\n            println!("✅ APPROVED: {}", receipt.message);\n            println!("Agent daily spend committed: {} lamports", receipt.agent_daily_spend);\n        }\n        Err(err) => {\n            println!("❌ DENIED: {}", err);\n        }\n    }\n\n    Ok(())\n}`}
                  blockId="inst-rs"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />
              </article>
            )}

            {activeSection === "api-specs" && (
              <article className="docs-article">
                <h1 style={{ fontFamily: "Instrument Serif, serif", fontSize: "3.5rem", fontWeight: 400, color: "#fff", marginBottom: "24px" }}>
                  API Specifications
                </h1>
                <p style={{ fontSize: "15px", lineHeight: "1.7", color: "rgba(255,255,255,0.65)", marginBottom: "24px", fontWeight: 300 }}>
                  Web3 agents submit a secure `POST` transaction validation payload to the off-chain middleware endpoint before signing and broadcasting.
                </p>

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>1. Validate Transaction Payload</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  Send a POST request containing transaction details to `http://127.0.0.1:3001/api/validate`:
                </p>
                <TerminalBlock
                  title="POST /api/validate"
                  code={CURL_SNIPPET}
                  blockId="curl"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>2. Success Response Payload (HTTP 200 OK)</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  When the transaction complies with all active wallet and agent policy rules, the engine returns an approved flag:
                </p>
                <TerminalBlock
                  title="Response (Success)"
                  code={RESPONSE_SUCCESS_SNIPPET}
                  blockId="success"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />

                <h3 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#fff", margin: "28px 0 12px" }}>3. Denied Response Payload (HTTP 403 Forbidden)</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.65)", marginBottom: "16px", fontWeight: 300 }}>
                  If a rule is violated (e.g. the transaction exceeds the agent's maximum allowed limit), the engine rejects the transaction immediately:
                </p>
                <TerminalBlock
                  title="Response (Denied)"
                  code={RESPONSE_DENIED_SNIPPET}
                  blockId="denied"
                  copiedId={copiedId}
                  onCopy={triggerCopy}
                />
              </article>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
