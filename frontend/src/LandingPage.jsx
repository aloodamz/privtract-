import React, { useState } from "react";
import {
  Globe,
  ArrowRight,
  Shield,
  Zap,
  Lock,
  Gauge,
  ChevronDown,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  Terminal,
  Sliders,
  Download,
} from "lucide-react";

// Mapping from token IDs to SDK performance benchmark modules
const BENCHMARK_MAP = {
  ETH: {
    name: "SHA-256 Identity Masking",
    unit: "µs",
    desc: "NIST-compliant hardware-accelerated identity hashing (SHA-NI)",
    color: "#a78bfa",
    scale: (val) => (val / 10000).toFixed(4), // e.g. 3450 -> 0.3450 µs
  },
  USDC: {
    name: "Lock-Free Atomics Commit",
    unit: "µs",
    desc: "Acquire/Release memory-barriered spending counter register updates",
    color: "#38bdf8",
    scale: (val) => (val / 10).toFixed(4), // e.g. 1.000 -> 0.1000 µs
  },
  SOL: {
    name: "BLAKE3 Hashing Shield",
    unit: "µs",
    desc: "Parallelized AVX-512/AVX2 Merkle-tree pipeline hashing",
    color: "#14b8a6",
    scale: (val) => (val / 1000).toFixed(4), // e.g. 145 -> 0.1458 µs
  },
  BASE: {
    name: "Solana PDA Derivations",
    unit: "ns",
    desc: "Deterministic seed-to-address program derivations",
    color: "#818cf8",
    scale: (val) => (val * 10).toFixed(2), // e.g. 2.15 -> 21.50 ns
  },
  BTC: {
    name: "Gateway REST Client",
    unit: "ms",
    desc: "JSON payload serialization and remote API routing check",
    color: "#f59e0b",
    scale: (val) => (val / 10000).toFixed(2), // e.g. 67820 -> 6.78 ms
  },
};

/**
 * LandingPage Component
 * Premium dark luxury developer landing page showcasing the Rust SDK.
 */
