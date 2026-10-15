import { useEffect, useMemo, useState } from 'react'
import { divIcon, type Map as LeafletMap } from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { LayerGroup, LayersControl, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { fetchTrains } from './api/trains'
import FreightDemo from './components/FreightDemo'
import type { Train } from './types'

// One fixed color per route, so two routes never share a color.
// Routes not listed here show in gray; add a line when a new route appears.
const ROUTE_COLORS: Record<string, string> = {
  'California Zephyr': '#264653',
  'Capitol Corridor': '#2A9D8F',
  'Coast Starlight': '#E9C46A',
  'Pacific Surfliner': '#F4A261',
  'San Joaquins': '#E76F51',
  'Southwest Chief': '#cc3d2bff',
  'Sunset Limited': '#643120ff',
}
const FALLBACK_COLOR = '#7f7f7f'
const STALE_AFTER_MS = 10 * 60 * 1000

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY as string
const carto = (style: string) =>
  'https://basemaps.cartocdn.com/rastertiles/' + style + '/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY
// const DARK_MODE_BG = '#202124'
// const DARK_MODE_TEXT = '#dddddd'
// const LIGHT_MODE_BG = '#ffff'
// const LIGHT_MODE_TEXT = '#262628ff'

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
  return ROUTE_COLORS[route] ?? FALLBACK_COLOR
}

function trainIcon(t: Train) {
  const color = colorFor(t.routeName)
  const html =
    t.headingDeg != null
      ? `<div style='transform: rotate(${t.headingDeg - 90}deg); color: ${color}; font-size: 22px; line-height: 22px; -webkit-text-stroke: 1px white; text-shadow: 0 0 2px white;'>➤</div>`
      : `<div style='color: ${color}; font-size: 22px; line-height: 22px; text-shadow: 0 0 2px white;'>●</div>`
  return divIcon({ html, className: '', iconSize: [22, 22], iconAnchor: [11, 11] })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
}
// fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif',

export default function App() {
  const { data: trains = [], isLoading, error } = useQuery({
    queryKey: ['trains'],
    queryFn: fetchTrains,
    refetchInterval: 5000,
  })
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [map, setMap] = useState<LeafletMap | null>(null)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

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
  const statusKind = error ? 'error' : isLoading ? 'idle' : stale ? 'warn' : 'ok'

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <div className='panel'>
        <div className='titlebar'>
          <div>
            <div className='title'>California Rail Tracker</div>
            <div className='status'>
              <span className={'dot ' + statusKind} />
              {status}
            </div>
          </div>
          <button
            className='switch'
            role='switch'
            aria-checked={dark}
            aria-label='Dark mode'
            onClick={() => setDark((d) => !d)}
          >
            <span className='thumb' />
            <span className='icon sun' aria-hidden='true'>𖤓</span>
            <span className='icon moon' aria-hidden='true'>☾</span>
          </button>
        </div>

        <div className='divider' />
        <div className='section-label'>Routes</div>
        {routes.map((r) => {
          const on = !hidden.has(r)
          return (
            <button
              key={r}
              className={on ? 'route-row' : 'route-row off'}
              role='checkbox'
              aria-checked={on}
              onClick={() => toggleRoute(r)}
            >
              <span
                className='swatch'
                style={{ borderColor: colorFor(r), background: on ? colorFor(r) : 'transparent' }}
              />
              <span className='label'>{r}</span>
            </button>
          )
        })}

        <div className='divider' />
        <a className='key-link' href='https://www.openrailwaymap.org/?style=standard' target='_blank' rel='noreferrer'>
          Rail map key (openrailwaymap.org)
        </a>
      </div>

      <div className='br-stack'>
        <div className='zoom'>
          <button aria-label='Zoom in' onClick={() => map?.zoomIn()}>+</button>
          <div className='sep' />
          <button aria-label='Zoom out' onClick={() => map?.zoomOut()}>−</button>
        </div>
        <div className='credit'>
          Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
        </div>
      </div>

      <MapContainer
        ref={setMap}
        zoomControl={false}
        center={CALIFORNIA_CENTER}
        zoom={6}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
      >
        <LockToCalifornia />
        <LayersControl position='topright'>
          <LayersControl.BaseLayer checked name='Street map'>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={carto(dark ? 'dark_all' : 'voyager')}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name='Rail network (OpenRailwayMap)'>
            <TileLayer
              attribution='Data <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
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