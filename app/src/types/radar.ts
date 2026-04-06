export interface RadarMatch {
  id: string
  title: string
  location_name: string
  lat: number
  lng: number
  scheduled_at: string
  elo_avg: number
  players_confirmed: number
  players_needed: number
  max_players: number
  distance_km: number
}

export interface RadarAlert {
  id: string
  match_id: string
  title: string
  location_name: string
  lat: number
  lng: number
  scheduled_at: string
  distance_km: number
  minutes_until: number
}

export interface ELORange {
  min: number
  max: number
}

export type RadiusOption = 5 | 10 | 15 | 25

export interface UserLocation {
  lat: number
  lng: number
}