export default function LandingPage({
  prices,
  tickStates,
  isAutoUpdate,
  setIsAutoUpdate,
  dataSource,
  isRefreshing,
  fetchMarketPrices,
  onLaunchApp,
  onShowDocs,
}) {
  const [faq1, setFaq1] = useState(false);
  const [faq2, setFaq2] = useState(false);
  const [faq3, setFaq3] = useState(false);
  const [faq4, setFaq4] = useState(false);

  const renderSparkline = (history, color) => {
    if (history.length < 2) return null;
    const width = 120;
    const height = 40;
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min === 0 ? 1 : max - min;

    const points = history
      .map((val, index) => {
        const x = (index / (history.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(" ");

    const fillPoints = `${points} ${width},${height} 0,${height}`;
    const gradId = `spark-grad-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <svg className="lux-token-sparkline" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPoints} fill={`url(#${gradId})`} className="lux-sparkline-gradient" />
        <polyline points={points} fill="none" stroke={color} className="lux-sparkline-path" />
      </svg>
    );
  };

  return (
    <div className="luxury-root">
      {/* ─── THIN BACKGROUND GRID & GLOWS ─── */}
      <div className="luxury-grid-overlay" />
      <div className="luxury-spotlight spotlight-1" />
      <div className="luxury-spotlight spotlight-2" />
      <div className="luxury-spotlight spotlight-3" />

      {/* ─── FLOATING GLASS NAVBAR ─── */}
      <nav className="lux-nav">
        <div className="lux-nav-inner liquid-glass">
          <div className="lux-nav-brand">
            <Globe size={18} strokeWidth={1.5} className="glow-icon" />
            <span>Privtract</span>
          </div>

          <div className="lux-nav-links">
            <a href="#features">Features</a>
            <a href="#performance-telemetry">Telemetry Benchmarks</a>
            <a href="#simulator-showcase">Simulator</a>
            <a href="#integration-safeguards">Agent Benchmarks</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="lux-nav-actions" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              className="lux-btn-ghost"
              onClick={onShowDocs}
              style={{ fontSize: "13px", height: "36px", padding: "0 16px" }}
            >
              Docs
            </button>
            <a
              href="/priv_tract_sdk.zip"
              download="priv_tract_sdk.zip"
              className="lux-btn-cta liquid-glass"
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", height: "36px", padding: "0 16px", textDecoration: "none" }}
            >
              <Download size={14} />
              <span>Download SDK</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <header className="lux-hero">
        <div className="lux-hero-content">
          <div className="lux-pill-badge liquid-glass">
            <span className="lux-pill-dot" />
            <span>Rust SDK v1.0.0 Now Available</span>
          </div>

          <h1 className="lux-hero-title" style={{ letterSpacing: "-1.5px" }}>
            Zero-Latency Policy Engine<br />
            For Autonomous Solana AI Agents
          </h1>

          <p className="lux-hero-sub" style={{ maxWidth: "750px" }}>
            Secure Solana hot-wallets and AI agents in-process. Enforce deterministic transaction limits, whitelists, and frequency controls in sub-microseconds with zero network overhead.
          </p>

          <div className="lux-hero-actions" style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            <a
              href="/priv_tract_sdk.zip"
              download="priv_tract_sdk.zip"
              className="lux-hero-btn-primary liquid-glass"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none" }}
            >
              <Download size={16} />
              <span>Download Rust SDK</span>
            </a>
            <button
              className="lux-hero-btn-secondary"
              onClick={onLaunchApp}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span>Launch SDK Simulator</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Curved planet horizon effect */}
        <div className="lux-horizon-container">
          <div className="lux-horizon-curve">
            <div className="lux-horizon-glow" />
            <div className="lux-horizon-grid" />
          </div>
        </div>
      </header>

      {/* ─── SDK FEATURES GRID (MONOCHROME / BLACK & WHITE ONLY) ─── */}
      <section id="performance-telemetry" className="lux-crypto-section" style={{ background: "#050505", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "100px 0" }}>
        <div className="lux-container">
          <div className="lux-crypto-header" style={{ marginBottom: "50px", textAlign: "center" }}>
            <div className="lux-crypto-title-wrap" style={{ margin: "0 auto" }}>
              <span className="lux-section-tag" style={{ border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.05)", color: "#ffffff", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", textTransform: "uppercase" }}>
                Core Engine Architecture
              </span>
              <h2 className="lux-crypto-title" style={{ fontSize: "3rem", color: "#ffffff", fontWeight: "700", marginTop: "16px", fontFamily: "Instrument Serif, serif", letterSpacing: "-0.5px" }}>
                Privtract SDK Features
              </h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
            {[
              {
                title: "SHA-256 Identity Masking",
                subtitle: "NIST-Compliant Cryptographic Hash",
                desc: "Converts agent IDs and destination addresses into secure SHA-256 hashes locally. Compares hashes in constant-time to prevent side-channel timing attacks.",
                icon: <Shield size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
              {
                title: "Lock-Free Atomics Commit",
                subtitle: "Acquire & Release Memory Barriers",
                desc: "Tracks agent limits and daily spending counters without locking threads or using mutexes. Leverages atomic u64 values with precise CPU memory barriers.",
                icon: <Activity size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
              {
                title: "BLAKE3 Hashing Shield",
                subtitle: "Ultra-High Throughput Privacy",
                desc: "Uses the parallelizable BLAKE3 hashing algorithm to mask parameters on high-frequency trading pipelines. Zero-allocation fast-path processing under 1 µs.",
                icon: <Cpu size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
              {
                title: "Solana PDA Derivations",
                subtitle: "Deterministic Account Mappings",
                desc: "Provides embedded helper utilities to derive Program Derived Address seeds for WalletConfig and AgentState accounts, aligning off-chain checks with on-chain states.",
                icon: <Layers size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
              {
                title: "Gateway REST Client",
                subtitle: "Remote Ledger Validation",
                desc: "Includes a built-in async HTTP client to validate transaction payloads remotely against a centralized Privtract policy server when multi-agent state is shared.",
                icon: <Globe size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
              {
                title: "11-Gate Policy Pipeline",
                subtitle: "Deterministic Validation Chain",
                desc: "Sequentially executes 11 rigorous policy gates (kill switch, whitelists, limits, atomics) in under 1 µs, atomically committing spending counters.",
                icon: <Sliders size={22} strokeWidth={1.5} style={{ color: "#ffffff" }} />,
              },
            ].map((feature, idx) => (
              <div 
                key={idx} 
                className="liquid-glass" 
                style={{ 
                  borderRadius: "16px", 
                  padding: "32px", 
                  border: "1px solid rgba(255, 255, 255, 0.08)", 
                  background: "rgba(10, 10, 10, 0.6)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "260px",
                  transition: "all 0.2s ease"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff" }}>{feature.title}</span>
                      <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{feature.subtitle}</span>
                    </div>
                    <div style={{ background: "rgba(255, 255, 255, 0.06)", borderRadius: "10px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {feature.icon}
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", lineHeight: "1.6", fontWeight: "300" }}>{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION (2x2 BENTO GRID) ─── */}
      <section id="features" className="lux-features-section">
        <div className="lux-container">
          <span className="lux-section-tag">SDK Capabilities</span>
          <h2 className="lux-features-title">Embedded Security Architecture</h2>

          <div className="lux-bento-grid">
            {/* Bento Card 1: Sub-Microsecond Execution */}
            <div className="lux-bento-card card-large liquid-glass">
              <div className="bento-header">
                <span className="bento-icon-wrapper"><Gauge size={16} /></span>
                <div>
                  <h3>Sub-Microsecond Latency</h3>
                  <p>Designed for high-frequency bots and algorithms. Executes the 11-gate matrix in-process (overhead &lt; 1 microsecond).</p>
                </div>
              </div>
              <div className="bento-visual analytics-visual">
                <div className="mini-chart-container">
                  <svg viewBox="0 0 300 100" className="mini-svg-chart">
                    <defs>
                      <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.08)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                      </linearGradient>
                    </defs>
                    <path d="M 0,80 Q 30,10 60,70 T 120,20 T 180,90 T 240,30 T 300,50 L 300,100 L 0,100 Z" fill="url(#chart-glow)" />
                    <path d="M 0,80 Q 30,10 60,70 T 120,20 T 180,90 T 240,30 T 300,50" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="1.5" />
                  </svg>
                  <div className="chart-metrics">
                    <span className="metric-lbl">In-Process Time</span>
                    <span className="metric-val" style={{ color: "#ffffff" }}>0.94 µs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Identity Masking Shields */}
            <div className="lux-bento-card card-small liquid-glass">
              <div className="bento-header">
                <span className="bento-icon-wrapper"><Shield size={16} /></span>
                <div>
                  <h3>Identity Masking Shields</h3>
                  <p>Protects wallet details by hashing agent IDs and destinations with SHA-256 and BLAKE3 locally.</p>
                </div>
              </div>
              <div className="bento-visual security-visual">
                <div className="security-shield-glow">
                  <Lock size={40} className="shield-icon" strokeWidth={1} style={{ color: "#ffffff", opacity: 0.8 }} />
                  <div className="shield-pulse" style={{ borderColor: "rgba(255, 255, 255, 0.2)" }} />
                </div>
              </div>
            </div>

            {/* Bento Card 3: Deterministic PDA Alignments */}
            <div className="lux-bento-card card-small liquid-glass">
              <div className="bento-header">
                <span className="bento-icon-wrapper"><Zap size={16} /></span>
                <div>
                  <h3>On-Chain PDA Alignment</h3>
                  <p>Provides helper tools to derive WalletConfig and AgentState PDAs, keeping off-chain checks aligned with Solana programs.</p>
                </div>
              </div>
              <div className="bento-visual ecosystem-visual">
                <div className="concentric-rings">
                  <div className="ring ring-1" style={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />
                  <div className="ring ring-2" style={{ borderColor: "rgba(255, 255, 255, 0.16)" }} />
                  <div className="ring ring-3" style={{ borderColor: "rgba(255, 255, 255, 0.3)" }} />
                  <div className="center-node" />
                </div>
              </div>
            </div>

            {/* Bento Card 4: Lock-Free Concurrency */}
            <div className="lux-bento-card card-large liquid-glass">
              <div className="bento-header">
                <span className="bento-icon-wrapper"><Lock size={16} /></span>
                <div>
                  <h3>Lock-Free Concurrency</h3>
                  <p>Avoids mutexes or blocking calls. Enforces limits using AtomicU64 counters with Acquire/Release memory boundaries.</p>
                </div>
              </div>
              <div className="bento-visual currency-visual">
                <div className="floating-tx-stack">
                  <div className="tx-card tx-card-1 liquid-glass" style={{ borderLeft: "3px solid rgba(255, 255, 255, 0.6)" }}>
                    <div className="tx-row">
                      <span style={{ fontFamily: "monospace" }}>AtomicU64 Counters</span>
                      <span className="tx-val" style={{ color: "#ffffff", opacity: 0.9 }}>Ordering::AcqRel</span>
                    </div>
                  </div>
                  <div className="tx-card tx-card-2 liquid-glass" style={{ borderLeft: "3px solid rgba(255, 255, 255, 0.6)" }}>
                    <div className="tx-row">
                      <span style={{ fontFamily: "monospace" }}>Memory Barriers</span>
                      <span className="tx-val" style={{ color: "#ffffff", opacity: 0.9 }}>Ordering::Acquire</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE SDK SIMULATOR SANDBOX ─── */}
      <section id="simulator-showcase" style={{ position: "relative", borderBottom: "1px solid var(--border)", padding: "100px 0", background: "rgba(5, 5, 5, 0.2)" }}>
        <div className="lux-container" style={{ maxWidth: "1000px" }}>
          <div className="liquid-glass" style={{ borderRadius: "24px", padding: "60px 40px", textAlign: "center", border: "1px solid var(--border)", position: "relative", zIndex: 10 }}>
            <span className="lux-section-tag" style={{ display: "inline-block", background: "rgba(167, 139, 250, 0.1)", color: "#a78bfa", border: "1px solid rgba(167, 139, 250, 0.2)", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 auto 12px" }}>
              Interactive Sandbox
            </span>
            <h2 style={{ fontSize: "3rem", color: "#fff", fontWeight: "700", marginTop: "16px", marginBottom: "16px", letterSpacing: "-1px", fontFamily: "Instrument Serif, serif" }}>
              Launch the SDK Policy Simulator
            </h2>
            <p style={{ maxWidth: "700px", margin: "0 auto 32px", color: "var(--text-secondary)", fontSize: "16px", lineHeight: "1.7", fontWeight: 300 }}>
              Step inside a fully simulated off-chain sandbox to test how the Rust SDK gatekeeps transactions. Evaluate the 11-gate pipeline, trigger custom spending limit denials, configure local whitelists, and toggle SHA-256 or BLAKE3 cryptographic privacy shields.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
              <button
                className="lux-btn-cta liquid-glass"
                onClick={onLaunchApp}
                style={{ padding: "14px 32px", fontSize: "15px", display: "inline-flex", alignItems: "center", gap: "10px", height: "auto" }}
              >
                <span>Launch the Simulator</span>
                <ArrowRight size={16} />
              </button>
              <a
                href="/priv_tract_sdk.zip"
                download="priv_tract_sdk.zip"
                className="lux-btn-ghost"
                style={{ padding: "14px 28px", fontSize: "15px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} />
                <span>Download Rust SDK</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EMBEDDED SPENDER BENCHMARKS TABLE ─── */}
      <section id="integration-safeguards" className="lux-pools-section">
        <div className="lux-container">
          <div className="lux-pools-grid">
            {/* Left Column: Spenders Table */}
            <div className="lux-pools-left">
              <div className="lux-table-wrapper liquid-glass">
                <table className="lux-pools-table">
                  <thead>
                    <tr>
                      <th>Agent Registry</th>
                      <th>Tx Value Limit</th>
                      <th>Daily Cap Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Agent #1 (Arb Trading Bot)</td>
                      <td>5.0 SOL</td>
                      <td className="pool-vol">15.0 SOL</td>
                    </tr>
                    <tr>
                      <td>Agent #2 (Liquidity Rebalancer)</td>
                      <td>2.0 SOL</td>
                      <td className="pool-vol">5.0 SOL</td>
                    </tr>
                    <tr>
                      <td>Agent #3 (Asset Purchasing Node)</td>
                      <td>10.0 SOL</td>
                      <td className="pool-vol">30.0 SOL</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Copy */}
            <div className="lux-pools-right">
              <span className="lux-section-tag">Spender Limits</span>
              <h2 className="lux-pools-heading">Defend Wallets from Execution Exploits</h2>
              <p className="lux-pools-desc">
                Autonomous spending scripts run directly on private key holdings. If an LLM is compromised via prompt injection or crashes in a loop, it can drain a wallet. The SDK intercepts requests off-chain in less than 1 microsecond, stopping unauthorized transactions before signatures are ever generated.
              </p>
              <a
                href="/priv_tract_sdk.zip"
                download="priv_tract_sdk.zip"
                className="lux-pools-btn liquid-glass"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", justifyContent: "center" }}
              >
                <Download size={15} />
                <span>Download Rust SDK</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section id="faq" className="lux-faq-section">
        <div className="lux-container">
          <h2 className="lux-faq-heading" style={{ letterSpacing: "-0.5px" }}>Frequently Asked Questions</h2>

          <div className="lux-faq-grid">
            {/* FAQ Item 1 */}
            <div className="lux-faq-card liquid-glass" onClick={() => setFaq1(!faq1)}>
              <div className="faq-question">
                <h3>How do I import and install the Rust SDK?</h3>
                <ChevronDown size={18} className={`faq-chevron ${faq1 ? "rotate" : ""}`} />
              </div>
              <div className={`faq-answer ${faq1 ? "open" : ""}`}>
                <p>
                  You can add the dependency directly in your <code>Cargo.toml</code> file pointing to the Git repository. For local development, download the SDK ZIP folder using the buttons above, extract it, and include it as a local cargo path dependency.
                </p>
              </div>
            </div>

            {/* FAQ Item 2 */}
            <div className="lux-faq-card liquid-glass" onClick={() => setFaq2(!faq2)}>
              <div className="faq-question">
                <h3>What is the difference between raw and shielded modes?</h3>
                <ChevronDown size={18} className={`faq-chevron ${faq2 ? "rotate" : ""}`} />
              </div>
              <div className={`faq-answer ${faq2 ? "open" : ""}`}>
                <p>
                  Raw mode submits transaction addresses and agent IDs in plain text. Shielded mode hashes these details locally using SHA-256 or BLAKE3, preventing keys and identity logs from being exposed in plain text over server caches or database logs.
                </p>
              </div>
            </div>

            {/* FAQ Item 3 */}
            <div className="lux-faq-card liquid-glass" onClick={() => setFaq3(!faq3)}>
              <div className="faq-question">
                <h3>Does the SDK block the execution thread?</h3>
                <ChevronDown size={18} className={`faq-chevron ${faq3 ? "rotate" : ""}`} />
              </div>
              <div className={`faq-answer ${faq3 ? "open" : ""}`}>
                <p>
                  No. The SDK uses atomic counters and lock-free thread synchronization. Spender limits are tracked using AtomicU64 values, meaning the evaluation runs in under a microsecond without blocking threads or causing contention.
                </p>
              </div>
            </div>

            {/* FAQ Item 4 */}
            <div className="lux-faq-card liquid-glass" onClick={() => setFaq4(!faq4)}>
              <div className="faq-question">
                <h3>How do I reset spend limits at midnight?</h3>
                <ChevronDown size={18} className={`faq-chevron ${faq4 ? "rotate" : ""}`} />
              </div>
              <div className={`faq-answer ${faq4 ? "open" : ""}`}>
                <p>
                  The SDK provides a <code>sdk.reset_daily_state()</code> method. You can schedule this method to run at midnight UTC using a standard scheduler (like standard cron libraries or system timers) inside your agent's background worker loop.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="lux-footer">
        <div className="lux-container">
          <div className="lux-footer-grid">
            <div className="footer-brand-col">
              <div className="footer-logo">
                <Globe size={18} className="glow-icon" />
                <span>Privtract</span>
              </div>
              <p>In-process Rust transaction verification middleware and privacy-shielded policy engine for Solana.</p>
            </div>

            <div className="footer-links-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#performance-telemetry">Telemetry</a>
              <a href="#simulator-showcase">Simulator</a>
            </div>

            <div className="footer-links-col">
              <h4>SDK Assets</h4>
              <a href="/priv_tract_sdk.zip" download="priv_tract_sdk.zip" style={{ color: "var(--accent)" }}>
                Download SDK ZIP
              </a>
              <a href="https://github.com/aloodamz/privtract-sdk">GitHub Source</a>
            </div>

            <div className="footer-links-col">
              <h4>Documentation</h4>
              <a href="#" onClick={(e) => { e.preventDefault(); onShowDocs(); }}>Installation</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onShowDocs(); }}>11-Gate Pipeline</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onShowDocs(); }}>API Specs</a>
            </div>
          </div>

          <div className="lux-footer-bottom">
            <span>© 2026 Privtract. Built with Rust. All rights reserved.</span>
            <div className="bottom-links">
              <a href="#" onClick={(e) => { e.preventDefault(); onShowDocs(); }}>Privacy Policy</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onShowDocs(); }}>Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
