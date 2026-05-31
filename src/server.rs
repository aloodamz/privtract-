use axum::{
    extract::{DefaultBodyLimit, Json, State},
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    routing::{get, post},
    response::IntoResponse,
    Router,
};
use parking_lot::RwLock;
use priv_tract::{PrivTractSDK, SdkTransaction};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::process;
use std::str::FromStr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tower_http::cors::CorsLayer;

const MAX_ACTIVITY_ITEMS: usize = 500;
const MAX_REQUEST_BODY_BYTES: usize = 16 * 1024;

#[derive(Clone)]
struct ServerConfig {
    bind_addr: SocketAddr,
    allowed_origins: Vec<HeaderValue>,
}

struct AppState {
    sdk: RwLock<PrivTractSDK>,
    activity: RwLock<Vec<ActivityItem>>,
    next_activity_id: AtomicUsize,
    admin_token: Option<String>,
}

#[derive(Serialize, Clone)]
struct ActivityItem {
    id: usize,
    status: String,
    message: String,
    agent_id: String,
    to: String,
    value: String,
    timestamp: u64,
}

#[derive(Serialize)]
struct ValidateResponse {
    status: String,
    message: String,
}

fn parse_server_config() -> Result<ServerConfig, String> {
    let bind_addr = std::env::var("POLICY_SERVER_BIND")
        .unwrap_or_else(|_| "127.0.0.1:3001".to_string());
    let bind_addr = SocketAddr::from_str(&bind_addr)
        .map_err(|e| format!("invalid POLICY_SERVER_BIND: {e}"))?;

    let origins = std::env::var("POLICY_SERVER_ALLOWED_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:5173,http://127.0.0.1:5173".to_string()
    });
    let allowed_origins = origins
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(HeaderValue::from_str)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("invalid POLICY_SERVER_ALLOWED_ORIGINS entry: {e}"))?;

    if allowed_origins.is_empty() {
        return Err("POLICY_SERVER_ALLOWED_ORIGINS must contain at least one origin".to_string());
    }

    Ok(ServerConfig {
        bind_addr,
        allowed_origins,
    })
}

fn current_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn push_activity(state: &AppState, item: ActivityItem) {
    let mut activity = state.activity.write();
    activity.insert(0, item);
    if activity.len() > MAX_ACTIVITY_ITEMS {
        activity.truncate(MAX_ACTIVITY_ITEMS);
    }
}

async fn validate_transaction(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SdkTransaction>,
) -> impl IntoResponse {
    let id = state.next_activity_id.fetch_add(1, Ordering::Relaxed);
    let now = current_unix_timestamp();

    let sdk = state.sdk.read();
    match sdk.evaluate(&payload) {
        Ok(receipt) => {
            push_activity(&state, ActivityItem {
                id,
                status: "approved".to_string(),
                message: receipt.message.clone(),
                agent_id: payload.from_agent.to_wire(),
                to: payload.to.to_wire(),
                value: payload.value_lamports.to_string(),
                timestamp: now,
            });

            (StatusCode::OK, Json(ValidateResponse {
                status: "approved".to_string(),
                message: receipt.message,
            }))
        }
        Err(e) => {
            push_activity(&state, ActivityItem {
                id,
                status: "denied".to_string(),
                message: e.to_string(),
                agent_id: payload.from_agent.to_wire(),
                to: payload.to.to_wire(),
                value: payload.value_lamports.to_string(),
                timestamp: now,
            });

            (StatusCode::FORBIDDEN, Json(ValidateResponse {
                status: "denied".to_string(),
                message: e.to_string(),
            }))
        }
    }
}

#[derive(Serialize)]
struct DashboardState {
    wallet_daily_spend: String,
    wallet_daily_cap: String,
    wallet_tx_limit: String,
    kill_switch: bool,
    allowed_chain_id: u64,
    max_gas_price_gwei: u64,
    contract_calls_allowed: bool,
    recipient_whitelist: Vec<String>,
    function_selector_whitelist: Vec<String>,
    agents: std::collections::HashMap<u64, AgentInfo>,
    activity: Vec<ActivityItem>,
    admin_controls_configured: bool,
}

#[derive(Serialize)]
struct AgentInfo {
    tx_limit: String,
    daily_cap: String,
    daily_spend: String,
    daily_tx_count_limit: u64,
    daily_tx_count: u64,
    sha256_hash: String,
    blake3_hash: String,
    sol_balance: String,
    usdc_balance: String,
    bonk_balance: String,
}

