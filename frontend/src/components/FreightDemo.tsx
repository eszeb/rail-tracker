import { useEffect, useState } from 'react'
import { Layer, Marker, Source } from 'react-map-gl/maplibre'
import type { Feature, LineString } from 'geojson'

type Point = [number, number] // [longitude, latitude]

// Rough straight lines between towns. NOT real track geometry.
const ROUTE: Point[] = [
  [-118.236, 34.056], // Los Angeles
  [-117.289, 34.108], // San Bernardino
  [-117.02, 34.9], // Barstow
]

const LINE: Feature<LineString> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: ROUTE },
}

function pointAt(route: Point[], progress: number): Point {
  const lengths = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]))
  const total = lengths.reduce((a, b) => a + b, 0)
  let remaining = progress * total
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const f = remaining / lengths[i]
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * f,
        route[i][1] + (route[i + 1][1] - route[i][1]) * f,
      ]
    }
    remaining -= lengths[i]
  }
  return route[route.length - 1]
}

export default function FreightDemo() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setProgress((p) => (p + 0.005) % 1), 500)
    return () => clearInterval(id)
  }, [])

  const [lon, lat] = pointAt(ROUTE, progress)

  return (
    <>
      <Source id='freight-demo' type='geojson' data={LINE}>
        <Layer
          id='freight-demo-line'
          type='line'
          paint={{ 'line-color': '#777777', 'line-width': 2, 'line-dasharray': [2, 2] }}
        />
      </Source>
      <Marker longitude={lon} latitude={lat} anchor='center'>
        <div className='sim-badge' title='Simulated freight train (demo data, not a real train)'>
          SIMULATED
        </div>
      </Marker>
    </>
  )
}