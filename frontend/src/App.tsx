import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import MapView, { AttributionControl, Layer, Marker, Popup, Source } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl'
import { fetchTrains } from './api/trains'
import FreightDemo from './components/FreightDemo'

type Theme = 'light' | 'dark'

const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY as string
const STALE_AFTER_MS = 10 * 60 * 1000

// MapLibre lists longitude FIRST (Leaflet listed latitude first): [[west, south], [east, north]]
const CALIFORNIA_BOUNDS: [[number, number], [number, number]] = [
  [-124.6, 32.4],
  [-114.0, 42.1],
]
const RAIL_BOUNDS: [number, number, number, number] = [-124.6, 32.4, -114.0, 42.1]

// Keep your own colors here.
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

function colorFor(route: string): string {
  return ROUTE_COLORS[route] ?? FALLBACK_COLOR
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'unknown' : d.toLocaleTimeString()
}

// ---------- Map style: colors and sizes of the map's own labels ----------

const STYLE_NAMES: Record<Theme, string> = {
  light: 'voyager-gl-style',
  dark: 'dark-matter-gl-style',
}

// Change these to taste: label text color and the outline drawn around it.
const LABELS: Record<Theme, { text: string; halo: string }> = {
  light: { text: '#1f2933', halo: '#ffffff' },
  dark: { text: '#f1f3f4', halo: '#15171a' },
}
const LABEL_SIZE_SCALE = 1.1
const LABEL_HALO_WIDTH = 1.5

// Optional: recolor other map layers by their layer id. An empty object leaves the style alone.
// The dark ids below are my guess, so check them if nothing changes.
const PAINT_OVERRIDES: Record<Theme, Record<string, Record<string, string>>> = {
  light: {},
  dark: {
    background: { 'background-color': '#22262b' },
    water: { 'fill-color': '#2d3640' },
  },
}

