// Backend: GET /radar/matches and GET /radar/alerts return this shape
export interface RadarMatch {
  id: string
  captain_id: string
  captain_name: string
  lat: number
  lng: number
  distance_meters: number
  avg_elo: number
  scheduled_at: string
  joined_count: number
}

// RadarAlert is the same shape as RadarMatch (same backend schema)
export type RadarAlert = RadarMatch

export interface ELORange {
  min: number
  max: number
}

export type RadiusOption = 5 | 10 | 15 | 25

export interface UserLocation {
  lat: number
  lng: number
}

export interface PadelCourt {
  id: number
  name: string
  lat: number
  lng: number
}
