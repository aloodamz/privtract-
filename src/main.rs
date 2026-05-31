use std::io::{self, BufRead};
use std::process;
use priv_tract::{PrivTractSDK, SdkTransaction};

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let config_path = args
        .iter()
        .position(|a| a == "--config")
        .and_then(|i| args.get(i + 1))
        .map(String::as_str)
        .unwrap_or("config.toml");

    let sdk = match PrivTractSDK::from_config(config_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("fatal: failed to load config: {e}");
            process::exit(1);
        }
    };

    if args.iter().any(|a| a == "--reset-daily") {
        sdk.reset_daily_state();
        eprintln!("info: daily counters reset");
    }

    let input_path = args
        .iter()
        .position(|a| a == "--input")
        .and_then(|i| args.get(i + 1))
        .map(String::as_str)
        .unwrap_or("transactions.jsonl");

    eprintln!("info: sdk loaded from {config_path}");
    eprintln!("info: reading JSON transactions from {input_path}...");

    let file = match std::fs::File::open(input_path) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("fatal: failed to open {input_path}: {e}");
            process::exit(1);
        }
    };
    let reader = io::BufReader::new(file);

    let mut approved = 0u64;
    let mut denied = 0u64;

    for (idx, line) in reader.lines().enumerate() {
        let line = match line {
            Ok(l) if !l.trim().is_empty() => l,
            Ok(_) => continue,
            Err(e) => {
                eprintln!("tx[{idx}] read error: {e}");
                denied += 1;
                continue;
            }
        };

        let tx: SdkTransaction = match serde_json::from_str(line.trim()) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("tx[{idx}] parse error: {e}");
                denied += 1;
                continue;
            }
        };

        match sdk.evaluate(&tx) {
            Ok(receipt) => {
                println!("tx[{idx}] APPROVED: {}", receipt.message);
                approved += 1;
            }
            Err(e) => {
                println!("tx[{idx}] DENIED: {e}");
                denied += 1;
            }
        }
    }

    eprintln!("summary: {approved} approved, {denied} denied");
}
