use axum::{routing::get, Json, Router};
use serde::Serialize;
use serde_json::{json, Value};

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

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn trains() -> Json<Vec<Train>> {
    let train = |id: &str, route: &str, lat: f64, lon: f64| Train {
        id: id.to_string(),
        provider: "demo".to_string(),
        agency: "Amtrak".to_string(),
        route_name: route.to_string(),
        lat,
        lon,
        heading_deg: Some(90.0),
        speed_mph: Some(55.0),
        last_update: "2026-10-07T12:00:00Z".to_string(),
        simulated: true,
    };
    Json(vec![
        train("demo-1", "Capitol Corridor (demo)", 38.58, -121.49),
        train("demo-2", "Pacific Surfliner (demo)", 34.06, -118.24),
        train("demo-3", "San Joaquins (demo)", 37.80, -122.27),
    ])
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/trains", get(trains));

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    println!("listening on port {port}");
    axum::serve(listener, app).await.unwrap();
}