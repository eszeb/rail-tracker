use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::Mutex;

// California bounding box: min_lat, max_lat, min_lon, max_lon
const CA: (f64, f64, f64, f64) = (32.5, 42.0, -124.5, -114.0);
const REFRESH_AFTER: Duration = Duration::from_secs(30);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Train {
    id: String,
    provider: String,
    agency: String,
    route_name: String,
    lat: f64,
    lon: f64,
    heading_deg: Option<f32>,
    speed_mph: Option<f32>,
    last_update: String,
    simulated: bool,
}

struct Cache {
    trains: Vec<Train>,
    fetched_at: Option<Instant>,
}

#[derive(Clone)]
struct AppState {
    cache: Arc<Mutex<Cache>>,
    client: reqwest::Client,
}

fn heading_to_degrees(h: &str) -> Option<f32> {
    match h.trim().to_uppercase().as_str() {
        "N" => Some(0.0),
        "NE" => Some(45.0),
        "E" => Some(90.0),
        "SE" => Some(135.0),
        "S" => Some(180.0),
        "SW" => Some(225.0),
        "W" => Some(270.0),
        "NW" => Some(315.0),
        _ => None,
    }
}

async fn fetch_amtrak(client: &reqwest::Client) -> anyhow::Result<Vec<Train>> {
    // The API returns an object keyed by train number; each value is a list of trains.
    let raw: HashMap<String, Vec<Value>> = client
        .get("https://api.amtraker.com/v3/trains")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let mut out = Vec::new();
    for (num, entries) in raw {
        for (i, t) in entries.iter().enumerate() {
            let (Some(lat), Some(lon)) = (t["lat"].as_f64(), t["lon"].as_f64()) else {
                continue;
            };
            let in_california = lat >= CA.0 && lat <= CA.1 && lon >= CA.2 && lon <= CA.3;
            let other_provider = matches!(t["provider"].as_str(), Some(p) if p != "Amtrak");
            if !in_california || other_provider {
                continue;
            }
            out.push(Train {
                id: format!("amtrak-{num}-{i}"),
                provider: "amtrak".to_string(),
                agency: "Amtrak".to_string(),
                route_name: t["routeName"].as_str().unwrap_or("Unknown route").to_string(),
                lat,
                lon,
                heading_deg: t["heading"].as_str().and_then(heading_to_degrees),
                speed_mph: t["velocity"].as_f64().map(|v| v as f32),
                last_update: t["updatedAt"].as_str().unwrap_or("").to_string(),
                simulated: false,
            });
        }
    }
    Ok(out)
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn trains(State(state): State<AppState>) -> Json<Vec<Train>> {
    let mut cache = state.cache.lock().await;
    let stale = cache
        .fetched_at
        .map_or(true, |t| t.elapsed() > REFRESH_AFTER);
    if stale {
        match fetch_amtrak(&state.client).await {
            Ok(trains) => cache.trains = trains,
            Err(e) => eprintln!("Amtrak fetch failed: {e}"),
        }
        // Also wait a full interval after a failure, so we don't hammer the feed.
        cache.fetched_at = Some(Instant::now());
    }
    Json(cache.trains.clone())
}

#[tokio::main]
async fn main() {
    let client = reqwest::Client::builder()
        .user_agent("rail-tracker (redacted@example.com)")
        .build()
        .expect("could not build HTTP client");

    let state = AppState {
        cache: Arc::new(Mutex::new(Cache {
            trains: Vec::new(),
            fetched_at: None,
        })),
        client,
    };

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/trains", get(trains))
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    println!("listening on port {port}");
    axum::serve(listener, app).await.unwrap();
}

// use axum::{routing::get, Json, Router};
// use serde::Serialize;
// use serde_json::{json, Value};

// #[derive(Serialize, Clone)]
// #[serde(rename_all = "camelCase")]
// struct Train {
//     id: String,
//     provider: String,
//     agency: String,
//     route_name: String,
//     lat: f64,
//     lon: f64,
//     heading_deg: Option<f32>,
//     speed_mph: Option<f32>,
//     last_update: String,
//     simulated: bool,
// }

// async fn health() -> Json<Value> {
//     Json(json!({ "status": "ok" }))
// }

// async fn trains() -> Json<Vec<Train>> {
//     let train = |id: &str, route: &str, lat: f64, lon: f64| Train {
//         id: id.to_string(),
//         provider: "demo".to_string(),
//         agency: "Amtrak".to_string(),
//         route_name: route.to_string(),
//         lat,
//         lon,
//         heading_deg: Some(90.0),
//         speed_mph: Some(55.0),
//         last_update: "2026-10-07T12:00:00Z".to_string(),
//         simulated: true,
//     };
//     Json(vec![
//         train("demo-1", "Capitol Corridor (demo)", 38.58, -121.49),
//         train("demo-2", "Pacific Surfliner (demo)", 34.06, -118.24),
//         train("demo-3", "San Joaquins (demo)", 37.80, -122.27),
//     ])
// }

// #[tokio::main]
// async fn main() {
//     let app = Router::new()
//         .route("/api/health", get(health))
//         .route("/api/trains", get(trains));

//     let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
//     let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
//         .await
//         .unwrap();
//     println!("listening on port {port}");
//     axum::serve(listener, app).await.unwrap();
// }