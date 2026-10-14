import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { divIcon } from 'leaflet'
import { LayerGroup, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { fetchTrains } from './api/trains'
import FreightDemo from './components/FreightDemo'
import type { Train } from './types'

const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf']
const STALE_AFTER_MS = 10 * 60 * 1000

// Rough rectangle around California: [[south, west], [north, east]]
const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
  [32.4, -124.6],
  [42.1, -114.0],
]

const CALIFORNIA_CENTER: [number, number] = [37.25, -119.3]
const WORLD: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
]

// Zooms out only as far as needed to fit California in the window, then lets
// you pan anywhere inside that zoomed-out view, but no further.
function LockToCalifornia() {
  const map = useMap()

  useEffect(() => {
    function lock() {
      map.setMaxBounds(WORLD) // clear any earlier limit first
      const fitZoom = map.getBoundsZoom(CALIFORNIA_BOUNDS)
      map.setMinZoom(fitZoom)
      map.setView(CALIFORNIA_CENTER, fitZoom, { animate: false })
      map.setMaxBounds(map.getBounds())
    }
    lock()
    map.on('resize', lock)
    return () => {
      map.off('resize', lock)
    }
  }, [map])

  return null
}

function colorFor(route: string): string {
  let h = 0
  for (const ch of route) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function trainIcon(t: Train) {
  const color = colorFor(t.routeName)
  const html =
    t.headingDeg != null
      ? `<div style='transform: rotate(${t.headingDeg}deg); color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>▲</div>`
      : `<div style='color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>●</div>`
  return divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
}

const box = {
  position: 'absolute',
  zIndex: 1000,
  background: 'white',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 12,
} as const

export default function App() {
  const { data: trains = [], isLoading, error } = useQuery({
    queryKey: ['trains'],
    queryFn: fetchTrains,
    refetchInterval: 5000,
  })
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const routes = useMemo(() => Array.from(new Set(trains.map((t) => t.routeName))).sort(), [trains])
  const visible = trains.filter((t) => !hidden.has(t.routeName))

  const newest = Math.max(0, ...trains.map((t) => Date.parse(t.lastUpdate)).filter((n) => !Number.isNaN(n)))
  const stale = newest > 0 && Date.now() - newest > STALE_AFTER_MS

  function toggleRoute(route: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(route)) next.delete(route)
      else next.add(route)
      return next
    })
  }

  const status = error
    ? 'Could not load trains'
    : isLoading
      ? 'Loading...'
      : stale
        ? 'Data may be stale (newest update ' + formatTime(new Date(newest).toISOString()) + ')'
        : visible.length + ' trains'

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ ...box, top: 10, left: '50%', transform: 'translateX(-50%)' }}>{status}</div>

      <div style={{ ...box, top: 80, left: 10 }}>
        <strong>Routes</strong>
        {routes.map((r) => (
          <label key={r} style={{ display: 'block' }}>
            <input type='checkbox' checked={!hidden.has(r)} onChange={() => toggleRoute(r)} />{' '}
            <span style={{ color: colorFor(r) }}>■</span> {r}
          </label>
        ))}
        <div style={{ marginTop: 6 }}>
          <a href='https://www.openrailwaymap.org/?style=standard' target='_blank' rel='noreferrer'>
            Rail map key (openrailwaymap.org)
          </a>
        </div>
      </div>

      <div style={{ ...box, bottom: 24, right: 10 }}>
        Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
      </div>

      <MapContainer
        center={CALIFORNIA_CENTER}
        zoom={6}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        <LockToCalifornia />
        <LayersControl position='topright'>
          <LayersControl.BaseLayer checked name='Street map'>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name='Rail network (OpenRailwayMap)'>
            <TileLayer
              attribution='Data <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> and OpenStreetMap'
              url='https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'
              bounds={CALIFORNIA_BOUNDS}
            />
          </LayersControl.Overlay>
          <LayersControl.Overlay name='Simulated freight (demo)'>
            <LayerGroup>
              <FreightDemo />
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>

        {visible.map((t) => (
          <Marker key={t.id} position={[t.lat, t.lon]} icon={trainIcon(t)}>
            <Popup>
              <strong>{t.routeName}</strong>
              <br />
              Speed: {t.speedMph != null ? Math.round(t.speedMph) + ' mph' : 'unknown'}
              <br />
              Updated: {formatTime(t.lastUpdate)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

// import { useEffect, useMemo, useState } from 'react'
// import { useQuery } from '@tanstack/react-query'
// import { divIcon } from 'leaflet'
// import { LayerGroup, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
// import { fetchTrains } from './api/trains'
// import FreightDemo from './components/FreightDemo'
// import type { Train } from './types'

// const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf']
// const STALE_AFTER_MS = 10 * 60 * 1000

// // Rough rectangle around California: [[south, west], [north, east]]
// const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
//   [32.4, -124.6],
//   [42.1, -114.0],
// ]

// const CALIFORNIA_CENTER: [number, number] = [37.25, -119.3]
// const WORLD: [[number, number], [number, number]] = [
//   [-85, -180],
//   [85, 180],
// ]

// // Zooms out only as far as needed to fit California in the window, then lets
// // you pan anywhere inside that zoomed-out view, but no further.
// function LockToCalifornia() {
//   const map = useMap()

//   useEffect(() => {
//     function lock() {
//       map.setMaxBounds(WORLD) // clear any earlier limit first
//       const fitZoom = map.getBoundsZoom(CALIFORNIA_BOUNDS)
//       map.setMinZoom(fitZoom)
//       map.setView(CALIFORNIA_CENTER, fitZoom, { animate: false })
//       map.setMaxBounds(map.getBounds())
//     }
//     lock()
//     map.on('resize', lock)
//     return () => {
//       map.off('resize', lock)
//     }
//   }, [map])

//   return null
// }

// function colorFor(route: string): string {
//   let h = 0
//   for (const ch of route) h = (h * 31 + ch.charCodeAt(0)) >>> 0
//   return PALETTE[h % PALETTE.length]
// }

// function trainIcon(t: Train) {
//   const color = colorFor(t.routeName)
//   const html =
//     t.headingDeg != null
//       ? `<div style='transform: rotate(${t.headingDeg}deg); color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>▲</div>`
//       : `<div style='color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>●</div>`
//   return divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
// }

// function formatTime(iso: string): string {
//   const d = new Date(iso)
//   return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
// }

// const box = {
//   position: 'absolute',
//   zIndex: 1000,
//   background: 'white',
//   padding: '4px 8px',
//   borderRadius: 4,
//   fontSize: 12,
// } as const

// export default function App() {
//   const { data: trains = [], isLoading, error } = useQuery({
//     queryKey: ['trains'],
//     queryFn: fetchTrains,
//     refetchInterval: 5000,
//   })
//   const [hidden, setHidden] = useState<Set<string>>(new Set())

//   const routes = useMemo(() => Array.from(new Set(trains.map((t) => t.routeName))).sort(), [trains])
//   const visible = trains.filter((t) => !hidden.has(t.routeName))

//   const newest = Math.max(0, ...trains.map((t) => Date.parse(t.lastUpdate)).filter((n) => !Number.isNaN(n)))
//   const stale = newest > 0 && Date.now() - newest > STALE_AFTER_MS

//   function toggleRoute(route: string) {
//     setHidden((prev) => {
//       const next = new Set(prev)
//       if (next.has(route)) next.delete(route)
//       else next.add(route)
//       return next
//     })
//   }

//   const status = error
//     ? 'Could not load trains'
//     : isLoading
//       ? 'Loading...'
//       : stale
//         ? 'Data may be stale (newest update ' + formatTime(new Date(newest).toISOString()) + ')'
//         : visible.length + ' trains'

//   return (
//     <div style={{ height: '100%', position: 'relative' }}>
//       <div style={{ ...box, top: 10, left: '50%', transform: 'translateX(-50%)' }}>{status}</div>

//       <div style={{ ...box, top: 80, left: 10 }}>
//         <strong>Routes</strong>
//         {routes.map((r) => (
//           <label key={r} style={{ display: 'block' }}>
//             <input type='checkbox' checked={!hidden.has(r)} onChange={() => toggleRoute(r)} />{' '}
//             <span style={{ color: colorFor(r) }}>■</span> {r}
//           </label>
//         ))}
//       </div>

//       <div style={{ ...box, bottom: 24, right: 10 }}>
//         Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
//       </div>

//       <MapContainer
//         center={CALIFORNIA_CENTER}
//         zoom={6}
//         maxBoundsViscosity={1.0}
//         style={{ height: '100%', width: '100%' }}
//       >
//         <LockToCalifornia />
//         <LayersControl position='topright'>
//           <LayersControl.BaseLayer checked name='Street map'>
//             <TileLayer
//               attribution='&copy; OpenStreetMap contributors'
//               url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
//             />
//           </LayersControl.BaseLayer>
//           <LayersControl.Overlay checked name='Rail network (OpenRailwayMap)'>
//             <TileLayer
//               attribution='Data <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> and OpenStreetMap'
//               url='https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'
//               bounds={CALIFORNIA_BOUNDS}
//             />
//           </LayersControl.Overlay>
//           <LayersControl.Overlay name='Simulated freight (demo)'>
//             <LayerGroup>
//               <FreightDemo />
//             </LayerGroup>
//           </LayersControl.Overlay>
//         </LayersControl>

//         {visible.map((t) => (
//           <Marker key={t.id} position={[t.lat, t.lon]} icon={trainIcon(t)}>
//             <Popup>
//               <strong>{t.routeName}</strong>
//               <br />
//               Speed: {t.speedMph != null ? Math.round(t.speedMph) + ' mph' : 'unknown'}
//               <br />
//               Updated: {formatTime(t.lastUpdate)}
//             </Popup>
//           </Marker>
//         ))}
//       </MapContainer>
//     </div>
//   )
// }




// import { useMemo, useState } from 'react'
// import { useQuery } from '@tanstack/react-query'
// import { divIcon } from 'leaflet'
// import { LayerGroup, LayersControl, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
// import { fetchTrains } from './api/trains'
// import FreightDemo from './components/FreightDemo'
// import type { Train } from './types'

// const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf']
// const STALE_AFTER_MS = 10 * 60 * 1000

// // Rough rectangle around California: [[south, west], [north, east]]
// const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
//   [32.4, -124.6],
//   [42.1, -114.0],
// ]

// function colorFor(route: string): string {
//   let h = 0
//   for (const ch of route) h = (h * 31 + ch.charCodeAt(0)) >>> 0
//   return PALETTE[h % PALETTE.length]
// }

// function trainIcon(t: Train) {
//   const color = colorFor(t.routeName)
//   const html =
//     t.headingDeg != null
//       ? `<div style='transform: rotate(${t.headingDeg}deg); color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>▲</div>`
//       : `<div style='color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>●</div>`
//   return divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
// }

// function formatTime(iso: string): string {
//   const d = new Date(iso)
//   return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
// }

// const box = {
//   position: 'absolute',
//   zIndex: 1000,
//   background: 'white',
//   padding: '4px 8px',
//   borderRadius: 4,
//   fontSize: 12,
// } as const

// export default function App() {
//   const { data: trains = [], isLoading, error } = useQuery({
//     queryKey: ['trains'],
//     queryFn: fetchTrains,
//     refetchInterval: 5000,
//   })
//   const [hidden, setHidden] = useState<Set<string>>(new Set())

//   const routes = useMemo(() => Array.from(new Set(trains.map((t) => t.routeName))).sort(), [trains])
//   const visible = trains.filter((t) => !hidden.has(t.routeName))

//   const newest = Math.max(0, ...trains.map((t) => Date.parse(t.lastUpdate)).filter((n) => !Number.isNaN(n)))
//   const stale = newest > 0 && Date.now() - newest > STALE_AFTER_MS

//   function toggleRoute(route: string) {
//     setHidden((prev) => {
//       const next = new Set(prev)
//       if (next.has(route)) next.delete(route)
//       else next.add(route)
//       return next
//     })
//   }

//   const status = error
//     ? 'Could not load trains'
//     : isLoading
//       ? 'Loading...'
//       : stale
//         ? 'Data may be stale (newest update ' + formatTime(new Date(newest).toISOString()) + ')'
//         : visible.length + ' trains'

//   return (
//     <div style={{ height: '100%', position: 'relative' }}>
//       <div style={{ ...box, top: 10, left: '50%', transform: 'translateX(-50%)' }}>{status}</div>

//       <div style={{ ...box, top: 80, left: 10 }}>
//         <strong>Routes</strong>
//         {routes.map((r) => (
//           <label key={r} style={{ display: 'block' }}>
//             <input type='checkbox' checked={!hidden.has(r)} onChange={() => toggleRoute(r)} />{' '}
//             <span style={{ color: colorFor(r) }}>■</span> {r}
//           </label>
//         ))}
//       </div>

//       <div style={{ ...box, bottom: 24, right: 10 }}>
//         Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
//       </div>

//       <MapContainer
//         center={[37.0, -119.5]}
//         zoom={6}
//         minZoom={5}
//         maxBounds={CALIFORNIA_BOUNDS}
//         maxBoundsViscosity={1.0}
//         style={{ height: '100%', width: '100%' }}
//       >
//         <LayersControl position='topright'>
//           <LayersControl.BaseLayer checked name='Street map'>
//             <TileLayer
//               attribution='&copy; OpenStreetMap contributors'
//               url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
//             />
//           </LayersControl.BaseLayer>
//           <LayersControl.Overlay checked name='Rail network (OpenRailwayMap)'>
//             <TileLayer
//               attribution='Data <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> and OpenStreetMap'
//               url='https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'
//               bounds={CALIFORNIA_BOUNDS}
//             />
//           </LayersControl.Overlay>
//           <LayersControl.Overlay name='Simulated freight (demo)'>
//             <LayerGroup>
//               <FreightDemo />
//             </LayerGroup>
//           </LayersControl.Overlay>
//         </LayersControl>

//         {visible.map((t) => (
//           <Marker key={t.id} position={[t.lat, t.lon]} icon={trainIcon(t)}>
//             <Popup>
//               <strong>{t.routeName}</strong>
//               <br />
//               Speed: {t.speedMph != null ? Math.round(t.speedMph) + ' mph' : 'unknown'}
//               <br />
//               Updated: {formatTime(t.lastUpdate)}
//             </Popup>
//           </Marker>
//         ))}
//       </MapContainer>
//     </div>
//   )
// }
// import { useQuery } from '@tanstack/react-query'
// import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
// import { fetchTrains } from './api/trains'

// function formatTime(iso: string): string {
//   const d = new Date(iso)
//   return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
// }

// const box = {
//   position: 'absolute',
//   zIndex: 1000,
//   background: 'white',
//   padding: '4px 8px',
//   borderRadius: 4,
//   fontSize: 12,
// } as const

// export default function App() {
//   const { data: trains = [], isLoading, error } = useQuery({
//     queryKey: ['trains'],
//     queryFn: fetchTrains,
//     refetchInterval: 5000,
//   })

//   return (
//     <div style={{ height: '100%', position: 'relative' }}>
//       <div style={{ ...box, top: 10, right: 10 }}>
//         {error ? 'Could not load trains' : isLoading ? 'Loading...' : trains.length + ' trains'}
//       </div>
//       <div style={{ ...box, bottom: 24, right: 10 }}>
//         Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
//       </div>
//       <MapContainer center={[37.0, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
//         <TileLayer
//           attribution='&copy; OpenStreetMap contributors'
//           url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
//         />
//         {trains.map((t) => (
//           <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={8}>
//             <Popup>
//               <strong>{t.routeName}</strong>
//               <br />
//               Speed: {t.speedMph != null ? Math.round(t.speedMph) + ' mph' : 'unknown'}
//               <br />
//               Updated: {formatTime(t.lastUpdate)}
//             </Popup>
//           </CircleMarker>
//         ))}
//       </MapContainer>
//     </div>
//   )
// }

// // import { useQuery } from '@tanstack/react-query'
// // import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
// // import { fetchTrains } from './api/trains'

// // export default function App() {
// //   const { data: trains = [], isLoading, error } = useQuery({
// //     queryKey: ['trains'],
// //     queryFn: fetchTrains,
// //     refetchInterval: 5000,
// //   })

// //   return (
// //     <div style={{ height: '100%', position: 'relative' }}>
// //       {(isLoading || error) && (
// //         <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: 8 }}>
// //           {error ? 'Could not load trains' : 'Loading...'}
// //         </div>
// //       )}
// //       <MapContainer center={[37.0, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
// //         <TileLayer
// //           attribution='&copy; OpenStreetMap contributors'
// //           url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
// //         />
// //         {trains.map((t) => (
// //           <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={8}>
// //             <Popup>{t.routeName}</Popup>
// //           </CircleMarker>
// //         ))}
// //       </MapContainer>
// //     </div>
// //   )
// // }

// // // import { useState } from 'react'
// // // import heroImg from './assets/hero.png'
// // // import reactLogo from './assets/react.svg'
// // // import viteLogo from './assets/vite.svg'
// // // import './App.css'

// // // function App() {
// // //   const [count, setCount] = useState(0)

// // //   return (
// // //     <>
// // //       <section id="center">
// // //         <div className="hero">
// // //           <img src={heroImg} className="base" width="170" height="179" alt="" />
// // //           <img src={reactLogo} className="framework" alt="React logo" />
// // //           <img src={viteLogo} className="vite" alt="Vite logo" />
// // //         </div>
// // //         <div>
// // //           <h1>Get started</h1>
// // //           <p>
// // //             Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
// // //           </p>
// // //         </div>
// // //         <button
// // //           type="button"
// // //           className="counter"
// // //           onClick={() => setCount((count) => count + 1)}
// // //         >
// // //           Count is {count}
// // //         </button>
// // //       </section>

// // //       <div className="ticks"></div>

// // //       <section id="next-steps">
// // //         <div id="docs">
// // //           <svg className="icon" role="presentation" aria-hidden="true">
// // //             <use href="/icons.svg#documentation-icon"></use>
// // //           </svg>
// // //           <h2>Documentation</h2>
// // //           <p>Your questions, answered</p>
// // //           <ul>
// // //             <li>
// // //               <a href="https://vite.dev/" target="_blank">
// // //                 <img className="logo" src={viteLogo} alt="" />
// // //                 Explore Vite
// // //               </a>
// // //             </li>
// // //             <li>
// // //               <a href="https://react.dev/" target="_blank">
// // //                 <img className="button-icon" src={reactLogo} alt="" />
// // //                 Learn more
// // //               </a>
// // //             </li>
// // //           </ul>
// // //         </div>
// // //         <div id="social">
// // //           <svg className="icon" role="presentation" aria-hidden="true">
// // //             <use href="/icons.svg#social-icon"></use>
// // //           </svg>
// // //           <h2>Connect with us</h2>
// // //           <p>Join the Vite community</p>
// // //           <ul>
// // //             <li>
// // //               <a href="https://github.com/vitejs/vite" target="_blank">
// // //                 <svg
// // //                   className="button-icon"
// // //                   role="presentation"
// // //                   aria-hidden="true"
// // //                 >
// // //                   <use href="/icons.svg#github-icon"></use>
// // //                 </svg>
// // //                 GitHub
// // //               </a>
// // //             </li>
// // //             <li>
// // //               <a href="https://chat.vite.dev/" target="_blank">
// // //                 <svg
// // //                   className="button-icon"
// // //                   role="presentation"
// // //                   aria-hidden="true"
// // //                 >
// // //                   <use href="/icons.svg#discord-icon"></use>
// // //                 </svg>
// // //                 Discord
// // //               </a>
// // //             </li>
// // //             <li>
// // //               <a href="https://x.com/vite_js" target="_blank">
// // //                 <svg
// // //                   className="button-icon"
// // //                   role="presentation"
// // //                   aria-hidden="true"
// // //                 >
// // //                   <use href="/icons.svg#x-icon"></use>
// // //                 </svg>
// // //                 X.com
// // //               </a>
// // //             </li>
// // //             <li>
// // //               <a href="https://bsky.app/profile/vite.dev" target="_blank">
// // //                 <svg
// // //                   className="button-icon"
// // //                   role="presentation"
// // //                   aria-hidden="true"
// // //                 >
// // //                   <use href="/icons.svg#bluesky-icon"></use>
// // //                 </svg>
// // //                 Bluesky
// // //               </a>
// // //             </li>
// // //           </ul>
// // //         </div>
// // //       </section>

// // //       <div className="ticks"></div>
// // //       <section id="spacer"></section>
// // //     </>
// // //   )
// // // }

// // // export default App
