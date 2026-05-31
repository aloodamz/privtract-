import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  MoreHorizontal,
  X,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Globe,
} from "lucide-react";
import PoliciesPage from "./PoliciesPage";
import AgentsPage from "./AgentsPage";
import SettingsPage from "./SettingsPage";
import LandingPage from "./LandingPage";
import DocsPage from "./DocsPage";
import SdkSimulatorPage from "./SdkSimulatorPage";
import { fmt, pct, formatIdentifier } from "./utils/helpers";
import "./index.css";

const PAGE_TITLES = {
  dashboard: "Overview",
  policies: "Policies",
  agents: "Agents",
  settings: "Settings",
  "sdk-simulator": "SDK Simulator",
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Empty state shown when backend is not reachable
const OFFLINE_DEMO_STATE = {
  wallet_daily_spend: "0",
  wallet_daily_cap: "0",
  wallet_tx_limit: "0",
  kill_switch: false,
  allowed_chain_id: 0,
  max_gas_price_gwei: 0,
  contract_calls_allowed: false,
  recipient_whitelist: [],
  function_selector_whitelist: [],
  agents: {},
  activity: [],
  admin_controls_configured: false,
};



const INITIAL_TOKENS = {
  ETH: { symbol: "ETH", name: "Ethereum", price: 3450.25, change24h: 2.45, history: [3400, 3410, 3430, 3420, 3440, 3435, 3450.25], color: "#a78bfa" },
  USDC: { symbol: "USDC", name: "USDC Stablecoin", price: 1.0000, change24h: 0.01, history: [1.0000, 0.9998, 1.0002, 1.0000, 1.0001, 0.9999, 1.0000], color: "#2563eb" },
  SOL: { symbol: "SOL", name: "Solana", price: 145.80, change24h: 5.12, history: [138.00, 140.00, 142.00, 141.00, 144.00, 143.50, 145.80], color: "#14b8a6" },
  BASE: { symbol: "BASE", name: "Base Protocol", price: 2.1500, change24h: -1.24, history: [2.2500, 2.2200, 2.2000, 2.1800, 2.1600, 2.1400, 2.1500], color: "#0052FF" },
  BTC: { symbol: "BTC", name: "Bitcoin", price: 67820.50, change24h: 1.85, history: [66500.00, 66800.00, 67200.00, 67000.00, 67500.00, 67400.00, 67820.50], color: "#f59e0b" }
};

/**
 * Main Application Routing and Layout Container
 */
function App() {
  const [state, setState] = useState(null);
  const [adminToken, setAdminToken] = useState("");
  const [networkMode, setNetworkMode] = useState("solana");
  const [txForm, setTxForm] = useState({
    from_agent: "",
    to: "",
    value: "",
    gas_price_gwei: "",
    chain_id: "",
    calldata: "",
  });
  const [txType, setTxType] = useState("recipient"); // "recipient" | "agent"
  const [txCurrency, setTxCurrency] = useState("SOL");
  const [usdcChain, setUsdcChain] = useState("solana"); // "solana" | "ethereum"
  const [faucetUsdcChain, setFaucetUsdcChain] = useState("solana"); // "solana" | "ethereum"
  const [txStatus, setTxStatus] = useState(null);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState("dashboard");
  const [view, setView] = useState("landing");
  const [copyState, setCopyState] = useState(null);

  // ─── Market Oracle State ───
  const [prices, setPrices] = useState(INITIAL_TOKENS);
  const [tickStates, setTickStates] = useState({});
  const [isAutoUpdate, setIsAutoUpdate] = useState(true);
  const [dataSource, setDataSource] = useState("simulated");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Wallet Asset Holdings & Top Up State ───
  const [walletHoldings, setWalletHoldings] = useState({
    SOL: 0,
    SOL_USDC: 0,
    ETH_USDC: 0,
    ETH: 0,
    BTC: 0
  });
  const [showFundWalletModal, setShowFundWalletModal] = useState(false);
  const [fundWalletForm, setFundWalletForm] = useState({ token: "SOL", amount: "" });
  const [isFundingWallet, setIsFundingWallet] = useState(false);

  const triggerTick = (symbol, direction) => {
    setTickStates(prev => ({ ...prev, [symbol]: direction }));
    setTimeout(() => {
      setTickStates(prev => ({ ...prev, [symbol]: null }));
    }, 1000);
  };

  const runSimulationTick = () => {
    setPrices(prev => {
      const updated = { ...prev };
      Object.keys(prev).forEach(symbol => {
        const volatility = symbol === "USDC" ? 0.0002 : 0.0018;
        const changePercent = (Math.random() - 0.485) * volatility;
        const current = prev[symbol];
        const priceDiff = current.price * changePercent;
        const newPrice = parseFloat((current.price + priceDiff).toFixed(symbol === "USDC" || symbol === "BASE" ? 4 : 2));
        
        if (newPrice !== current.price) {
          triggerTick(symbol, newPrice > current.price ? "up" : "down");
        }
        
        const history = [...current.history];
        history.push(newPrice);
        if (history.length > 10) history.shift();
        
        const changeDiff = (Math.random() - 0.5) * 0.12;
        const newChange24h = parseFloat((current.change24h + changeDiff).toFixed(2));
        
        updated[symbol] = {
          ...current,
          price: newPrice,
          change24h: newChange24h,
          history
        };
      });
      return updated;
    });
  };

  const fetchMarketPrices = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      // Use a CORS-safe proxy to avoid browser CORS blocks on CoinGecko
      const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,solana,base,bitcoin&vs_currencies=usd&include_24hr_change=true";
      const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(COINGECKO_URL)}`);
      if (!res.ok) throw new Error("API Limit reached");
      const data = await res.json();
      
      setPrices(prev => {
        const updated = { ...prev };
        const mappings = {
          ethereum: "ETH",
          "usd-coin": "USDC",
          solana: "SOL",
          base: "BASE",
          bitcoin: "BTC"
        };
        
        Object.entries(mappings).forEach(([cgId, symbol]) => {
          if (data[cgId]) {
            const newPrice = data[cgId].usd;
            const newChange = data[cgId].usd_24h_change || 0;
            const oldPrice = prev[symbol].price;
            
            if (newPrice !== oldPrice) {
              triggerTick(symbol, newPrice > oldPrice ? "up" : "down");
            }
            
            const history = [...prev[symbol].history];
            if (history[history.length - 1] !== newPrice) {
              history.push(newPrice);
              if (history.length > 10) history.shift();
            }
            
            updated[symbol] = {
              ...prev[symbol],
              price: newPrice,
              change24h: parseFloat(newChange.toFixed(2)),
              history
            };
          }
        });
        return updated;
      });
      setDataSource("api");
    } catch (err) {
      console.warn("CoinGecko rate limit or CORS. Running custom high-fidelity simulated core.", err);
      setDataSource("simulated");
      if (isManual) {
        runSimulationTick();
      }
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  };

  const handleFundWallet = (e) => {
    e.preventDefault();
    if (!fundWalletForm.amount || parseFloat(fundWalletForm.amount) <= 0) return;
    setIsFundingWallet(true);
    
    const targetToken = fundWalletForm.token === "USDC" 
      ? (faucetUsdcChain === "solana" ? "SOL_USDC" : "ETH_USDC")
      : fundWalletForm.token;

    // Simulate network confirmation (1.2 seconds)
    setTimeout(() => {
      setWalletHoldings(prev => ({
        ...prev,
        [targetToken]: prev[targetToken] + parseFloat(fundWalletForm.amount)
      }));
      setIsFundingWallet(false);
      setShowFundWalletModal(false);
      setFundWalletForm({ token: "SOL", amount: "" });
    }, 1200);
  };

  const renderFundWalletModal = () => {
    if (!showFundWalletModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowFundWalletModal(false)}>
        <div className="modal-content" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h2>Fund Web3 Wallet</h2>
              <p style={{ margin: "3px 0 0" }}>Faucet & Asset Top-up Oracle</p>
            </div>
            <button onClick={() => setShowFundWalletModal(false)} className="modal-close" style={{ position: "static" }}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleFundWallet} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="form-field">
              <label>Select Asset</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
                {["SOL", "USDC", "ETH", "BTC"].map((tok) => {
                  const active = fundWalletForm.token === tok;
                  const color = INITIAL_TOKENS[tok]?.color || "var(--accent)";
                  return (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setFundWalletForm({ ...fundWalletForm, token: tok })}
                      style={{
                        padding: "10px 8px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        border: `1px solid ${active ? color : "var(--border)"}`,
                        background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                        color: active ? color : "var(--text-secondary)",
                        fontSize: "13px",
                        fontWeight: "600",
                        transition: "all 0.15s",
                      }}
                    >
                      {tok}
                    </button>
                  );
                })}
              </div>
            </div>

            {fundWalletForm.token === "USDC" && (
              <div className="form-field" style={{ marginTop: "4px", marginBottom: "8px" }}>
                <label>USDC Network Option</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setFaucetUsdcChain("solana")}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: `1px solid ${faucetUsdcChain === "solana" ? "#14b8a6" : "var(--border)"}`,
                      background: faucetUsdcChain === "solana" ? "rgba(20,184,166,0.06)" : "transparent",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "600",
                      transition: "all 0.15s"
                    }}
                  >
                    Solana (SPL-USDC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaucetUsdcChain("ethereum")}
                    style={{
                      padding: "10px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: `1px solid ${faucetUsdcChain === "ethereum" ? "#a78bfa" : "var(--border)"}`,
                      background: faucetUsdcChain === "ethereum" ? "rgba(167,139,250,0.06)" : "transparent",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: "600",
                      transition: "all 0.15s"
                    }}
                  >
                    Ethereum (ERC-USDC)
                  </button>
                </div>
              </div>
            )}

            <div className="form-field">
              <label>Amount to Top Up</label>
              <input
                type="number"
                step="any"
                min="0.0001"
                required
                value={fundWalletForm.amount}
                onChange={(e) => setFundWalletForm({ ...fundWalletForm, amount: e.target.value })}
                placeholder={`e.g. 50 ${fundWalletForm.token}`}
              />
            </div>

            <button
              type="submit"
              className="lux-btn-cta"
              style={{
                width: "100%",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "4px",
                background: INITIAL_TOKENS[fundWalletForm.token]?.color || "var(--accent)",
                color: "#fff",
                height: "44px",
              }}
              disabled={isFundingWallet}
            >
              {isFundingWallet ? (
                <div className="funding-step-spinner" style={{ width: "16px", height: "16px" }} />
              ) : (
                <Plus size={15} />
              )}
              {isFundingWallet ? "Processing..." : `Fund Wallet with ${fundWalletForm.token}`}
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ─── Web3 Wallet Management States ───
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState(null); // 'Phantom' | 'MetaMask' etc.
  const [connectionStep, setConnectionStep] = useState(0); // 0: Idle, 1: Requesting, 2: Signed, 3: Success
  const dropdownRef = useRef(null);

  // Decorative live telemetry chart values
  const [gasBars, setGasBars] = useState([
    65, 42, 78, 35, 90, 55, 68, 45, 82, 60, 38, 72, 50, 85, 40, 75, 48, 88, 52, 70,
  ]);
  const [txBars, setTxBars] = useState([
    50, 62, 40, 75, 55, 48, 80, 35, 70, 45, 60, 38, 72, 52, 85, 42, 68, 55, 78, 50,
  ]);

  const activeWallet = useMemo(
    () => connectedWallets.find((w) => w.active) || null,
    [connectedWallets]
  );

  const handleCopyText = (text, id, type) => {
    navigator.clipboard.writeText(text);
    setCopyState({ id, type });
    setTimeout(() => setCopyState(null), 1500);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowWalletDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync network state when active wallet switches
  useEffect(() => {
    if (activeWallet) {
      setNetworkMode(activeWallet.network);
    }
  }, [activeWallet]);

  // Real-Time Web3 Browser Injected Wallet Connect Flow
  const triggerProviderConnect = async (provider) => {
    setConnectingProvider(provider);
    setConnectionStep(1); // 1: Requesting approval
    
    try {
      if (provider === "Phantom" || provider === "Solflare") {
        const isSolflare = provider === "Solflare";
        const walletObj = isSolflare ? window.solflare : window.solana;
        
        if (!walletObj) {
          throw new Error(`${provider} extension is not installed in your browser. Please install the browser extension to connect real Solana wallets.`);
        }
        
        // Connect to the actual browser wallet
        const resp = await walletObj.connect();
        const address = resp.publicKey.toString();
        
        setConnectionStep(2); // 2: Requesting signature
        // Request signature consensus session
        try {
          const messageStr = "Authorize Priv-Tract transaction validation ledger session: " + Date.now();
          const encodedMessage = new TextEncoder().encode(messageStr);
          await walletObj.signMessage(encodedMessage, "utf8");
        } catch (signErr) {
          console.warn("Signature declined by user, continuing session sync.", signErr);
        }
        
        setConnectionStep(3); // 3: Success
        
        let balance = "142.50";
        try {
          // Query real Solana balance from public RPC
          const rpcRes = await fetch("https://api.devnet.solana.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getBalance",
              params: [address]
            })
          });
          const rpcData = await rpcRes.json();
          if (rpcData.result) {
            balance = (rpcData.result.value / 1000000000).toFixed(2);
          }
        } catch (rpcErr) {
          console.warn("Could not query Solana balance, using default devnet ledger.", rpcErr);
        }
        
        setConnectedWallets(prev => {
          const exists = prev.some(w => w.address === address);
          const deactivated = prev.map(w => ({ ...w, active: false }));
          if (exists) {
            return deactivated.map(w => w.address === address ? { ...w, active: true, balance } : w);
          }
          return [
            ...deactivated,
            {
              address,
              provider,
              network: "solana",
              balance,
              active: true
            }
          ];
        });
      } else if (provider === "MetaMask" || provider === "Coinbase Wallet") {
        if (!window.ethereum) {
          throw new Error("No EVM injected browser wallet extension found. Please install MetaMask or Coinbase Wallet.");
        }
        
        // Request actual EVM account access
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];
        
        setConnectionStep(2); // 2: Requesting signature
        try {
          const messageStr = "Authorize Priv-Tract transaction validation ledger session: " + Date.now();
          await window.ethereum.request({
            method: "personal_sign",
            params: [messageStr, address]
          });
        } catch (signErr) {
          console.warn("Signature declined by user, continuing session sync.", signErr);
        }
        
        setConnectionStep(3); // 3: Success
        
        let balance = "12.45";
        try {
          // Query standard ETH balance
          const rpcRes = await window.ethereum.request({
            method: "eth_getBalance",
            params: [address, "latest"]
          });
          if (rpcRes) {
            balance = (parseInt(rpcRes, 16) / 1000000000000000000).toFixed(4);
          }
        } catch (rpcErr) {
          console.warn("Could not query EVM balance.", rpcErr);
        }
        
        setConnectedWallets(prev => {
          const exists = prev.some(w => w.address === address);
          const deactivated = prev.map(w => ({ ...w, active: false }));
          if (exists) {
            return deactivated.map(w => w.address === address ? { ...w, active: true, balance } : w);
          }
          return [
            ...deactivated,
            {
              address,
              provider,
              network: "ethereum",
              balance,
              active: true
            }
          ];
        });
      }
      
      setTimeout(() => {
        setConnectingProvider(null);
        setConnectionStep(0);
        setShowWalletModal(false);
        setView("landing");
        // Scroll to simulator if it exists
        setTimeout(() => {
          const el = document.getElementById("simulator-showcase");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }, 800);
      
    } catch (err) {
      console.error("Wallet connection failed:", err);
      setTxStatus({
        type: "error",
        msg: err.message || "Failed to establish secure real-time wallet sync session."
      });
      setConnectingProvider(null);
      setConnectionStep(0);
    }
  };

  const switchActiveAccount = (address) => {
    setConnectedWallets((prev) =>
      prev.map((w) => ({
        ...w,
        active: w.address === address,
      }))
    );
    setShowWalletDropdown(false);
  };

  const disconnectWalletAccount = (address, e) => {
    e.stopPropagation();
    setConnectedWallets((prev) => {
      const filtered = prev.filter((w) => w.address !== address);
      // If we deleted the active one, activate the first remaining
      if (filtered.length > 0 && !filtered.some((w) => w.active)) {
        filtered[0].active = true;
      }
      return filtered;
    });
  };

  // Fetch state on mount and update charts periodically
  useEffect(() => {
    fetchState();
    fetchMarketPrices();
    const timer = setInterval(() => setNow(new Date()), 1000);
    const refreshTimer = setInterval(() => fetchState(), 5000);
    const animTimer = setInterval(() => {
      const perturb = (prev) =>
        prev.map((h) => {
          const target = h + (Math.random() * 30 - 15);
          return Math.max(20, Math.min(100, target));
        });
      setGasBars(perturb);
      setTxBars(perturb);
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
      clearInterval(animTimer);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAutoUpdate) {
        runSimulationTick();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoUpdate]);

  useEffect(() => {
    const apiInterval = setInterval(() => {
      if (isAutoUpdate) {
        fetchMarketPrices();
      }
    }, 30000);
    return () => clearInterval(apiInterval);
  }, [isAutoUpdate]);

  async function fetchState() {
    // If no backend URL is configured, run in offline demo mode
    if (!API_BASE_URL) {
      setState((prev) => prev ?? OFFLINE_DEMO_STATE);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/state`);
      if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);
      const data = await res.json();
      setState(data);
    } catch (e) {
      console.warn("Backend unreachable — running in offline demo mode.", e);
      setState((prev) => prev ?? OFFLINE_DEMO_STATE);
    }
  }

  const toggleKillSwitch = async () => {
    if (!state) return;
    if (!state.admin_controls_configured) {
      setTxStatus({
        type: "error",
        msg: "Server-side admin token is not configured.",
      });
      return;
    }
    if (!adminToken.trim()) {
      setTxStatus({
        type: "error",
        msg: "Enter the admin token to change the kill switch.",
      });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/kill-switch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken.trim(),
        },
        body: JSON.stringify({ active: !state.kill_switch }),
      });
      const data = await res.json();
      setTxStatus({ type: res.ok ? "success" : "error", msg: data.message });
      if (res.ok) fetchState();
    } catch (e) {
      setTxStatus({ type: "error", msg: e.message });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTxStatus(null);
    const fromAgentVal = txForm.from_agent.trim();
    const payload = {
      from_agent: /^\d+$/.test(fromAgentVal) ? parseInt(fromAgentVal) : fromAgentVal,
      to: txForm.to.trim(),
      value: txForm.value,
      gas_price_gwei: parseInt(txForm.gas_price_gwei),
      chain_id: parseInt(txForm.chain_id),
      calldata: txForm.calldata || null,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTxStatus({ type: res.ok ? "success" : "error", msg: data.message });
      fetchState();
    } catch (e) {
      setTxStatus({ type: "error", msg: e.message });
    }
  };

  const onChange = (e) =>
    setTxForm({ ...txForm, [e.target.name]: e.target.value });

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const bars = useMemo(() => {
    if (!state) return [];
    const out = [];
    for (let i = 0; i < 20; i++) {
      const item = state.activity[19 - i];
      if (item) {
        out.push({ h: 30 + ((i * 17) % 50), status: item.status });
      } else {
        out.push({ h: 10 + ((i * 13) % 25), status: "none" });
      }
    }
    return out;
  }, [state]);

  const stats = useMemo(() => {
    if (!state) return { approved: 0, denied: 0, total: 0, approvalRate: 0 };
    const approved = state.activity.filter((a) => a.status === "approved").length;
    const denied = state.activity.filter((a) => a.status === "denied").length;
    const total = state.activity.length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { approved, denied, total, approvalRate };
  }, [state]);

  const renderWalletModal = () => {
    if (!showWalletModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
        <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2>Connect Web3 Wallet</h2>
              <p style={{ margin: "4px 0 0" }}>Select a wallet provider to interface with Priv-Tract</p>
            </div>
            <button className="modal-close" style={{ position: "static" }} onClick={() => setShowWalletModal(false)}>
              <X size={16} />
            </button>
          </div>

          {connectingProvider ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div className="funding-step-spinner" style={{ width: "36px", height: "36px", borderWidth: "3px", margin: "0 auto 20px" }} />
              <h3 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "8px" }}>
                {connectionStep === 1 && `Connecting to ${connectingProvider}...`}
                {connectionStep === 2 && "Awaiting Cryptographic Signature..."}
                {connectionStep === 3 && "Account Synchronized!"}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-dim)", maxWidth: "260px", margin: "0 auto" }}>
                {connectionStep === 1 && "Confirm the prompt in your wallet extension popup window."}
                {connectionStep === 2 && "Verify and approve the secure signature check requests."}
                {connectionStep === 3 && "Completing setup state logs. Accessing console..."}
              </p>
            </div>
          ) : (
            <div className="wallet-picker-grid">
              {[
                { name: "Phantom", type: "Solana", icon: "◎" },
                { name: "Solflare", type: "Solana", icon: "🔥" },
                { name: "MetaMask", type: "Ethereum", icon: "🦊" },
                { name: "Coinbase Wallet", type: "Multichain", icon: "🛡" },
              ].map((prov) => (
                <div
                  key={prov.name}
                  className="wallet-provider-card"
                  onClick={() => triggerProviderConnect(prov.name)}
                >
                  <div className="wallet-provider-icon">{prov.icon}</div>
                  <span className="wallet-provider-name">{prov.name}</span>
                  <span className="wallet-provider-type">{prov.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (view === "landing") {
    return (
      <>
        <LandingPage
          prices={prices}
          tickStates={tickStates}
          isAutoUpdate={isAutoUpdate}
          setIsAutoUpdate={setIsAutoUpdate}
          dataSource={dataSource}
          isRefreshing={isRefreshing}
          fetchMarketPrices={fetchMarketPrices}
          onLaunchApp={() => setView("simulator")}
          onShowDocs={() => setView("docs")}
        />
        {renderWalletModal()}
      </>
    );
  }

  if (view === "docs") {
    return (
      <DocsPage 
        onBack={() => setView("landing")} 
        onEnterDashboard={() => setView("simulator")} 
      />
    );
  }

  if (view === "simulator") {
    return (
      <div className="luxury-root">
        {/* Floating Glass Navbar for Standalone Simulator */}
        <nav className="lux-nav">
          <div className="lux-nav-inner liquid-glass">
            <button className="lux-btn-ghost" onClick={() => setView("landing")} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </button>
            
            <div className="lux-nav-brand">
              <Globe size={18} className="glow-icon" />
              <span>Privtract Simulator</span>
            </div>

            <button className="lux-btn-cta liquid-glass" onClick={() => setView("docs")} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Read Docs</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </nav>

        {/* Content Viewport */}
        <div style={{ width: "100vw", height: "100vh", paddingTop: "90px", paddingBottom: "20px", paddingLeft: "40px", paddingRight: "40px", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 10 }}>
          <SdkSimulatorPage />
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
        <RefreshCw size={20} style={{ marginRight: 12, animation: "spin 1s linear infinite" }} />
        Connecting to Priv-Tract...
      </div>
    );
  }

  const agent1 = state.agents?.["1"];
  const unit = networkMode === "solana" ? "SOL" : "ETH";
  const feeUnit = networkMode === "solana" ? "micro-lamports" : "gwei";
  const netLabel = networkMode === "solana" ? "Cluster" : "Chain";

  // Commented out dashboard for now (don't remove it)
  if (false) {
  return (
    <div>
      {/* ── Top Navigation (Full Screen Spanning) ── */}
      <nav className="top-nav">
        <div className="nav-brand" style={{ cursor: "pointer" }} onClick={() => setView("landing")}>
          <div className="nav-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 6V12C3 17 7.5 21.5 12 22C16.5 21.5 21 17 21 12V6L12 2Z" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
              <line x1="12" y1="7" x2="12" y2="17" stroke="#111" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="9" y1="10" x2="15" y2="14" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="15" y1="10" x2="9" y2="14" stroke="#111" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="nav-brand-name">Privtract</span>
        </div>

        <div className="nav-links">
          {["dashboard", "policies", "agents", "settings", "sdk-simulator"].map((p) => (
            <a
              key={p}
              className={`nav-link ${page === p ? "active" : ""}`}
              onClick={() => setPage(p)}
            >
              {PAGE_TITLES[p]}
            </a>
          ))}
        </div>

        <div className="nav-right" ref={dropdownRef}>
          {activeWallet ? (
            <div className="wallet-dropdown-trigger" style={{ position: "relative" }}>
              <div className="wallet-pill" onClick={() => setShowWalletDropdown(!showWalletDropdown)}>
                <div className="wallet-pill-dot" />
                <span className="wallet-pill-network">{activeWallet.network.toUpperCase()}</span>
                <span className="wallet-pill-addr" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {activeWallet.address.slice(0, 5)}…{activeWallet.address.slice(-4)}
                  <ChevronDown size={12} />
                </span>
              </div>

              {/*Frosted Accounts Dropdown */}
              {showWalletDropdown && (
                <div className="wallet-dropdown">
                  <div className="wallet-dropdown-header">
                    <span>Connected Wallets</span>
                    <span>{connectedWallets.length} active</span>
                  </div>
                  <div className="wallet-dropdown-list">
                    {connectedWallets.map((w) => (
                      <div
                        key={w.address}
                        className={`wallet-dropdown-item ${w.active ? "active" : ""}`}
                        onClick={() => switchActiveAccount(w.address)}
                      >
                        <div className="wallet-item-dot" />
                        <div className="wallet-item-info">
                          <span className="wallet-item-addr">
                            {w.address.slice(0, 6)}…{w.address.slice(-4)}
                          </span>
                          <span className="wallet-item-meta">
                            <span>{w.provider} ({w.network.toUpperCase()})</span>
                            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{w.balance} {w.network === "solana" ? "SOL" : "ETH"}</span>
                          </span>
                        </div>
                        <div className="wallet-item-actions">
                          <button
                            className="wallet-item-btn"
                            title="Copy Address"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(w.address, w.address, "addr");
                            }}
                          >
                            {copyState?.id === w.address ? (
                              <CheckCircle2 size={12} color="var(--success)" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          {connectedWallets.length > 1 && (
                            <button
                              className="wallet-item-btn"
                              title="Disconnect Account"
                              onClick={(e) => disconnectWalletAccount(w.address, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="wallet-dropdown-footer">
                    <button
                      className="lux-btn-cta"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", fontSize: "12px", height: "36px" }}
                      onClick={() => {
                        setShowWalletDropdown(false);
                        setShowWalletModal(true);
                      }}
                    >
                      <Plus size={14} />
                      Connect Another Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button className="lux-btn-cta" onClick={() => setShowWalletModal(true)}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* ── Centered Content Viewport ── */}
      <main className="app-container">
        {/* ── Page Header ── */}
        <div className="page-header">
          <div className="page-title">{PAGE_TITLES[page]}</div>
          <div className="page-time">
            <div className="live-dot" />
            {timeStr}
          </div>
        </div>

        {page === "policies" && <PoliciesPage state={state} networkMode={networkMode} adminToken={adminToken} onRefresh={fetchState} />}
        {page === "agents" && <AgentsPage state={state} networkMode={networkMode} adminToken={adminToken} onRefresh={fetchState} activeWallet={activeWallet} onConnectWallet={() => setShowWalletModal(true)} />}
        {page === "settings" && <SettingsPage state={state} networkMode={networkMode} walletAddress={activeWallet?.address} />}
        {page === "sdk-simulator" && <SdkSimulatorPage />}

        {/* ── Dashboard Grid ── */}
        {page === "dashboard" && (
          <div className="dashboard-grid">
            {/* Card 1: Policy Enforcement */}
            <div className="card card-span-2">
              <div className="card-header">
                <div className="card-title">Policy enforcement</div>
                <button className="card-badge" onClick={fetchState}>Refresh ↻</button>
              </div>

              <div className="modules-row">
                {/* Gas Price Module */}
                <div className="module-col">
                  <div className="module-header">
                    <span className="module-label">
                      {networkMode === "solana" ? "Priority Fee" : "Gas Price"}
                      <span className="arrow up">↑</span>
                    </span>
                    <span className="module-dots">•••</span>
                  </div>
                  <div className="bar-chart">
                    {gasBars.map((h, i) => (
                      <div
                        key={i}
                        className={`bar ${i >= 16 ? "active" : ""}`}
                        style={{ height: `${h}%`, animationDelay: `${i * 0.03}s` }}
                      />
                    ))}
                  </div>
                  <div className="module-value">{state.max_gas_price_gwei}</div>
                  <div className="module-unit">max {feeUnit} allowed</div>
                </div>

                {/* Tx Limit Module */}
                <div className="module-col">
                  <div className="module-header">
                    <span className="module-label">Transaction Limits <span className="arrow down">↓</span></span>
                    <span className="module-dots">•••</span>
                  </div>
                  <div className="bar-chart">
                    {txBars.map((h, i) => (
                      <div
                        key={i}
                        className={`bar ${i >= 16 ? "active" : ""}`}
                        style={{ height: `${h}%`, animationDelay: `${i * 0.03}s` }}
                      />
                    ))}
                  </div>
                  <div className="module-value">{fmt(state.wallet_tx_limit, networkMode)}</div>
                  <div className="module-unit">{unit} per transaction</div>
                </div>

                {/* Daily Cap Module */}
                <div className="module-col">
                  <div className="module-header">
                    <span className="module-label">Daily Cap <span className="arrow down">↓</span></span>
                    <span className="module-dots">•••</span>
                  </div>
                  <div className="bar-chart">
                    {bars.map((b, i) => (
                      <div
                        key={i}
                        className={`bar ${b.status === "approved" ? "accent" : b.status === "denied" ? "danger" : ""}`}
                        style={{ height: `${b.h}%`, animationDelay: `${i * 0.03}s` }}
                      />
                    ))}
                  </div>
                  <div className="module-value">
                    {fmt(state.wallet_daily_spend, networkMode)}–{fmt(state.wallet_daily_cap, networkMode)}
                  </div>
                  <div className="module-unit">{unit} spend range today</div>
                </div>
              </div>
            </div>

            {/* Card 2: Kill Switch */}
            <div className="card card-accent">
              <div className="card-header">
                <div className="card-title">Kill switch</div>
                <MoreHorizontal size={18} color="var(--text-dim)" />
              </div>
              <div className="card-subtitle" style={{ marginBottom: "24px" }}>
                Emergency halt • {netLabel} {state.allowed_chain_id}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <div className="status-row">
                  <div className={`status-dot ${state.kill_switch ? "danger" : ""}`} />
                  <span className="status-label" style={{ color: state.kill_switch ? "var(--danger)" : "var(--success)" }}>
                    {state.kill_switch ? "ACTIVE — All Denied" : "Inactive — Normal"}
                  </span>
                </div>
                <div className={`toggle-track ${!state.kill_switch ? "on" : ""}`} onClick={toggleKillSwitch}>
                  <div className="toggle-knob" />
                </div>
              </div>

              <div className="form-field" style={{ marginBottom: "16px" }}>
                <label>Admin token</label>
                <input
                  type="password"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder={
                    state.admin_controls_configured
                      ? "Required to change kill switch"
                      : "Server token not configured"
                  }
                  disabled={!state.admin_controls_configured}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  {networkMode === "solana" ? "Program calls" : "Contract calls"}
                </span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: state.contract_calls_allowed ? "var(--success)" : "var(--danger)" }}>
                  {state.contract_calls_allowed ? "Allowed" : "Denied"}
                </span>
              </div>

              <div className="progress-container">
                <div className="progress-labels">
                  <span className="progress-label-text">Available capacity</span>
                  <span className="progress-value-text">
                    {Math.round(100 - pct(state.wallet_daily_spend, state.wallet_daily_cap))}%
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${100 - pct(state.wallet_daily_spend, state.wallet_daily_cap)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card: Web3 Wallet Holdings */}
            <div className="card card-accent">
              <div className="card-header">
                <div className="card-title">My Wallet Portfolio</div>
                <div className={`lux-feed-badge ${activeWallet ? 'api-mode' : 'sim-mode'}`} style={{ border: 'none', padding: '0', background: 'none' }}>
                  <span className="live-dot" />
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--success)' }}>SOLANA PROTOCOL</span>
                </div>
              </div>
              
              {activeWallet ? (
                <>
                  <div style={{ margin: "12px 0 20px" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Total Net Worth Valuation</div>
                    <div className="big-pct" style={{ marginTop: "4px" }}>
                      ${Object.entries(walletHoldings).reduce((sum, [tok, val]) => {
                        const isUsdc = tok === "SOL_USDC" || tok === "ETH_USDC";
                        const price = isUsdc ? prices.USDC?.price || 1.00 : prices[tok]?.price || 0;
                        return sum + val * price;
                      }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "monospace" }}>
                      {activeWallet.address.slice(0, 8)}…{activeWallet.address.slice(-8)} ({activeWallet.provider})
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" }}>
                    {Object.entries(walletHoldings).map(([tok, amount]) => {
                      const isSolUsdc = tok === "SOL_USDC";
                      const isEthUsdc = tok === "ETH_USDC";
                      
                      const tokenSymbol = isSolUsdc || isEthUsdc ? "USDC" : tok;
                      const tokenName = isSolUsdc ? "Solana SPL-USDC" : isEthUsdc ? "Ethereum ERC-USDC" : INITIAL_TOKENS[tok]?.name || tok;
                      const color = isSolUsdc ? "#14b8a6" : isEthUsdc ? "#a78bfa" : INITIAL_TOKENS[tok]?.color || "var(--accent)";
                      
                      const price = isSolUsdc || isEthUsdc ? prices.USDC?.price || 1.00 : prices[tok]?.price || 0;
                      const usdVal = amount * price;
                      return (
                        <div key={tok} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", borderRadius: "12px", transition: "background 0.2s" }}>
                           <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                             <span style={{ color, fontWeight: "800", fontSize: "12px" }}>{tokenSymbol}</span>
                             <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{tokenName}</span>
                           </div>
                           <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                             <span style={{ fontSize: "12px", fontWeight: "600", color: "#fff", fontFamily: "monospace" }}>
                               {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                             <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                               ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                           </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="lux-btn-cta"
                    style={{ width: "100%", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", marginTop: "8px" }}
                    onClick={() => {
                      setFundWalletForm({ token: "SOL", amount: "" });
                      setShowFundWalletModal(true);
                    }}
                  >
                    <Plus size={14} />
                    Fund Wallet
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔌</div>
                  <h4 style={{ color: "#fff", marginBottom: "8px" }}>Wallet Disconnected</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "200px", margin: "0 auto 20px", lineHeight: "1.5" }}>
                    Connect a secure Web3 wallet in the console to sync asset holdings.
                  </p>
                  <button
                    className="lux-btn-cta"
                    style={{ height: "36px", fontSize: "12px", width: "100%" }}
                    onClick={() => setShowWalletModal(true)}
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>

            {/* Card 3: Agent Tracking */}
            <div className="card card-accent">
              <div className="card-header">
                <div className="card-title">Tracking</div>
                <MoreHorizontal size={18} color="var(--text-dim)" />
              </div>
              <div className="card-subtitle">Agent 1 spend today</div>

              {agent1 && (
                <>
                  <div className="big-pct" style={{ marginTop: "20px" }}>{fmt(agent1.daily_spend, networkMode)}</div>
                  <div className="big-pct-label">{unit} spent of {fmt(agent1.daily_cap, networkMode)} cap</div>
                  <div className="progress-container" style={{ marginTop: "20px" }}>
                    <div className="progress-labels">
                      <span className="progress-label-text">Budget used</span>
                      <span className="progress-value-text">{Math.round(pct(agent1.daily_spend, agent1.daily_cap))}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className={`progress-fill ${pct(agent1.daily_spend, agent1.daily_cap) > 80 ? "danger" : ""}`}
                        style={{ width: `${pct(agent1.daily_spend, agent1.daily_cap)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Card 4: Detailed Report */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Detailed report</div>
                <button className="card-badge">Agent 1</button>
              </div>
              <div className="card-subtitle">Transaction count breakdown</div>

              {agent1 && (
                <>
                  <div className="report-table">
                    {Array.from({ length: agent1.daily_tx_count_limit }, (_, i) => {
                      const isUsed = i < agent1.daily_tx_count;
                      const isCurrent = i === agent1.daily_tx_count - 1;
                      return (
                        <div key={i} className={`report-col ${isCurrent ? "active" : ""}`}>
                          <div className="report-col-day">
                            Tx {i + 1}
                            {isUsed && <span style={{ color: "var(--success)", fontSize: "10px", marginLeft: "2px" }}>✓</span>}
                          </div>
                          <div className="report-col-value" style={{ color: isUsed ? "var(--text-primary)" : "var(--text-dim)" }}>
                            {isUsed ? "●" : "○"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Used</div>
                      <div style={{ fontSize: "24px", fontWeight: "300" }}>{agent1.daily_tx_count}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Limit</div>
                      <div style={{ fontSize: "24px", fontWeight: "300" }}>{agent1.daily_tx_count_limit}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Remaining</div>
                      <div style={{ fontSize: "24px", fontWeight: "300" }}>{agent1.daily_tx_count_limit - agent1.daily_tx_count}</div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Card 5: Approval Rate */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Approval rate</div>
              </div>
              <div className="card-subtitle">Validation outcomes</div>

              <div className="big-pct" style={{ marginTop: "16px" }}>{stats.approvalRate}%</div>
              <div className="big-pct-label">{stats.approved} approved — {stats.denied} denied</div>

              <div className="timeline-row" style={{ marginTop: "24px" }}>
                {state.activity.slice(0, 7).map((item, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <div className="timeline-line" />}
                    <div
                      className={`timeline-dot`}
                      style={{ background: item.status === "approved" ? "var(--accent)" : "var(--danger)" }}
                      title={item.message}
                    />
                  </React.Fragment>
                ))}
                {state.activity.length === 0 && (
                  <span style={{ color: "var(--text-dim)", fontSize: "12px" }}>No data yet</span>
                )}
              </div>
              <div className="timeline-labels" style={{ marginTop: "8px" }}>
                <span className="timeline-label">oldest</span>
                <span className="timeline-label active">latest</span>
              </div>
            </div>

            {/* Card 6: Simulate Transaction */}
            <div className="card card-span-2">
              <div className="card-header">
                <div className="card-title">Simulate transaction</div>
                <Lock size={16} color="var(--accent)" />
              </div>
              <div className="card-subtitle" style={{ marginBottom: "20px" }}>Run a {networkMode.toUpperCase()} transaction ledger through the policy validation engine</div>

              <form className="sim-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-field">
                    <label>Sender Agent ID</label>
                    <input name="from_agent" value={txForm.from_agent} onChange={onChange} placeholder="e.g. 1" required />
                  </div>
                  <div className="form-field">
                    <label>Destination Route</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTxType("recipient");
                          setTxForm(prev => ({ ...prev, to: "" }));
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: `1px solid ${txType === "recipient" ? "var(--accent)" : "var(--border)"}`,
                          background: txType === "recipient" ? "rgba(255,255,255,0.06)" : "transparent",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "600",
                          transition: "all 0.15s"
                        }}
                      >
                        To Recipient
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTxType("agent");
                          setTxForm(prev => ({ ...prev, to: "" }));
                        }}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: `1px solid ${txType === "agent" ? "var(--accent)" : "var(--border)"}`,
                          background: txType === "agent" ? "rgba(255,255,255,0.06)" : "transparent",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "600",
                          transition: "all 0.15s"
                        }}
                      >
                        To Agent
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  {txType === "recipient" ? (
                    <>
                      <label>Recipient Solana Address ({networkMode === "solana" ? "base58" : "hex"})</label>
                      <input 
                        name="to" 
                        value={txForm.to} 
                        onChange={onChange} 
                        placeholder={networkMode === "solana" ? "e.g. SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2" : "e.g. 0x71C765..."} 
                        required 
                      />
                    </>
                  ) : (
                    <>
                      <label>Destination Agent</label>
                      {Object.keys(state.agents || {}).length > 1 ? (
                        <select 
                          name="to" 
                          value={txForm.to} 
                          onChange={onChange} 
                          style={{
                            background: "var(--bg-input)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            padding: "10px 14px",
                            color: "var(--text-primary)",
                            fontFamily: '"Inter", sans-serif',
                            fontSize: "13px",
                            outline: "none",
                            width: "100%",
                            height: "40px"
                          }}
                          required
                        >
                          <option value="">Select Target Agent...</option>
                          {Object.keys(state.agents || {}).filter(id => id !== txForm.from_agent).map(id => (
                            <option key={id} value={state.agents[id].sha256_hash}>Agent {id} ({state.agents[id].sha256_hash.slice(0, 10)}…)</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name="to"
                          value={txForm.to}
                          onChange={onChange}
                          placeholder="Enter destination agent ID or address..."
                          required
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-field">
                    <label>Transaction Value</label>
                    <input name="value" value={txForm.value} onChange={onChange} placeholder="e.g. 5.0" required />
                  </div>
                  <div className="form-field">
                    <label>Currency / Token Asset</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px" }}>
                      {["SOL", "USDC", "ETH", "BTC"].map((tok) => {
                        const active = txCurrency === tok;
                        const color = INITIAL_TOKENS[tok]?.color || "var(--accent)";
                        return (
                          <button
                            key={tok}
                            type="button"
                            onClick={() => setTxCurrency(tok)}
                            style={{
                              padding: "10px 4px",
                              borderRadius: "10px",
                              cursor: "pointer",
                              border: `1px solid ${active ? color : "var(--border)"}`,
                              background: active ? `${color}18` : "rgba(255,255,255,0.03)",
                              color: active ? color : "var(--text-secondary)",
                              fontSize: "12px",
                              fontWeight: "700",
                              transition: "all 0.15s"
                            }}
                          >
                            {tok}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {txCurrency === "USDC" && (
                  <div className="form-field" style={{ animation: "cardFadeIn 0.3s ease" }}>
                    <label>USDC Asset Network Protocol</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => setUsdcChain("solana")}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: `1px solid ${usdcChain === "solana" ? "#14b8a6" : "var(--border)"}`,
                          background: usdcChain === "solana" ? "rgba(20,184,166,0.06)" : "transparent",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "600",
                          transition: "all 0.15s"
                        }}
                      >
                        Solana (SPL-USDC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsdcChain("ethereum")}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          border: `1px solid ${usdcChain === "ethereum" ? "#a78bfa" : "var(--border)"}`,
                          background: usdcChain === "ethereum" ? "rgba(167,139,250,0.06)" : "transparent",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "600",
                          transition: "all 0.15s"
                        }}
                      >
                        Ethereum (ERC-USDC)
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-field">
                    <label>{networkMode === "solana" ? "Priority Fee (micro-lamports)" : "Gas Price (gwei)"}</label>
                    <input name="gas_price_gwei" value={txForm.gas_price_gwei} onChange={onChange} required />
                  </div>
                  <div className="form-field">
                    <label>{netLabel} ID / chain ID</label>
                    <input name="chain_id" value={txForm.chain_id} onChange={onChange} required />
                  </div>
                </div>

                <div className="form-field">
                  <label>{networkMode === "solana" ? "Instruction Data (optional hex)" : "Calldata (optional hex)"}</label>
                  <input
                    name="calldata"
                    value={txForm.calldata}
                    onChange={onChange}
                    placeholder={networkMode === "solana" ? "e.g. 023cf8091a" : "e.g. 0xa9059cbb..."}
                  />
                </div>

                {txStatus && <div className={`result-toast ${txStatus.type}`}>{txStatus.msg}</div>}

                <button type="submit" className="sim-btn" style={{ height: "44px", marginTop: "8px" }}>Evaluate Policy →</button>
              </form>
            </div>

            {/* Card 7: Enforcement Logs */}
            <div className="card card-span-2">
              <div className="card-header">
                <div className="card-title">Enforcement logs</div>
                <button className="card-badge" onClick={fetchState}>Live ↻</button>
              </div>
              <div className="card-subtitle" style={{ marginBottom: "16px" }}>Real-time policy validation pipeline</div>

              {state.activity.slice(0, 6).map((item, i) => (
                <div className="log-item" key={item.id ?? i}>
                  <div className={`log-icon ${item.status}`}>
                    {item.status === "approved" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  </div>
                  <div className="log-body">
                    <div className={`log-status ${item.status}`}>{item.status.toUpperCase()}</div>
                    <div className="log-message">{item.message}</div>
                    <div className="log-meta">
                      agent:
                      <span
                        className="copyable-addr"
                        onClick={() => handleCopyText(item.agent_id, item.id ?? i, "agent")}
                        title="Click to copy agent ID/hash"
                      >
                        {formatIdentifier(item.agent_id)}
                        {copyState?.id === (item.id ?? i) && copyState?.type === "agent" ? (
                          <span className="copy-indicator green">✓</span>
                        ) : (
                          <span className="copy-indicator">📋</span>
                        )}
                      </span>
                      {" → "}
                      <span
                        className="copyable-addr"
                        onClick={() => handleCopyText(item.to, item.id ?? i, "to")}
                        title="Click to copy recipient address/hash"
                      >
                        {formatIdentifier(item.to)}
                        {copyState?.id === (item.id ?? i) && copyState?.type === "to" ? (
                          <span className="copy-indicator green">✓</span>
                        ) : (
                          <span className="copy-indicator">📋</span>
                        )}
                      </span>
                      {" val: "}
                      <span className="log-val-units" title={`${Number(item.value).toLocaleString()} ${networkMode === "solana" ? "lamports" : "wei"}`}>
                        {fmt(item.value, networkMode)} {unit}
                      </span>
                    </div>
                  </div>
                  <div className="log-time">{new Date(item.timestamp * 1000).toLocaleTimeString()}</div>
                </div>
              ))}
              {state.activity.length === 0 && (
                <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-dim)", fontSize: "13px" }}>
                  No validation requests yet. Use the Simulate card to test.
                </div>
              )}
            </div>

            {/* Card 8: Config summary */}
            <div className="card card-accent">
              <div className="card-header">
                <div className="card-title">Engine config</div>
              </div>
              <div className="card-subtitle" style={{ marginBottom: "20px" }}>Loaded from config.toml</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  [`${netLabel} ID`, state.allowed_chain_id],
                  ["Wallet Tx Limit", `${fmt(state.wallet_tx_limit, networkMode)} ${unit}`],
                  ["Wallet Daily Cap", `${fmt(state.wallet_daily_cap, networkMode)} ${unit}`],
                  [`Max ${networkMode === "solana" ? "Priority Fee" : "Gas Price"}`, `${state.max_gas_price_gwei} ${feeUnit}`],
                  [
                    networkMode === "solana" ? "Program Instructions" : "Contract Calls",
                    state.contract_calls_allowed ? "Allowed" : "Denied",
                  ],
                  ["Kill Switch", state.kill_switch ? "ACTIVE" : "Inactive"],
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{k}</span>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── WEB3 WALLET CONNECTION MODAL ─── */}
      {renderWalletModal()}
      {renderFundWalletModal()}
    </div>
  );
  }
  return null;
}

export default App;