async fn get_state(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sdk = state.sdk.read();
    let wallet_spend = sdk.wallet_daily_spend.load(Ordering::Acquire).to_string();
    
    let mut agents_info = std::collections::HashMap::new();
    if let Some(ref wallet) = sdk.wallet {
        for (id, (config, agent_state)) in &sdk.agents {
            let daily_spend = agent_state.daily_spend.load(Ordering::Acquire).to_string();
            let daily_tx_count = agent_state.daily_tx_count.load(Ordering::Acquire);
            
            let sha256_str = format!("sha256:{}", hex::encode(priv_tract::sha256_str(&id.to_string())));
            let blake3_str = format!("blake3:{}", hex::encode(priv_tract::blake3_str(&id.to_string())));
            
            agents_info.insert(*id, AgentInfo {
                tx_limit: config.tx_limit.to_string(),
                daily_cap: config.daily_cap.to_string(),
                daily_spend,
                daily_tx_count_limit: config.daily_tx_count_limit,
                daily_tx_count,
                sha256_hash: sha256_str,
                blake3_hash: blake3_str,
                sol_balance: agent_state.sol_balance.load(Ordering::Acquire).to_string(),
                usdc_balance: agent_state.usdc_balance.load(Ordering::Acquire).to_string(),
                bonk_balance: agent_state.bonk_balance.load(Ordering::Acquire).to_string(),
            });
        }

        let recipient_whitelist: Vec<String> = wallet.recipient_whitelist
            .iter()
            .map(|addr| priv_tract::encode_solana_pubkey(addr))
            .collect();

        let function_selector_whitelist: Vec<String> = wallet.function_selector_whitelist
            .iter()
            .map(|sel| format!("0x{}", hex::encode(sel)))
            .collect();

        let activity = state.activity.read().clone();
        
        (StatusCode::OK, Json(DashboardState {
            wallet_daily_spend: wallet_spend,
            wallet_daily_cap: wallet.wallet_daily_cap.to_string(),
            wallet_tx_limit: wallet.wallet_tx_limit.to_string(),
            kill_switch: wallet.kill_switch.load(Ordering::Acquire),
            allowed_chain_id: wallet.allowed_chain_id,
            max_gas_price_gwei: wallet.max_priority_fee,
            contract_calls_allowed: wallet.contract_calls_allowed,
            recipient_whitelist,
            function_selector_whitelist,
            agents: agents_info,
            activity,
            admin_controls_configured: state.admin_token.is_some(),
        })).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "SDK not initialized in embedded mode").into_response()
    }
}

fn check_auth(state: &AppState, headers: &axum::http::HeaderMap) -> Result<(), (StatusCode, Json<ValidateResponse>)> {
    let admin_token = match &state.admin_token {
        Some(token) => token,
        None => {
            return Err((
                StatusCode::FORBIDDEN,
                Json(ValidateResponse {
                    status: "error".to_string(),
                    message: "Admin controls are not configured on this server.".to_string(),
                }),
            ));
        }
    };

    let provided_token = headers
        .get("x-admin-token")
        .and_then(|val| val.to_str().ok());

    match provided_token {
        Some(token) if token == admin_token => Ok(()),
        _ => Err((
            StatusCode::UNAUTHORIZED,
            Json(ValidateResponse {
                status: "error".to_string(),
                message: "Unauthorized: Invalid or missing admin token.".to_string(),
            }),
        )),
    }
}

#[derive(Deserialize)]
struct KillSwitchInput {
    active: bool,
}

async fn toggle_kill_switch(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<KillSwitchInput>,
) -> impl IntoResponse {
    if let Err(err) = check_auth(&state, &headers) {
        return err.into_response();
    }

    let sdk = state.sdk.read();
    if let Some(ref wallet) = sdk.wallet {
        wallet.kill_switch.store(payload.active, Ordering::Release);
        (
            StatusCode::OK,
            Json(ValidateResponse {
                status: "success".to_string(),
                message: format!(
                    "Kill switch is now {}",
                    if payload.active { "ACTIVE" } else { "INACTIVE" }
                ),
            }),
        ).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "SDK not initialized in embedded mode").into_response()
    }
}

fn parse_uint256(s: &str) -> Result<u64, String> {
    let s = s.trim();
    if let Some(h) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
        u64::from_str_radix(h, 16).map_err(|e| format!("invalid hex: {e}"))
    } else {
        s.parse::<u64>().map_err(|e| format!("invalid decimal: {e}"))
    }
}

