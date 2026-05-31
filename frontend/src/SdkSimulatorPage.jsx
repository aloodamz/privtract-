import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCw,
  Terminal,
  Code,
  FileText,
  Sliders,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Key,
  Database,
  ArrowRight,
  HelpCircle,
  Hash,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Info,
  Server
} from "lucide-react";
import { fmt, formatIdentifier } from "./utils/helpers";

// Default initial config
const INITIAL_CONFIG = {
  wallet: {
    kill_switch: false,
    allowed_chain_id: 102, // Solana Devnet
    wallet_tx_limit: 10000000000, // 10 SOL
    wallet_daily_cap: 50000000000, // 50 SOL
    max_gas_price_gwei: 10000, // 10,000 micro-lamports per CU
    contract_calls_allowed: true,
    recipient_whitelist: [
      "SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2",
      "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      "4Nd1m11111111111111111111111111111111111111"
    ],
    function_selector_whitelist: [
      "0x023cf809", // Raydium swap instruction discriminator prefix
      "0xa9059cbb", // SPL transfer discriminator
      "0xf223c689"  // Orca swap prefix
    ]
  },
  agents: {
    "1": {
      tx_limit: 5000000000, // 5 SOL
      daily_cap: 15000000000, // 15 SOL
      daily_tx_count_limit: 5
    },
    "2": {
      tx_limit: 2000000000, // 2 SOL
      daily_cap: 5000000000, // 5 SOL
      daily_tx_count_limit: 3
    }
  }
};

// Cryptographic hash helpers using browser-native Web Cryptography API
async function sha256Hash(text) {
  const msgBuffer = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function blake3Hash(text) {
  // Client-side deterministic BLAKE3 mock (salted SHA-256)
  return await sha256Hash("blake3-salt-key-928374982734982:" + text);
}

// Simple Base58 character set validation
function isValidBase58(str) {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str.trim());
}