interface StyleLayer {
  id: string
  type: string
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

function scaleSize(size: unknown, k: number): unknown {
  if (typeof size === 'number') return size * k
  if (size && typeof size === 'object' && 'stops' in size) {
    const s = size as { stops: [number, number][] }
    return { ...s, stops: s.stops.map(([zoom, value]) => [zoom, value * k]) }
  }
  return size
}

async function loadStyle(theme: Theme): Promise<StyleSpecification> {
  const url = 'https://basemaps.cartocdn.com/gl/' + STYLE_NAMES[theme] + '/style.json?key=' + CARTO_KEY
  const res = await fetch(url)
  if (!res.ok) throw new Error('Style request failed: ' + res.status)
  const style = (await res.json()) as { layers: StyleLayer[] }
  const label = LABELS[theme]

  for (const layer of style.layers) {
    const override = PAINT_OVERRIDES[theme][layer.id]
    if (override) layer.paint = { ...layer.paint, ...override }

    if (layer.type !== 'symbol' || !layer.layout?.['text-field']) continue
    layer.paint = {
      ...layer.paint,
      'text-color': label.text,
      'text-halo-color': label.halo,
      'text-halo-width': LABEL_HALO_WIDTH,
      'text-halo-blur': 0.5,
    }
    const size = layer.layout['text-size']
    if (size !== undefined) {
      layer.layout = { ...layer.layout, 'text-size': scaleSize(size, LABEL_SIZE_SCALE) }
    }
  }
  return style as unknown as StyleSpecification
}

// CARTO wants the key on every tile, font and sprite request, not just the style file.
function addCartoKey(url: string) {
  if (url.includes('cartocdn.com') && !url.includes('key=')) {
    return { url: url + (url.includes('?') ? '&' : '?') + 'key=' + CARTO_KEY }
  }
  return { url }
}

// Zoom out only as far as California fits the window; pan only within that view.
function lockToCalifornia(map: MaplibreMap) {
  map.setMaxBounds(null)
  map.setMinZoom(0)
  const cam = map.cameraForBounds(CALIFORNIA_BOUNDS, { padding: 24 })
  if (!cam || cam.zoom === undefined) return
  map.setMinZoom(cam.zoom)
  map.jumpTo({ center: cam.center, zoom: cam.zoom })
  map.setMaxBounds(map.getBounds())
}

// ---------- UI ----------

function ToggleRow(props: { label: string; on: boolean; color: string; onClick: () => void }) {
  return (
    <button
      className={props.on ? 'route-row' : 'route-row off'}
      role='checkbox'
      aria-checked={props.on}
      onClick={props.onClick}
    >
      <span
        className='swatch'
        style={{ borderColor: props.color, background: props.on ? props.color : 'transparent' }}
      />
      <span className='label'>{props.label}</span>
    </button>
  )
}

export default function App() {
  const { data: trains = [], isLoading, error } = useQuery({
    queryKey: ['trains'],
    queryFn: fetchTrains,
    refetchInterval: 5000,
  })
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showRail, setShowRail] = useState(true)
  const [showFreight, setShowFreight] = useState(false)
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 641px)').matches)
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const mapRef = useRef<MapRef>(null)
  const theme: Theme = dark ? 'dark' : 'light'

  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  const styleQuery = useQuery({
    queryKey: ['basemap-style', theme],
    queryFn: () => loadStyle(theme),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  })

  const routes = useMemo(() => Array.from(new Set(trains.map((t) => t.routeName))).sort(), [trains])
  const visible = trains.filter((t) => !hidden.has(t.routeName))
  const selected = visible.find((t) => t.id === selectedId)

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

  const status = styleQuery.error
    ? 'Map style failed to load'
    : error
      ? 'Could not load trains'
      : isLoading
        ? 'Loading...'
        : stale
          ? 'Data may be stale (newest update ' + formatTime(new Date(newest).toISOString()) + ')'
          : visible.length + ' trains'
  const statusKind = styleQuery.error || error ? 'error' : isLoading ? 'idle' : stale ? 'warn' : 'ok'

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
          <div className='titlebar-actions'>
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
            <button
              className='collapse'
              aria-label={open ? 'Collapse panel' : 'Expand panel'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span className='chev' aria-hidden='true'>⌃</span>
            </button>
          </div>
        </div>

        {open && (
          <>
            <div className='divider' />
            <div className='section-label'>Routes</div>
            {routes.map((r) => (
              <ToggleRow key={r} label={r} color={colorFor(r)} on={!hidden.has(r)} onClick={() => toggleRoute(r)} />
            ))}

            <div className='divider' />
            <div className='section-label'>Map layers</div>
            <ToggleRow label='Rail network' color='#f08c2e' on={showRail} onClick={() => setShowRail((v) => !v)} />
            <ToggleRow
              label='Simulated freight (demo)'
              color='#777777'
              on={showFreight}
              onClick={() => setShowFreight((v) => !v)}
            />
            <a className='key-link' href='https://www.openrailwaymap.org/?style=standard' target='_blank' rel='noreferrer'>
              Rail map key (openrailwaymap.org)
            </a>
          </>
        )}
      </div>

      <div className='br-stack'>
        <div className='zoom'>
          <button aria-label='Zoom in' onClick={() => mapRef.current?.zoomIn()}>+</button>
          <div className='sep' />
          <button aria-label='Zoom out' onClick={() => mapRef.current?.zoomOut()}>−</button>
        </div>
        <div className='credit'>
          Train data: <a href='https://amtraker.com' target='_blank' rel='noreferrer'>Amtraker</a> (ODC-By)
        </div>
      </div>

      {styleQuery.data && (
        <MapView
          //key={theme}
          ref={mapRef}
          mapStyle={styleQuery.data}
          initialViewState={{ bounds: CALIFORNIA_BOUNDS }}
          attributionControl={false}
          transformRequest={addCartoKey}
          onLoad={(e) => {
            lockToCalifornia(e.target)
            e.target.on('resize', () => lockToCalifornia(e.target))
          }}
          onClick={() => setSelectedId(null)}
          style={{ width: '100%', height: '100%' }}
        >
          <AttributionControl compact={false} position='bottom-right' />

          {showRail && (
            <Source
              id='orm-rail-source'
              type='raster'
              tiles={['https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png']}
              tileSize={256}
              bounds={RAIL_BOUNDS}
              attribution='Data <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
            >
              <Layer id='orm-rail-layer' type='raster' paint={{ 'raster-opacity': 0.8 }} />
            </Source>
          )}

          {showFreight && <FreightDemo />}

          {visible.map((t) => (
            <Marker
              key={t.id}
              longitude={t.lon}
              latitude={t.lat}
              anchor='center'
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setSelectedId(t.id)
              }}
            >
              <div
                className='train'
                style={{
                  color: colorFor(t.routeName),
                  transform: t.headingDeg != null ? 'rotate(' + t.headingDeg + 'deg)' : undefined,
                }}
              >
                {t.headingDeg != null ? '▲' : '●'}
              </div>
            </Marker>
          ))}

          {selected && (
            <Popup
              longitude={selected.lon}
              latitude={selected.lat}
              anchor='bottom'
              offset={14}
              closeOnClick={false}
              onClose={() => setSelectedId(null)}
            >
              <strong>{selected.routeName}</strong>
              <br />
              Speed: {selected.speedMph != null ? Math.round(selected.speedMph) + ' mph' : 'unknown'}
              <br />
              Updated: {formatTime(selected.lastUpdate)}
            </Popup>
          )}
        </MapView>
      )}
    </div>
  )
}