# California Passenger Rail Tracker

Live map of Amtrak trains in California. Built with a Rust (axum) backend and a React + TypeScript frontend, deployed on Google Cloud Run.

**Live demo:** https://rail-tracker-645740852406.us-central1.run.app/

![Screenshot](/PageScreenshot.png)

## What it does
 
- Shows real-time train positions on an interactive map, refreshed every few seconds.
- Click a train for its route, speed and last update. Show or hide individual routes.
- Rail-network overlay (OpenRailwayMap) and a clearly labeled simulated freight demo layer, both switchable from the panel.
- Light and dark themes, and a layout that adapts to phones.
  
## Tech stack
 
- **Backend:** Rust, axum, tokio, reqwest, serde
- **Frontend:** React, TypeScript, Vite, TanStack Query
- **Map:** MapLibre GL via react-map-gl, with a CARTO vector basemap (map label colors are restyled in code)
- **Hosting:** one Docker container on Google Cloud Run
  
## How it works
 
The Rust service fetches the Amtraker API, keeps the result in an in-memory cache, and serves it as JSON at `/api/trains`. The cache refreshes when a request arrives and the data is more than 30 seconds old, so there is no background task and idle time costs nothing. The same service serves the built React app. The browser only talks to this cache, never to the upstream feed, so visitors cannot overload the data source.
 
The frontend polls `/api/trains` every 5 seconds and draws each train as an arrow pointing in its heading, colored by route.
 
## Why passenger rail
 
Passenger trains have public real-time data; large freight railroads generally do not publish free live positions. The backend is built so another data provider, such as a freight feed, can be added without changing the frontend.
 
## Limitations
 
- Train data comes from Amtraker, a community-run API built on Amtrak's tracking data, so it can change or go down.
- The "Simulated freight (demo)" layer is a fake train on a rough line between towns. It is not real data and not real track.
  
## Run locally
 
You need Rust and Node.js installed.
 
1. In the project root, create two files using `.env.example` as a template: `.env.development` (used by `npm run dev`) and `.env.production` (used by builds and deploys). Each needs a free CARTO basemap key (https://carto.com/basemaps/apikey/):
```
   VITE_CARTO_API_KEY=your_key_here
```

2. Start the backend (listens on port 3000):
```
   cd backend
   cargo run
```
 
3. In a second terminal, start the frontend and open http://localhost:5173:
```
   cd frontend
   npm install
   npm run dev
```
 
Amtraker asks API users to send a `User-Agent` that identifies the project. Set yours in `backend/src/main.rs`.
 
## Deploy
 
From the project root:
 
```
gcloud run deploy rail-tracker --source . --region us-central1 --allow-unauthenticated --max-instances 2
```
 
The `Dockerfile` builds the React app and the Rust binary into one image. The CARTO key is read from `.env.production` at build time.


## Data sources and credits
 
- Train data: [Amtraker](https://amtraker.com), licensed ODC-By
- Basemap: © [CARTO](https://carto.com/attributions), © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Rail overlay: [OpenRailwayMap](https://www.openrailwaymap.org/), data © OpenStreetMap contributors, style CC-BY-SA 2.0
- Map rendering: [MapLibre GL JS](https://maplibre.org/) via react-map-gl
