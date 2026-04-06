export interface User {
  id: string
  email: string
  name: string
  last_name?: string
  avatar_url?: string
  gender: string
  elo: number
  trust_score: number
  status: string
  onboarding_completed: boolean
  validated_match_count: number
  region_id?: string
  created_at: string
}

export interface OnboardingAnswers {
  gender: 'male' | 'female' | 'other'
  frequency: 'nunca' | 'rara_vez' | '1_2_sem' | '3_mas_sem'
  tournaments: 'nunca' | 'amateur' | 'federado'
  paddle_type: 'iniciacion' | 'intermedia' | 'avanzada'
  self_assessment: 'principiante' | 'intermedio' | 'avanzado' | 'competitivo'
  years_playing: number
}

export interface OnboardingResult {
  elo: number
  onboarding_completed: boolean
  calibration_matches_remaining: number
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface ApiError {
  detail: string
  status_code?: number
}

export interface Match {
  id: number
  title: string
  location: string
  scheduled_at: string
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled'
  skill_level: 'beginner' | 'intermediate' | 'advanced'
  max_players: number
  current_players: number
  created_by: number
  created_at: string
}

export interface Flare {
  id: string
  user_id: string
  latitude: number
  longitude: number
  message: string
  skill_level: string
  expires_at: string
  created_at: string
}

export interface RankingEntry {
  rank: number
  player_id: string
  name: string
  elo: number
  validated_match_count: number
  trust_score?: number
}

// ─── Profile feature types ────────────────────────────────────────────────────

export interface PlayerProfile {
  id: string
  name: string
  last_name?: string
  email: string
  avatar_url?: string
  gender: string
  elo: number
  trust_score: number
  status: string
  validated_match_count: number
  onboarding_completed: boolean
  calibration_matches_remaining?: number
  latitude?: number
  longitude?: number
}

export interface PublicPlayerProfile {
  id: string
  name: string
  last_name?: string
  avatar_url?: string
  gender: string
  elo: number
  trust_score: number
  status: string
  validated_match_count: number
}

export interface PlayerPreferences {
  radar_radius_km: number
  elo_min_delta: number
  elo_max_delta: number
}

export interface UpdateProfileData {
  // BUG 14 FIX: Added name field so edit form can update first name
  name?: string
  last_name?: string
  latitude?: number
  longitude?: number
}

export interface MatchHistoryEntry {
  id: number
  played_at: string
  result: string
  team1: string[]
  team2: string[]
  elo_delta: number
  won: boolean
}

export interface EloHistoryEntry {
  id: string
  player_id: string
  match_id: string
  elo_before: number
  elo_after: number
  delta: number
  k_factor: number
  type: string
  created_at: string
}

// ─── Rankings feature types ───────────────────────────────────────────────────

export interface Region {
  id: string
  name: string
}

export interface RankingsResponse {
  entries: RankingEntry[]
  my_position?: RankingEntry | null
}

export interface MatchProjection {
  win_delta: number
  loss_delta: number
}

// ─── Venue types ────────────────────────────────────────────────────────────

export interface Venue {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  court_count: number
  phone?: string
  hours?: Record<string, string>
  region_id?: string
  added_by: string
  verified: boolean
  distance_meters?: number
  created_at: string
}

// ─── Partnership types ──────────────────────────────────────────────────────

export interface Partnership {
  id: string
  requester_id: string
  partner_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'dissolved'
  partner_name?: string
  partner_elo?: number
  created_at: string
}

export interface PairStats {
  total_matches: number
  wins: number
  win_rate: number
  current_streak: number
}

export interface BestPartner {
  partner_id: string
  partner_name: string
  partner_elo: number
  total_matches: number
  wins: number
  win_rate_pct: number
}

// ─── Feed types ─────────────────────────────────────────────────────────────

export interface FeedItem {
  id: string
  player_id: string
  player_name: string
  event_type: 'win_streak' | 'match_milestone'
  content: Record<string, any>
  region_id?: string
  created_at: string
}
