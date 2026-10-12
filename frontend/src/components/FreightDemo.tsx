import { useEffect, useState } from 'react'
import { Marker, Polyline, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'

type Point = [number, number] // [lat, lon]

// Rough straight lines between towns. NOT real track geometry.
const ROUTE: Point[] = [
  [34.056, -118.236], // Los Angeles
  [34.108, -117.289], // San Bernardino
  [34.9, -117.02], // Barstow
]

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

const icon = divIcon({
  html: `<div style='background:#555;color:white;padding:2px 6px;border-radius:4px;font-size:11px;white-space:nowrap;'>SIMULATED</div>`,
  className: '',
  iconAnchor: [30, 10],
})

export default function FreightDemo() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setProgress((p) => (p + 0.005) % 1), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <Polyline positions={ROUTE} pathOptions={{ color: '#555', dashArray: '6 6' }} />
      <Marker position={pointAt(ROUTE, progress)} icon={icon}>
        <Popup>Simulated freight train (demo data, not a real train)</Popup>
      </Marker>
    </>
  )
}