fn parse_float_scaled(amount_str: &str, decimals: u32) -> Result<u64, String> {
    let amount: f64 = amount_str.trim().parse().map_err(|e| format!("invalid float: {e}"))?;
    if amount < 0.0 {
        return Err("amount cannot be negative".to_string());
    }
    let scaled = amount * (10f64.powi(decimals as i32));
    Ok(scaled as u64)
}

#[derive(Deserialize)]
struct AddAgentInput {
    id: u64,
    tx_limit: String,
    daily_cap: String,
    daily_tx_count_limit: u64,
}

async fn add_agent(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<AddAgentInput>,
) -> impl IntoResponse {
    if let Err(err) = check_auth(&state, &headers) {
        return err.into_response();
    }

    let tx_limit = match parse_uint256(&payload.tx_limit) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Invalid tx_limit: {}", e),
        })).into_response(),
    };
    let daily_cap = match parse_uint256(&payload.daily_cap) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Invalid daily_cap: {}", e),
        })).into_response(),
    };

    let mut sdk = state.sdk.write();
    let agent_config = priv_tract::SdkAgentConfig {
        tx_limit,
        daily_cap,
        daily_tx_count_limit: payload.daily_tx_count_limit,
    };
    
    if sdk.agents.contains_key(&payload.id) {
        return (StatusCode::CONFLICT, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Agent {} already exists. Delete it first to re-register.", payload.id),
        })).into_response();
    }
    sdk.agents.insert(payload.id, (agent_config, priv_tract::SdkAgentState::default()));

    (StatusCode::OK, Json(ValidateResponse {
        status: "success".to_string(),
        message: format!("Agent {} registered successfully", payload.id),
    })).into_response()
}

#[derive(Deserialize)]
struct FundAgentInput {
    id: u64,
    token: String,
    amount: String,
}

async fn fund_agent(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<FundAgentInput>,
) -> impl IntoResponse {
    if let Err(err) = check_auth(&state, &headers) {
        return err.into_response();
    }

    let token = payload.token.trim().to_uppercase();
    let decimals = match token.as_str() {
        "SOL" => 9,
        "USDC" => 6,
        "BONK" => 5,
        _ => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Unsupported token: {}", payload.token),
        })).into_response(),
    };

    let val = match parse_float_scaled(&payload.amount, decimals) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Invalid amount: {}", e),
        })).into_response(),
    };

    let sdk = state.sdk.read();
    let agent = match sdk.agents.get(&payload.id) {
        Some((_, state_ref)) => state_ref,
        None => return (StatusCode::NOT_FOUND, Json(ValidateResponse {
            status: "error".to_string(),
            message: format!("Agent {} not found", payload.id),
        })).into_response(),
    };

    match token.as_str() {
        "SOL" => agent.sol_balance.fetch_add(val, Ordering::AcqRel),
        "USDC" => agent.usdc_balance.fetch_add(val, Ordering::AcqRel),
        "BONK" => agent.bonk_balance.fetch_add(val, Ordering::AcqRel),
        _ => unreachable!(),
    };

    let id = state.next_activity_id.fetch_add(1, Ordering::Relaxed);
    let now = current_unix_timestamp();
    push_activity(&state, ActivityItem {
        id,
        status: "approved".to_string(),
        message: format!("Funded Agent {} with {} {}", payload.id, payload.amount, token),
        agent_id: payload.id.to_string(),
        to: "Solana Wallet".to_string(),
        value: val.to_string(),
        timestamp: now,
    });

    (StatusCode::OK, Json(ValidateResponse {
        status: "success".to_string(),
        message: format!("Successfully funded Agent {} with {} {}", payload.id, payload.amount, token),
    })).into_response()
}

#[derive(Deserialize)]
struct EditPoliciesInput {
    wallet_tx_limit: Option<String>,
    wallet_daily_cap: Option<String>,
    max_gas_price_gwei: Option<u64>,
    contract_calls_allowed: Option<bool>,
    recipient_whitelist: Option<Vec<String>>,
    function_selector_whitelist: Option<Vec<String>>,
}