export default function SdkSimulatorPage() {
  // Simulator states
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [activeTab, setActiveTab] = useState("builder"); // "builder" | "config"
  const [shieldMode, setShieldMode] = useState("sha256"); // "none" | "sha256" | "blake3"
  
  // Transaction fields
  const [txAgentId, setTxAgentId] = useState("1");
  const [txRecipient, setTxRecipient] = useState("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2");
  const [txValueSol, setTxValueSol] = useState("1.5");
  const [txPriorityFee, setTxPriorityFee] = useState("5000");
  const [txClusterId, setTxClusterId] = useState("102");
  const [txSelector, setTxSelector] = useState("0x023cf809");
  const [hasInstruction, setHasInstruction] = useState(true);

  // Spend Counters
  const [walletDailySpend, setWalletDailySpend] = useState(0);
  const [agentSpends, setAgentSpends] = useState({
    "1": { spend: 0, count: 0 },
    "2": { spend: 0, count: 0 }
  });

  // Hashed representation caches
  const [hashedAgent, setHashedAgent] = useState("");
  const [hashedRecipient, setHashedRecipient] = useState("");

  // Native asynchronous hash caches for whitelists & agents
  const [whitelistHashes, setWhitelistHashes] = useState({});
  const [agentHashes, setAgentHashes] = useState({});

  // Precompute hashes for whitelist addresses using native crypto
  useEffect(() => {
    async function deriveHashes() {
      const newHashes = { ...whitelistHashes };
      let updated = false;
      for (const addr of config.wallet.recipient_whitelist) {
        if (!newHashes[addr]) {
          const sha = await sha256Hash(addr);
          const blake = await blake3Hash(addr);
          newHashes[addr] = { sha256: sha, blake3: blake };
          updated = true;
        }
      }
      if (updated) {
        setWhitelistHashes(newHashes);
      }
    }
    deriveHashes();
  }, [config.wallet.recipient_whitelist]);

  // Precompute hashes for Agent IDs using native crypto
  useEffect(() => {
    async function deriveAgentHashes() {
      const newHashes = { ...agentHashes };
      let updated = false;
      for (const id of [...Object.keys(config.agents), "99"]) {
        if (!newHashes[id]) {
          const sha = await sha256Hash(id);
          const blake = await blake3Hash(id);
          newHashes[id] = { sha256: sha, blake3: blake };
          updated = true;
        }
      }
      if (updated) {
        setAgentHashes(newHashes);
      }
    }
    deriveAgentHashes();
  }, [config.agents]);

  // Pipeline Step-by-Step walk state
  const [pipelineState, setPipelineState] = useState("idle"); // "idle" | "simulating" | "paused" | "completed"
  const [currentGateIdx, setCurrentGateIdx] = useState(null);
  const [gateResults, setGateResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [simSpeed, setSimSpeed] = useState(1000); // ms delay

  // Terminal scroll reference
  const terminalEndRef = useRef(null);

  // Compute hashes when parameters change
  useEffect(() => {
    async function updateHashes() {
      if (shieldMode === "sha256") {
        const aHash = await sha256Hash(txAgentId);
        const rHash = await sha256Hash(txRecipient);
        setHashedAgent(`sha256:${aHash}`);
        setHashedRecipient(`sha256:${rHash}`);
      } else if (shieldMode === "blake3") {
        const aHash = await blake3Hash(txAgentId);
        const rHash = await blake3Hash(txRecipient);
        setHashedAgent(`blake3:${aHash}`);
        setHashedRecipient(`blake3:${rHash}`);
      } else {
        setHashedAgent(txAgentId);
        setHashedRecipient(txRecipient);
      }
    }
    updateHashes();
  }, [txAgentId, txRecipient, shieldMode]);

  // Terminal log helper
  const addLog = (text, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, text, type }]);
  };

  // Scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Initialize gate array details
  const GATES = [
    {
      id: 1,
      name: "Kill Switch Check",
      desc: "Emergency shutdown block checking if all transactions are globally halted.",
      check: (tx, cfg, state) => {
        if (cfg.wallet.kill_switch) {
          return { pass: false, err: "KillSwitchActive", desc: "Global emergency kill-switch is active." };
        }
        return { pass: true, desc: "Kill switch is inactive. Access allowed." };
      }
    },
    {
      id: 2,
      name: "Solana Cluster ID Check",
      desc: "Validates that the transaction targets the correct Solana network.",
      check: (tx, cfg, state) => {
        if (tx.cluster_id !== cfg.wallet.allowed_chain_id) {
          return { pass: false, err: "ClusterIdMismatch", desc: `Cluster ID mismatch. Target: ${tx.cluster_id}, Allowed: ${cfg.wallet.allowed_chain_id}` };
        }
        return { pass: true, desc: `Cluster ID matches (${tx.cluster_id}).` };
      }
    },
    {
      id: 3,
      name: "Priority Fee Ceiling Check",
      desc: "Enforces max priority fee limits to protect the wallet from network spikes.",
      check: (tx, cfg, state) => {
        if (tx.priority_fee > cfg.wallet.max_gas_price_gwei) {
          return { pass: false, err: "PriorityFeeTooHigh", desc: `Priority fee too high. Limit: ${cfg.wallet.max_gas_price_gwei} micro-lamports, Tx: ${tx.priority_fee}` };
        }
        return { pass: true, desc: `Priority fee is within safety limits.` };
      }
    },
    {
      id: 4,
      name: "Recipient Whitelist Gate",
      desc: "Matches recipient address in constant time via cryptographic privacy masks.",
      check: (tx, cfg, state) => {
        const isWhitelisted = cfg.wallet.recipient_whitelist.some(addr => {
          const hashes = whitelistHashes[addr];
          if (!hashes) return false;
          if (tx.to_mode === "sha256") {
            return `sha256:${hashes.sha256}` === tx.to;
          } else if (tx.to_mode === "blake3") {
            return `blake3:${hashes.blake3}` === tx.to;
          } else {
            return addr === tx.to;
          }
        });

        if (!isWhitelisted) {
          return { pass: false, err: "RecipientNotWhitelisted", desc: `Destination address is not found in the whitelisted registers.` };
        }
        return { pass: true, desc: `Recipient verified on allowlist (Privacy matches: ${tx.to_mode.toUpperCase()}).` };
      }
    },
    {
      id: 5,
      name: "Anchor Instruction Gate",
      desc: "Restricts execution to approved program instruction discriminators.",
      check: (tx, cfg, state) => {
        if (tx.has_instruction) {
          if (!cfg.wallet.contract_calls_allowed) {
            return { pass: false, err: "InstructionCallsNotAllowed", desc: "Program instruction calls are globally disabled." };
          }
          const isAllowedSelector = cfg.wallet.function_selector_whitelist.some(sel => {
            return tx.selector.startsWith(sel);
          });
          if (!isAllowedSelector) {
            return { pass: false, err: "InstructionSelectorNotWhitelisted", desc: `Instruction discriminator ${tx.selector} is not approved.` };
          }
          return { pass: true, desc: `Instruction discriminator approved (${tx.selector}).` };
        }
        return { pass: true, desc: "No instruction data present. Passed.", skipped: true };
      }
    },
    {
      id: 6,
      name: "Agent Authentication Gate",
      desc: "Checks if the agent identifier is registered in the configuration ledger.",
      check: (tx, cfg, state) => {
        let matchedAgentId = null;
        for (const [id, agent] of Object.entries(cfg.agents)) {
          const hashes = agentHashes[id];
          if (!hashes) continue;
          if (tx.from_agent_mode === "sha256") {
            if (`sha256:${hashes.sha256}` === tx.from_agent) {
              matchedAgentId = id;
              break;
            }
          } else if (tx.from_agent_mode === "blake3") {
            if (`blake3:${hashes.blake3}` === tx.from_agent) {
              matchedAgentId = id;
              break;
            }
          } else {
            if (id === tx.from_agent) {
              matchedAgentId = id;
              break;
            }
          }
        }

        if (!matchedAgentId) {
          return { pass: false, err: "AgentNotAuthenticated", desc: "Agent identity not authenticated. ID/Hash not found." };
        }
        return { pass: true, desc: `Agent authenticated successfully as Agent #${matchedAgentId}.`, resolvedId: matchedAgentId };
      }
    },
    {
      id: 7,
      name: "Per-Tx Value Ceiling Check",
      desc: "Enforces value limits on single transactions (min of Agent and Wallet thresholds).",
      check: (tx, cfg, state, resolvedAgentId) => {
        const agent = cfg.agents[resolvedAgentId];
        const txLimit = Math.min(agent.tx_limit, cfg.wallet.wallet_tx_limit);
        if (tx.value_lamports > txLimit) {
          return { pass: false, err: "TransactionLimitExceeded", desc: `Value exceeds limits. Max allowed: ${txLimit} lamports, Tx: ${tx.value_lamports}` };
        }
        return { pass: true, desc: `Value is within bounds (Tx Max: ${txLimit} lamports).` };
      }
    },
    {
      id: 8,
      name: "Agent Daily Cap check",
      desc: "Verifies the agent has sufficient budget remaining in their daily allotment.",
      check: (tx, cfg, state, resolvedAgentId) => {
        const agentCfg = cfg.agents[resolvedAgentId];
        const agentState = state.agents[resolvedAgentId] || { spend: 0 };
        if (agentState.spend + tx.value_lamports > agentCfg.daily_cap) {
          return { pass: false, err: "AgentDailyCapExceeded", desc: `Agent daily budget cap exceeded. Limit: ${agentCfg.daily_cap} lamports, Projected: ${agentState.spend + tx.value_lamports}` };
        }
        return { pass: true, desc: `Agent daily cap has sufficient capacity. (Remaining: ${agentCfg.daily_cap - agentState.spend} lamports).` };
      }
    },
    {
      id: 9,
      name: "Agent Daily Frequency Gate",
      desc: "Prevents high-frequency spamming by limiting daily transaction counts.",
      check: (tx, cfg, state, resolvedAgentId) => {
        const agentCfg = cfg.agents[resolvedAgentId];
        const agentState = state.agents[resolvedAgentId] || { count: 0 };
        if (agentState.count + 1 > agentCfg.daily_tx_count_limit) {
          return { pass: false, err: "TransactionCountLimitExceeded", desc: `Daily frequency limit reached. Cap: ${agentCfg.daily_tx_count_limit} txs, Current: ${agentState.count}` };
        }
        return { pass: true, desc: `Agent daily transaction count verified (Remaining: ${agentCfg.daily_tx_count_limit - agentState.count} txs).` };
      }
    },
    {
      id: 10,
      name: "Global Wallet Daily Cap Check",
      desc: "Aggregated global threshold check across all active agent spenders.",
      check: (tx, cfg, state) => {
        if (state.wallet_spend + tx.value_lamports > cfg.wallet.wallet_daily_cap) {
          return { pass: false, err: "WalletDailyCapExceeded", desc: `Global wallet-wide daily cap exceeded. Limit: ${cfg.wallet.wallet_daily_cap} lamports, Current: ${state.wallet_spend}` };
        }
        return { pass: true, desc: `Global wallet cap has sufficient capacity (Remaining: ${cfg.wallet.wallet_daily_cap - state.wallet_spend} lamports).` };
      }
    },
    {
      id: 11,
      name: "Atomic Commit Phase",
      desc: "Final state modification updating all registers concurrently.",
      check: (tx, cfg, state, resolvedAgentId) => {
        return { pass: true, desc: "Atomic commit succeeded. State counters updated.", commit: true };
      }
    }
  ];



  // Pre-calculate derived PDA addresses
  const pdaWalletConfig = useMemo(() => {
    // authority_pubkey seed
    const authority = "4Nd1m11111111111111111111111111111111111111";
    // Derived PDA mock
    const pda = "6rPz7q..." + authority.slice(0, 8);
    return {
      seeds: [`b"wallet-config"`, `${authority.slice(0, 10)}…`],
      address: "Bpxs78KqM1n9yXwz5uPqA7sL9dJv8wS4tB3rMc2d1N4X"
    };
  }, []);

  const pdaAgentState = useMemo(() => {
    const id = Number(txAgentId) || 1;
    // Derive LE bytes
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(0, id, true); // Little endian
    const bytes = Array.from(new Uint8Array(buffer)).map(b => "0x" + b.toString(16).padStart(2, "0")).join(", ");
    
    return {
      seeds: [`b"agent-state"`, `[${bytes}] (agent_id.to_le_bytes())`],
      address: id === 1 
        ? "Cpxs97SqF1v9yXwz5uPqA7sL9dJv8wS4tB3rMc2d1A1Z"
        : "Cpxs97SqF1v9yXwz5uPqA7sL9dJv8wS4tB3rMc2d1A2Y"
    };
  }, [txAgentId]);

  // Dynamic code-parity Rust snippets
  const rustSnippet = useMemo(() => {
    const valLamports = Math.floor(parseFloat(txValueSol || "0") * 1000000000);
    const agentArg = shieldMode === "sha256" 
      ? `sdk.hash_agent_sha256(${txAgentId})` 
      : shieldMode === "blake3"
      ? `sdk.hash_agent_blake3(${txAgentId})`
      : `AgentId::Raw(${txAgentId})`;

    const recipientArg = shieldMode === "sha256"
      ? `sdk.hash_address_sha256("${txRecipient}")`
      : shieldMode === "blake3"
      ? `sdk.hash_address_blake3("${txRecipient}")`
      : `Recipient::Raw("${txRecipient}".to_string())`;

    const instructionSetup = hasInstruction 
      ? `Some(hex::decode("${txSelector.replace("0x", "")}").unwrap())`
      : `None`;

    return `// Dynamic Rust Code Parity with running simulation
use priv_tract::priv_tract_sdk::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Load embedded engine policies from config
    let sdk = PrivTractSDK::from_config("config.toml")?;

    // 2. Build SdkTransaction using active privacy shield
    let tx = SdkTransaction {
        from_agent: ${agentArg},
        to: ${recipientArg},
        value_lamports: ${valLamports},
        priority_fee: ${txPriorityFee},
        cluster_id: ${txClusterId},
        instruction_data: ${instructionSetup},
    };

    // 3. Evaluate policies locally in microsecond latency
    match sdk.evaluate(&tx) {
        Ok(receipt) => {
            println!("✅ APPROVED: {}" , receipt.message);
            println!("Wallet spend total: {} lamports", receipt.wallet_daily_spend);
        }
        Err(denial) => {
            println!("❌ DENIED: {}", denial);
        }
    }
    Ok(())
}`;
  }, [txAgentId, txRecipient, txValueSol, txPriorityFee, txClusterId, txSelector, hasInstruction, shieldMode]);

  // Core Simulation Function
  const runVerification = async (stepMode = false) => {
    if (pipelineState === "simulating" && !stepMode) return;

    setPipelineState("simulating");
    addLog(`🎬 Initializing transaction verification. Shield Mode: ${shieldMode.toUpperCase()}`, "info");

    const valLamports = Math.floor(parseFloat(txValueSol || "0") * 1000000000);
    const transaction = {
      from_agent: hashedAgent,
      from_agent_mode: shieldMode,
      to: hashedRecipient,
      to_mode: shieldMode,
      value_lamports: valLamports,
      priority_fee: parseInt(txPriorityFee || "0"),
      cluster_id: parseInt(txClusterId || "0"),
      has_instruction: hasInstruction,
      selector: txSelector
    };

    // Reset pipeline displays
    const initialResults = GATES.map(g => ({ ...g, status: "pending", output: "" }));
    setGateResults(initialResults);
    
    // Evaluate sequentially
    let resolvedId = null;
    let failed = false;

    // Run verification loop
    if (stepMode) {
      // Set to manual walkthrough
      setCurrentGateIdx(0);
      setPipelineState("paused");
      updateGateState(0, "active", "Evaluating criteria...", initialResults);
      addLog(`👉 Walkthrough paused at Gate #1: ${GATES[0].name}. Click 'Next Gate' to evaluate.`, "warning");
    } else {
      // Animated automatic run
      let currentResults = [...initialResults];
      for (let i = 0; i < GATES.length; i++) {
        setCurrentGateIdx(i);
        updateGateState(i, "active", "Evaluating conditions...", currentResults);
        
        // Wait for visual delay
        await new Promise(resolve => setTimeout(resolve, simSpeed));

        const gate = GATES[i];
        const res = gate.check(transaction, config, {
          wallet_spend: walletDailySpend,
          agents: agentSpends
        }, resolvedId);

        if (res.pass) {
          if (res.resolvedId) resolvedId = res.resolvedId;
          const status = gate.skipped ? "skipped" : "success";
          updateGateState(i, status, res.desc, currentResults);
          addLog(`[PASS] Gate #${i + 1} (${gate.name}): ${res.desc}`, "success");
          
          if (res.commit) {
            // Commit state changes
            commitCounters(transaction.value_lamports, resolvedId);
          }
        } else {
          updateGateState(i, "failed", res.desc, currentResults);
          // Set rest to skipped
          for (let j = i + 1; j < GATES.length; j++) {
            currentResults[j].status = "skipped";
            currentResults[j].output = "Aborted due to preceding failure.";
          }
          setGateResults([...currentResults]);
          addLog(`[DENIED] Gate #${i + 1} (${gate.name}): ${res.desc}`, "danger");
          addLog(`🛑 ATOMIC ABORT: Transaction validation halted. No state modifications committed.`, "danger");
          failed = true;
          break;
        }
      }
      setPipelineState("completed");
      setCurrentGateIdx(null);
      if (!failed) {
        addLog(`🎉 Transaction safely validation cleared. Receipt emitted!`, "success");
      }
    }
  };

  const advanceStep = async () => {
    if (currentGateIdx === null) return;

    const valLamports = Math.floor(parseFloat(txValueSol || "0") * 1000000000);
    const transaction = {
      from_agent: hashedAgent,
      from_agent_mode: shieldMode,
      to: hashedRecipient,
      to_mode: shieldMode,
      value_lamports: valLamports,
      priority_fee: parseInt(txPriorityFee || "0"),
      cluster_id: parseInt(txClusterId || "0"),
      has_instruction: hasInstruction,
      selector: txSelector
    };

    // Find resolved agent ID from previous gates
    let resolvedId = null;
    for (let k = 0; k < currentGateIdx; k++) {
      if (GATES[k].name === "Agent Authentication Gate") {
        const authRes = GATES[k].check(transaction, config, {
          wallet_spend: walletDailySpend,
          agents: agentSpends
        });
        if (authRes.pass) resolvedId = authRes.resolvedId;
      }
    }

    const idx = currentGateIdx;
    const gate = GATES[idx];
    const res = gate.check(transaction, config, {
      wallet_spend: walletDailySpend,
      agents: agentSpends
    }, resolvedId);

    let currentResults = [...gateResults];

    if (res.pass) {
      if (res.resolvedId) resolvedId = res.resolvedId;
      const status = gate.skipped ? "skipped" : "success";
      updateGateState(idx, status, res.desc, currentResults);
      addLog(`[PASS] Gate #${idx + 1} (${gate.name}): ${res.desc}`, "success");
      
      if (res.commit) {
        commitCounters(transaction.value_lamports, resolvedId);
        setPipelineState("completed");
        setCurrentGateIdx(null);
        addLog(`🎉 Transaction safely validation cleared. Receipt committed atomically!`, "success");
      } else {
        // Advance to next gate
        const nextIdx = idx + 1;
        setCurrentGateIdx(nextIdx);
        updateGateState(nextIdx, "active", "Evaluating conditions...", currentResults);
        addLog(`👉 Walkthrough paused at Gate #${nextIdx + 1}: ${GATES[nextIdx].name}. Click 'Next Gate' to advance.`, "warning");
      }
    } else {
      updateGateState(idx, "failed", res.desc, currentResults);
      // Set rest to skipped
      for (let j = idx + 1; j < GATES.length; j++) {
        currentResults[j].status = "skipped";
        currentResults[j].output = "Aborted due to preceding failure.";
      }
      setGateResults([...currentResults]);
      setPipelineState("completed");
      setCurrentGateIdx(null);
      addLog(`[DENIED] Gate #${idx + 1} (${gate.name}): ${res.desc}`, "danger");
      addLog(`🛑 ATOMIC ABORT: Transaction validation halted. No state modifications committed.`, "danger");
    }
  };

  const updateGateState = (idx, status, output, resultsArray) => {
    resultsArray[idx] = {
      ...resultsArray[idx],
      status,
      output
    };
    setGateResults([...resultsArray]);
  };

  const commitCounters = (val, agentId) => {
    setWalletDailySpend(prev => prev + val);
    if (agentId) {
      setAgentSpends(prev => ({
        ...prev,
        [agentId]: {
          spend: prev[agentId].spend + val,
          count: prev[agentId].count + 1
        }
      }));
    }
  };

  const handleResetCounters = () => {
    setWalletDailySpend(0);
    setAgentSpends({
      "1": { spend: 0, count: 0 },
      "2": { spend: 0, count: 0 }
    });
    addLog("🕒 Daily reset executed. All counters rolled back to 0 (Simulated Midnight UTC rollover).", "info");
  };

  // Whitelist management handlers
  const handleAddWhitelist = (address) => {
    if (!address || !isValidBase58(address)) {
      addLog("❌ Failed to add whitelist: Address must be a valid Base58 Solana public key.", "danger");
      return;
    }
    if (config.wallet.recipient_whitelist.includes(address)) {
      addLog("ℹ️ Address is already in the recipient whitelist.", "info");
      return;
    }
    setConfig(prev => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        recipient_whitelist: [...prev.wallet.recipient_whitelist, address]
      }
    }));
    addLog(`➕ Recipient Whitelist addition: ${address}`, "success");
  };

  const handleRemoveWhitelist = (address) => {
    setConfig(prev => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        recipient_whitelist: prev.wallet.recipient_whitelist.filter(a => a !== address)
      }
    }));
    addLog(`➖ Recipient Whitelist removal: ${address}`, "info");
  };

  return (
    <div className="simulator-grid">
      {/* ── Spotlight backgrounds for simulator luxury style ── */}
      <div 
        style={{
          position: "fixed",
          top: "10%",
          left: "20%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0
        }} 
      />
      <div 
        style={{
          position: "fixed",
          bottom: "10%",
          right: "10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.015) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
          zIndex: 0
        }} 
      />

      {/* ──────────────────────────────────────────────────────────
          COLUMN 1: CONTROLS (BUILDER / CONFIG)
         ────────────────────────────────────────────────────────── */}
      <div className="simulator-col">
        
        {/* TAB NAVIGATION CARD */}
        <div className="card card-accent" style={{ padding: "14px 20px", minHeight: "auto", display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => setActiveTab("builder")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "12px",
              border: `1px solid ${activeTab === "builder" ? "var(--border-accent)" : "transparent"}`,
              background: activeTab === "builder" ? "rgba(255,255,255,0.05)" : "transparent",
              color: activeTab === "builder" ? "#fff" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Sliders size={14} />
            Tx Builder
          </button>
          <button
            onClick={() => setActiveTab("config")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "12px",
              border: `1px solid ${activeTab === "config" ? "var(--border-accent)" : "transparent"}`,
              background: activeTab === "config" ? "rgba(255,255,255,0.05)" : "transparent",
              color: activeTab === "config" ? "#fff" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <Database size={14} />
            Config.toml
          </button>
        </div>

        {/* TAB CONTENT: TRANSACTION BUILDER */}
        {activeTab === "builder" && (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div className="card-header" style={{ marginBottom: "16px", flexShrink: 0 }}>
              <div>
                <div className="card-title">Transaction Builder</div>
                <div className="card-subtitle">Set inputs for simulated outgoing client payloads</div>
              </div>
              <Sparkles size={16} color="var(--text-secondary)" />
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px" }}>
              
              {/* Agent ID Selector */}
              <div className="form-field">
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Sender Agent ID</span>
                  <span style={{ color: "var(--text-dim)", fontFamily: "monospace" }}>id_registry</span>
                </label>
                <select
                  value={txAgentId}
                  onChange={(e) => setTxAgentId(e.target.value)}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    outline: "none"
                  }}
                >
                  {Object.keys(config.agents).map(id => (
                    <option key={id} value={id}>Agent #{id} (Limit: {config.agents[id].tx_limit / 1000000000} SOL)</option>
                  ))}
                  <option value="99">Agent #99 (Unauthenticated Agent)</option>
                </select>
              </div>

              {/* Destination Address */}
              <div className="form-field">
                <label>Recipient Address (Solana Base58)</label>
                <input
                  type="text"
                  value={txRecipient}
                  onChange={(e) => setTxRecipient(e.target.value)}
                  placeholder="Enter Base58 public key..."
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                  <span 
                    onClick={() => setTxRecipient("SRMu8tBssHvwJZ1J4GoAWb8R749547rK1N6rRc13qD2")}
                    style={{ fontSize: "10px", color: "var(--text-secondary)", cursor: "pointer", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  >
                    Serum (Whitelisted)
                  </span>
                  <span 
                    onClick={() => setTxRecipient("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")}
                    style={{ fontSize: "10px", color: "var(--text-secondary)", cursor: "pointer", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  >
                    Raydium (Whitelisted)
                  </span>
                  <span 
                    onClick={() => setTxRecipient("JUPyiwrP554aGv5pkK8t4fFz1Q1k34dD87265pC3aZ9")}
                    style={{ fontSize: "10px", color: "var(--text-secondary)", cursor: "pointer", background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: "6px", border: "1px solid var(--border)" }}
                  >
                    Jupiter (Blocked Recipient)
                  </span>
                </div>
              </div>

              {/* Hashed/Shield Mode Selector */}
              <div className="form-field" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", padding: "12px", borderRadius: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Lock size={12} color="var(--success)" />
                    Privacy Shield (Dual Hashing)
                  </span>
                  <HelpCircle size={12} color="var(--text-dim)" title="Masks transaction identifiers locally before evaluating or sending to RPC logs" />
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                  {["none", "sha256", "blake3"].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setShieldMode(mode)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        border: `1px solid ${shieldMode === mode ? "var(--border-accent)" : "transparent"}`,
                        background: shieldMode === mode ? "rgba(255,255,255,0.06)" : "transparent",
                        color: shieldMode === mode ? "#fff" : "var(--text-secondary)",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "uppercase"
                      }}
                    >
                      {mode === "none" ? "Plaintext" : mode}
                    </button>
                  ))}
                </div>

                {shieldMode !== "none" && (
                  <div style={{ marginTop: "10px", fontSize: "11px", fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <div style={{ color: "var(--text-dim)" }}>Shielded Agent ID:</div>
                    <div style={{ color: "var(--success)", overflowWrap: "anywhere" }}>{hashedAgent}</div>
                    <div style={{ color: "var(--text-dim)", marginTop: "4px" }}>Shielded Recipient:</div>
                    <div style={{ color: "var(--success)", overflowWrap: "anywhere" }}>{hashedRecipient}</div>
                  </div>
                )}
              </div>

              {/* Value Input */}
              <div className="form-field">
                <label style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Transfer Value (SOL)</span>
                  <span style={{ color: "var(--text-dim)" }}>
                    {(parseFloat(txValueSol || "0") * 1000000000).toLocaleString()} lamports
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={txValueSol}
                  onChange={(e) => setTxValueSol(e.target.value)}
                />
              </div>

              {/* Priority Fee & Cluster ID */}
              <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-field">
                  <label>Priority Fee (micro-lamp)</label>
                  <input
                    type="number"
                    value={txPriorityFee}
                    onChange={(e) => setTxPriorityFee(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Cluster ID</label>
                  <input
                    type="number"
                    value={txClusterId}
                    onChange={(e) => setTxClusterId(e.target.value)}
                  />
                </div>
              </div>

              {/* Program Call Instruction */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "500" }}>Attach Instruction Data</label>
                  <div className={`toggle-track ${hasInstruction ? "on" : ""}`} onClick={() => setHasInstruction(!hasInstruction)} style={{ transform: "scale(0.8)" }}>
                    <div className="toggle-knob" />
                  </div>
                </div>

                {hasInstruction && (
                  <div className="form-field" style={{ animation: "cardFadeIn 0.3s ease" }}>
                    <label>Function Discriminator Selector (hex)</label>
                    <input
                      type="text"
                      value={txSelector}
                      onChange={(e) => setTxSelector(e.target.value)}
                      placeholder="e.g. 0x023cf809"
                      style={{ fontFamily: "monospace" }}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB CONTENT: CONFIG EDITOR */}
        {activeTab === "config" && (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, padding: "24px" }}>
            <div className="card-header" style={{ marginBottom: "16px", flexShrink: 0 }}>
              <div>
                <div className="card-title">Configuration Editor</div>
                <div className="card-subtitle">Local replica of config.toml gates settings</div>
              </div>
              <Database size={16} color="var(--text-secondary)" />
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px" }}>
              
              {/* Emergency Kill Switch */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.015)", padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>Kill Switch</span>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Emergency lock on all spenders</span>
                </div>
                <div 
                  className={`toggle-track ${config.wallet.kill_switch ? "on" : ""}`} 
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    wallet: { ...prev.wallet, kill_switch: !prev.wallet.kill_switch }
                  }))}
                >
                  <div className="toggle-knob" />
                </div>
              </div>

              {/* Cluster Config */}
              <div className="form-field">
                <label>Allowed Solana Cluster ID</label>
                <input
                  type="number"
                  value={config.wallet.allowed_chain_id}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    wallet: { ...prev.wallet, allowed_chain_id: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>

              {/* Wallet limits */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="form-field">
                  <label>Max Single Tx (lamports)</label>
                  <input
                    type="number"
                    value={config.wallet.wallet_tx_limit}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      wallet: { ...prev.wallet, wallet_tx_limit: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
                <div className="form-field">
                  <label>Wallet Daily Cap (lamports)</label>
                  <input
                    type="number"
                    value={config.wallet.wallet_daily_cap}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      wallet: { ...prev.wallet, wallet_daily_cap: parseInt(e.target.value) || 0 }
                    }))}
                  />
                </div>
              </div>

              {/* Gas Limit and Calls */}
              <div className="form-field">
                <label>Max Priority Fee Ceiling (micro-lamports)</label>
                <input
                  type="number"
                  value={config.wallet.max_gas_price_gwei}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    wallet: { ...prev.wallet, max_gas_price_gwei: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.015)", padding: "10px 14px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "600", display: "block" }}>Allow Program Calls</span>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Enables checking selector allowlist</span>
                </div>
                <div 
                  className={`toggle-track ${config.wallet.contract_calls_allowed ? "on" : ""}`} 
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    wallet: { ...prev.wallet, contract_calls_allowed: !prev.wallet.contract_calls_allowed }
                  }))}
                >
                  <div className="toggle-knob" />
                </div>
              </div>

              {/* Recipient Whitelist Manager */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                  Recipient Allowlist (Base58 Address)
                </span>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                  {config.wallet.recipient_whitelist.map(addr => (
                    <div key={addr} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)", padding: "6px 10px", borderRadius: "8px" }}>
                      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-secondary)" }}>
                        {formatIdentifier(addr)}
                      </span>
                      <button 
                        onClick={() => handleRemoveWhitelist(addr)}
                        style={{ border: "none", background: "none", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    id="new-whitelist-addr"
                    type="text"
                    placeholder="Add Solana Pubkey..."
                    style={{ flex: 1, padding: "6px 10px", fontSize: "11px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-input)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddWhitelist(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById("new-whitelist-addr");
                      if (input) {
                        handleAddWhitelist(input.value);
                        input.value = "";
                      }
                    }}
                    style={{ padding: "6px 12px", borderRadius: "8px", background: "var(--text-primary)", color: "#000", border: "none", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Add
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ──────────────────────────────────────────────────────────
          COLUMN 2: 11-GATE PIPELINE VISUALIZER
         ────────────────────────────────────────────────────────── */}
      <div className="simulator-col">
        
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <div className="card-header" style={{ marginBottom: "16px", flexShrink: 0 }}>
            <div>
              <div className="card-title">11-Gate SDK Pipeline</div>
              <div className="card-subtitle">Sequence of off-chain policy gates enforced on each transaction</div>
            </div>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <select
                value={simSpeed}
                onChange={(e) => setSimSpeed(parseInt(e.target.value))}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  color: "var(--text-secondary)",
                  fontSize: "11px"
                }}
              >
                <option value="400">Fast (0.4s)</option>
                <option value="1000">Normal (1.0s)</option>
                <option value="2000">Slow (2.0s)</option>
              </select>
            </div>
          </div>

          {/* Gate sequence layout */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
            {GATES.map((gate, index) => {
              const res = gateResults[index];
              const status = res?.status || "pending";
              
              // Resolve gate card highlight classes
              let bg = "rgba(255,255,255,0.01)";
              let border = "1px solid var(--border)";
              let icon = <Clock size={14} className="text-dim" />;
              
              if (status === "active") {
                bg = "rgba(255, 255, 255, 0.06)";
                border = "1px solid rgba(255, 255, 255, 0.25)";
                icon = <div className="funding-step-spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />;
              } else if (status === "success") {
                bg = "rgba(162, 212, 168, 0.03)";
                border = "1px solid rgba(162, 212, 168, 0.25)";
                icon = <CheckCircle2 size={14} style={{ color: "var(--success)" }} />;
              } else if (status === "failed") {
                bg = "rgba(232, 85, 85, 0.04)";
                border = "1px solid rgba(232, 85, 85, 0.3)";
                icon = <XCircle size={14} style={{ color: "var(--danger)" }} />;
              } else if (status === "skipped") {
                bg = "rgba(255,255,255,0.005)";
                border = "1px solid rgba(255,255,255,0.03)";
                icon = <Info size={14} style={{ color: "var(--text-dim)" }} />;
              }

              const isCurrent = currentGateIdx === index;

              return (
                <div
                  key={gate.id}
                  style={{
                    background: bg,
                    border: border,
                    borderRadius: "14px",
                    padding: "12px 16px",
                    transition: "all 0.25s ease",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    opacity: pipelineState !== "idle" && status === "pending" ? 0.35 : 1,
                    transform: isCurrent ? "scale(1.01)" : "scale(1)",
                    boxShadow: isCurrent ? "0 4px 20px rgba(255, 255, 255, 0.05)" : "none"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "50%", background: status === "success" ? "rgba(162, 212, 168, 0.1)" : "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "11px", fontWeight: "700", flexShrink: 0, marginTop: "2px" }}>
                    {gate.id}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: status === "active" ? "#ffffff" : status === "failed" ? "var(--danger)" : "#fff" }}>
                        {gate.name}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {icon}
                      </span>
                    </div>

                    <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px", lineHeight: "1.4" }}>
                      {gate.desc}
                    </p>

                    {res?.output && (
                      <div style={{
                        marginTop: "8px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: "rgba(0,0,0,0.15)",
                        border: "1px solid rgba(255,255,255,0.03)",
                        fontFamily: "monospace",
                        fontSize: "10px",
                        color: status === "success" ? "var(--success)" : status === "failed" ? "var(--danger)" : "var(--text-secondary)",
                        lineHeight: "1.3",
                        animation: "cardFadeIn 0.2s ease"
                      }}>
                        {res.output}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action triggers */}
          <div style={{ display: "flex", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
            {pipelineState === "paused" ? (
              <button
                onClick={advanceStep}
                className="sim-btn"
                style={{
                  flex: 1.5,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "#a78bfa",
                  color: "#fff"
                }}
              >
                <ArrowRight size={14} />
                Next Gate
              </button>
            ) : (
              <button
                onClick={() => runVerification(false)}
                disabled={pipelineState === "simulating"}
                className="sim-btn"
                style={{
                  flex: 1.5,
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                <Play size={14} />
                Run Pipeline
              </button>
            )}

            <button
              onClick={() => runVerification(true)}
              disabled={pipelineState === "simulating"}
              style={{
                flex: 1,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Step Walkthrough
            </button>

            <button
              onClick={() => {
                setPipelineState("idle");
                setCurrentGateIdx(null);
                setGateResults([]);
                addLog("🔄 Pipeline visualizer reset.", "info");
              }}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer"
              }}
              title="Reset Visualizer"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          COLUMN 3: LIVE STATE, PDA SEEDS, CODE PARITY, TERMINAL
         ────────────────────────────────────────────────────────── */}
      <div className="simulator-col">
        
        {/* COUNTERS & RESET */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: "12px" }}>
            <div>
              <div className="card-title">Simulated Daily State</div>
              <div className="card-subtitle">Active quotas of local SDK memory cache</div>
            </div>
            <button className="card-badge" onClick={handleResetCounters}>
              Reset Day 
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Wallet global Cap */}
            <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", padding: "12px", borderRadius: "14px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>Wallet Cumulative Spend</div>
              <div style={{ fontSize: "20px", fontWeight: "300", color: "#fff", margin: "4px 0" }}>
                {(walletDailySpend / 1000000000).toFixed(3)} SOL
              </div>
              <div className="progress-track" style={{ height: "4px", margin: "8px 0 4px" }}>
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(walletDailySpend / config.wallet.wallet_daily_cap) * 100}%`,
                    background: "var(--accent)"
                  }} 
                />
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-dim)", textAlign: "right" }}>
                Cap: {config.wallet.wallet_daily_cap / 1000000000} SOL
              </div>
            </div>

            {/* Selected Agent cap */}
            <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", padding: "12px", borderRadius: "14px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                Agent #{txAgentId} Daily Spend
              </div>
              <div style={{ fontSize: "20px", fontWeight: "300", color: "#fff", margin: "4px 0" }}>
                {(((agentSpends[txAgentId]?.spend || 0)) / 1000000000).toFixed(3)} SOL
              </div>
              <div className="progress-track" style={{ height: "4px", margin: "8px 0 4px" }}>
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${((agentSpends[txAgentId]?.spend || 0) / (config.agents[txAgentId]?.daily_cap || 1)) * 100}%`,
                    background: "#a78bfa"
                  }} 
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--text-dim)" }}>
                <span>Tx Count: {agentSpends[txAgentId]?.count || 0} / {config.agents[txAgentId]?.daily_tx_count_limit || 0}</span>
                <span>Cap: {(config.agents[txAgentId]?.daily_cap || 0) / 1000000000} SOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* PDA SEEDS DERIVATION PANEL */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: "12px" }}>
            <div>
              <div className="card-title">Solana PDA Seed Derivations</div>
              <div className="card-subtitle">On-chain deterministic key spaces calculated by the SDK</div>
            </div>
            <Key size={14} color="var(--success)" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px" }}>
            <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border)", padding: "10px", borderRadius: "10px" }}>
              <div style={{ color: "#fff", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <Database size={11} color="var(--success)" />
                WalletConfig PDA Address
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                {pdaWalletConfig.seeds.map((s, i) => (
                  <span key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontFamily: "monospace" }}>
                    {s}
                  </span>
                ))}
              </div>
              <div style={{ fontFamily: "monospace", color: "var(--text-secondary)", marginTop: "6px", wordBreak: "break-all" }}>
                PDA: {pdaWalletConfig.address}
              </div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border)", padding: "10px", borderRadius: "10px" }}>
              <div style={{ color: "#fff", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <Database size={11} color="#a78bfa" />
                AgentState PDA Address (Agent #{txAgentId})
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                {pdaAgentState.seeds.map((s, i) => (
                  <span key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontFamily: "monospace" }}>
                    {s}
                  </span>
                ))}
              </div>
              <div style={{ fontFamily: "monospace", color: "var(--text-secondary)", marginTop: "6px", wordBreak: "break-all" }}>
                PDA: {pdaAgentState.address}
              </div>
            </div>
          </div>
        </div>

        {/* CODE PARITY AND TRACE LOGGER TABS */}
        <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "300px" }}>
          
          <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={14} />
              Logs & SDK Equivalence
            </div>
          </div>

          {/* Terminal Console */}
          <div style={{ flex: 1.2, background: "#020202", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", fontFamily: "monospace", fontSize: "10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px" }}>
            {logs.map((l, i) => {
              let color = "var(--text-secondary)";
              if (l.type === "success") color = "var(--success)";
              if (l.type === "danger") color = "var(--danger)";
              if (l.type === "warning") color = "#f59e0b";
              
              return (
                <div key={i} style={{ color }}>
                  <span style={{ color: "var(--text-dim)" }}>[{l.time}]</span> {l.text}
                </div>
              );
            })}
            {logs.length === 0 && (
              <div style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "24px" }}>
                Console logs idle. Initiate a transaction to trace executions.
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Rust SDK Equivalence Code Snippet */}
          <div style={{ flex: 1.8, marginTop: "12px", display: "flex", flexDirection: "column", minHeight: "180px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Code size={12} />
                equivalent_rust_sdk.rs
              </span>
            </div>
            
            <textarea
              readOnly
              value={rustSnippet}
              style={{
                flex: 1,
                width: "100%",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "10px",
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#e2e8f0",
                resize: "none",
                outline: "none"
              }}
            />
          </div>

        </div>

      </div>

    </div>
  );
}
