// ─── Match type ───────────────────────────────────────────────────────────────

export type MatchType = 'male' | 'female' | 'mixed'

// ─── Matchmaking / Flares ─────────────────────────────────────────────────────

export interface FlarePlayer {
  id: string
  name: string
  avatar_url?: string
  elo: number
  trust_score: number
}

export interface Flare {
  id: string
  player_id: string
  creator_name?: string
  player?: FlarePlayer
  lat: number
  lng: number
  distance_meters?: number
  scheduled_at: string
  elo_min?: number
  elo_max?: number
  min_players?: number
  max_players?: number
  match_type?: MatchType
  venue_id?: string
  respondent_count?: number
  status: 'active' | 'matched' | 'expired'
  expires_at?: string
  match_id?: string
  created_at: string
}

export interface CreateFlareDTO {
  lat: number
  lng: number
  scheduled_at: string
  elo_min?: number
  elo_max?: number
  min_players?: number
  max_players?: number
  match_type?: MatchType
  venue_id?: string
}

// ─── Match lifecycle ───────────────────────────────────────────────────────────

export type MatchStatus =
  | 'pending_result'
  | 'awaiting_confirmation'
  | 'sealed'
  | 'disputed'
  | 'cancelled'

export interface MatchPlayer {
  id: string
  name: string
  avatar_url?: string
  elo: number
  elo_delta?: number | null
}

export interface SetScore {
  team_a_games: number
  team_b_games: number
}

export interface MatchResult {
  sets: SetScore[]
  submitted_by: string
  submitted_at: string
}

export interface MatchDetail {
  id: string
  status: MatchStatus
  match_type?: MatchType
  team_a: MatchPlayer[]
  team_b: MatchPlayer[]
  captain_a_id: string
  captain_b_id: string
  avg_elo?: number
  venue_id?: string
  scheduled_at: string
  latitude: number | null
  longitude: number | null
  result: MatchResult | null
  winner_team?: 'A' | 'B' | null
  total_games_a?: number
  total_games_b?: number
  game_diff?: number
  sets?: SetScore[]
  dispute_reason: string | null
  created_at: string
}

export interface CreateMatchDTO {
  team_a: string[]
  team_b: string[]
  scheduled_at: string
  latitude: number | null
  longitude: number | null
  match_type?: MatchType
  venue_id?: string
}

export interface PlayerSearchResult {
  id: string
  name: string
  avatar_url?: string
  elo: number
  gender?: 'male' | 'female' | 'other'
}
