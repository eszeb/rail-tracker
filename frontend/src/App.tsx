import { useQuery } from '@tanstack/react-query'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { fetchTrains } from './api/trains'

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

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ ...box, top: 10, right: 10 }}>
        {error ? 'Could not load trains' : isLoading ? 'Loading...' : trains.length + ' trains'}
      </div>
      <div style={{ ...box, bottom: 24, right: 10 }}>
        Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
      </div>
      <MapContainer center={[37.0, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        {trains.map((t) => (
          <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={8}>
            <Popup>
              <strong>{t.routeName}</strong>
              <br />
              Speed: {t.speedMph != null ? Math.round(t.speedMph) + ' mph' : 'unknown'}
              <br />
              Updated: {formatTime(t.lastUpdate)}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

// import { useQuery } from '@tanstack/react-query'
// import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
// import { fetchTrains } from './api/trains'

// export default function App() {
//   const { data: trains = [], isLoading, error } = useQuery({
//     queryKey: ['trains'],
//     queryFn: fetchTrains,
//     refetchInterval: 5000,
//   })

//   return (
//     <div style={{ height: '100%', position: 'relative' }}>
//       {(isLoading || error) && (
//         <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: 8 }}>
//           {error ? 'Could not load trains' : 'Loading...'}
//         </div>
//       )}
//       <MapContainer center={[37.0, -119.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
//         <TileLayer
//           attribution='&copy; OpenStreetMap contributors'
//           url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
//         />
//         {trains.map((t) => (
//           <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={8}>
//             <Popup>{t.routeName}</Popup>
//           </CircleMarker>
//         ))}
//       </MapContainer>
//     </div>
//   )
// }

// // import { useState } from 'react'
// // import heroImg from './assets/hero.png'
// // import reactLogo from './assets/react.svg'
// // import viteLogo from './assets/vite.svg'
// // import './App.css'

// // function App() {
// //   const [count, setCount] = useState(0)

// //   return (
// //     <>
// //       <section id="center">
// //         <div className="hero">
// //           <img src={heroImg} className="base" width="170" height="179" alt="" />
// //           <img src={reactLogo} className="framework" alt="React logo" />
// //           <img src={viteLogo} className="vite" alt="Vite logo" />
// //         </div>
// //         <div>
// //           <h1>Get started</h1>
// //           <p>
// //             Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
// //           </p>
// //         </div>
// //         <button
// //           type="button"
// //           className="counter"
// //           onClick={() => setCount((count) => count + 1)}
// //         >
// //           Count is {count}
// //         </button>
// //       </section>

// //       <div className="ticks"></div>

// //       <section id="next-steps">
// //         <div id="docs">
// //           <svg className="icon" role="presentation" aria-hidden="true">
// //             <use href="/icons.svg#documentation-icon"></use>
// //           </svg>
// //           <h2>Documentation</h2>
// //           <p>Your questions, answered</p>
// //           <ul>
// //             <li>
// //               <a href="https://vite.dev/" target="_blank">
// //                 <img className="logo" src={viteLogo} alt="" />
// //                 Explore Vite
// //               </a>
// //             </li>
// //             <li>
// //               <a href="https://react.dev/" target="_blank">
// //                 <img className="button-icon" src={reactLogo} alt="" />
// //                 Learn more
// //               </a>
// //             </li>
// //           </ul>
// //         </div>
// //         <div id="social">
// //           <svg className="icon" role="presentation" aria-hidden="true">
// //             <use href="/icons.svg#social-icon"></use>
// //           </svg>
// //           <h2>Connect with us</h2>
// //           <p>Join the Vite community</p>
// //           <ul>
// //             <li>
// //               <a href="https://github.com/vitejs/vite" target="_blank">
// //                 <svg
// //                   className="button-icon"
// //                   role="presentation"
// //                   aria-hidden="true"
// //                 >
// //                   <use href="/icons.svg#github-icon"></use>
// //                 </svg>
// //                 GitHub
// //               </a>
// //             </li>
// //             <li>
// //               <a href="https://chat.vite.dev/" target="_blank">
// //                 <svg
// //                   className="button-icon"
// //                   role="presentation"
// //                   aria-hidden="true"
// //                 >
// //                   <use href="/icons.svg#discord-icon"></use>
// //                 </svg>
// //                 Discord
// //               </a>
// //             </li>
// //             <li>
// //               <a href="https://x.com/vite_js" target="_blank">
// //                 <svg
// //                   className="button-icon"
// //                   role="presentation"
// //                   aria-hidden="true"
// //                 >
// //                   <use href="/icons.svg#x-icon"></use>
// //                 </svg>
// //                 X.com
// //               </a>
// //             </li>
// //             <li>
// //               <a href="https://bsky.app/profile/vite.dev" target="_blank">
// //                 <svg
// //                   className="button-icon"
// //                   role="presentation"
// //                   aria-hidden="true"
// //                 >
// //                   <use href="/icons.svg#bluesky-icon"></use>
// //                 </svg>
// //                 Bluesky
// //               </a>
// //             </li>
// //           </ul>
// //         </div>
// //       </section>

// //       <div className="ticks"></div>
// //       <section id="spacer"></section>
// //     </>
// //   )
// // }

// // export default App
