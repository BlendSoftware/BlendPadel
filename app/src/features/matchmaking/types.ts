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
  user_id?: string
  player_id?: string
  player?: FlarePlayer
  creator_name?: string
  scheduled_at: string
  latitude?: number | null
  longitude?: number | null
  lat?: number | null
  lng?: number | null
  message?: string
  elo_min?: number
  elo_max?: number
  match_type?: MatchType
  status: 'active' | 'responded' | 'expired' | 'cancelled'
  created_at: string
}

export interface CreateFlareDTO {
  scheduled_at: string
  latitude: number | null
  longitude: number | null
  message: string
  match_type?: MatchType
}

// ─── Match lifecycle ───────────────────────────────────────────────────────────

export type MatchStatus =
  | 'scheduled'
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
  scheduled_at: string
  latitude: number | null
  longitude: number | null
  result: MatchResult | null
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
}

export interface PlayerSearchResult {
  id: string
  name: string
  avatar_url?: string
  elo: number
}
