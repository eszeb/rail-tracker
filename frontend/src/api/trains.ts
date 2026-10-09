import type { Train } from '../types'

export async function fetchTrains(): Promise<Train[]> {
  const res = await fetch('/api/trains')
  if (!res.ok) throw new Error('Request failed: ' + res.status)
  return res.json()
}