async fn edit_policies(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<EditPoliciesInput>,
) -> impl IntoResponse {
    if let Err(err) = check_auth(&state, &headers) {
        return err.into_response();
    }

    let mut sdk = state.sdk.write();
    let cfg = match &mut sdk.wallet {
        Some(w) => w,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(ValidateResponse {
            status: "error".to_string(),
            message: "SDK not initialized in embedded mode".to_string(),
        })).into_response(),
    };

    if let Some(limit_str) = payload.wallet_tx_limit {
        match parse_uint256(&limit_str) {
            Ok(v) => cfg.wallet_tx_limit = v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
                status: "error".to_string(),
                message: format!("Invalid wallet_tx_limit: {}", e),
            })).into_response(),
        }
    }

    if let Some(cap_str) = payload.wallet_daily_cap {
        match parse_uint256(&cap_str) {
            Ok(v) => cfg.wallet_daily_cap = v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
                status: "error".to_string(),
                message: format!("Invalid wallet_daily_cap: {}", e),
            })).into_response(),
        }
    }

    if let Some(max_gas) = payload.max_gas_price_gwei {
        cfg.max_priority_fee = max_gas;
    }

    if let Some(calls_allowed) = payload.contract_calls_allowed {
        cfg.contract_calls_allowed = calls_allowed;
    }

    if let Some(whitelist) = payload.recipient_whitelist {
        let mut new_set = std::collections::HashSet::new();
        for addr_str in whitelist {
            match priv_tract::decode_solana_pubkey(&addr_str) {
                Ok(pubkey) => {
                    new_set.insert(pubkey);
                }
                _ => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
                    status: "error".to_string(),
                    message: format!("Invalid whitelist address: {}", addr_str),
                })).into_response(),
            }
        }
        cfg.recipient_whitelist = new_set;
    }

    if let Some(selectors) = payload.function_selector_whitelist {
        let mut new_set = std::collections::HashSet::new();
        for sel_str in selectors {
            let clean = sel_str.strip_prefix("0x").unwrap_or(&sel_str);
            match hex::decode(clean) {
                Ok(bytes) => {
                    new_set.insert(bytes);
                }
                Err(e) => return (StatusCode::BAD_REQUEST, Json(ValidateResponse {
                    status: "error".to_string(),
                    message: format!("Invalid selector hex {}: {}", sel_str, e),
                })).into_response(),
            }
        }
        cfg.function_selector_whitelist = new_set;
    }

    (StatusCode::OK, Json(ValidateResponse {
        status: "success".to_string(),
        message: "Policies updated successfully".to_string(),
    })).into_response()
}

#[tokio::main]
async fn main() {
    let server_config = match parse_server_config() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("fatal: failed to load server config: {error}");
            process::exit(1);
        }
    };

    let sdk = match PrivTractSDK::from_config("config.toml") {
        Ok(s) => s,
        Err(error) => {
            eprintln!("fatal: failed to load config.toml: {error}");
            process::exit(1);
        }
    };
    
    let admin_token = std::env::var("POLICY_SERVER_ADMIN_TOKEN")
        .ok()
        .filter(|s| !s.trim().is_empty());

    if admin_token.is_none() {
        eprintln!("WARNING: POLICY_SERVER_ADMIN_TOKEN is not set. Admin endpoints (agents, policies, kill-switch) are disabled. /api/state is publicly readable.");
    }

    let app_state = Arc::new(AppState {
        sdk: RwLock::new(sdk),
        activity: RwLock::new(vec![]),
        next_activity_id: AtomicUsize::new(0),
        admin_token,
    });

    let reset_state = app_state.clone();
    tokio::spawn(async move {
        loop {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let seconds_until_midnight = 86400 - (now % 86400);
            tokio::time::sleep(tokio::time::Duration::from_secs(seconds_until_midnight)).await;
            reset_state.sdk.read().reset_daily_state();
            eprintln!("info: daily spend counters reset at midnight UTC");
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(server_config.allowed_origins.clone())
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE, HeaderName::from_static("x-admin-token")]);

    let app = Router::new()
        .route("/api/validate", post(validate_transaction))
        .route("/api/state", get(get_state))
        .route("/api/kill-switch", post(toggle_kill_switch))
        .route("/api/agents", post(add_agent))
        .route("/api/agents/fund", post(fund_agent))
        .route("/api/policies", post(edit_policies))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_BYTES))
        .layer(cors)
        .with_state(app_state);

    println!(
        "Policy Engine Dashboard Server listening on {}",
        server_config.bind_addr
    );
    let listener = match tokio::net::TcpListener::bind(server_config.bind_addr).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("fatal: failed to bind server socket: {error}");
            process::exit(1);
        }
    };

    if let Err(error) = axum::serve(listener, app).await {
        eprintln!("fatal: server exited with error: {error}");
        process::exit(1);
    }
}
