# California Passenger Rail Tracker

Live map of Amtrak trains in California. Built with a Rust (axum) backend and a React + TypeScript frontend, deployed on Google Cloud Run.

**Live demo:** https://rail-tracker-645740852406.us-central1.run.app/

![Screenshot](docs/screenshot.png)

## What it does

- Shows real-time train positions on an interactive map, refreshed every few seconds.
- Click a train for its route, speed and last update. Filter by route.
- Optional rail-network overlay (OpenRailwayMap) and a clearly labeled simulated freight demo layer.

## How it works

The Rust service fetches the Amtraker API, keeps the result in an in-memory cache that refreshes at most every 30 seconds, and serves it as JSON at /api/trains. The same service serves the built React app. The browser only talks to this cache, never to the upstream feed, so visitors cannot overload the data source.

## Why passenger rail

Passenger trains have public real-time data; large freight railroads generally do not publish free live positions. The backend is built so another data provider, such as a freight feed, can be added without changing the frontend.

## Run locally

- Backend: cd backend, then cargo run (listens on port 3000)
- Frontend: cd frontend, then npm install and npm run dev (open http://localhost:5173)

## Data sources and credits

- Train data: Amtraker (https://amtraker.com), licensed ODC-By
- Map: OpenStreetMap contributors; rail overlay: OpenRailwayMap