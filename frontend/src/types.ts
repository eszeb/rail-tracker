export interface Train {
  id: string
  provider: string
  agency: string
  routeName: string
  lat: number
  lon: number
  headingDeg?: number
  speedMph?: number
  lastUpdate: string
  simulated: boolean
}