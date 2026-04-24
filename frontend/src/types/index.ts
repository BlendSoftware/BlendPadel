export interface User {
  id: string
  email: string
  name: string
  last_name?: string
  avatar_url?: string
  gender: string
  elo: number
  trust_score: number
  role: string
  status: string
  onboarding_completed: boolean
  validated_match_count: number
  elo_frozen: boolean
  calibration_matches_remaining: number
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
  expires_in: number
}

// RFC 7807 Problem Details — matches backend error format
export interface ApiError {
  type: string
  title: string
  status: number
  detail: string
  errors?: Array<{ field: string; message: string }>
}

export interface SetResult {
  team_a_games: number
  team_b_games: number
}

export interface Match {
  id: string
  status: 'pending_result' | 'awaiting_confirmation' | 'sealed' | 'disputed' | 'cancelled'
  scheduled_at: string
  captain_a_id: string
  captain_b_id: string
  avg_elo: number
  match_type: 'male' | 'female' | 'mixed'
  venue_id?: string
  sealed_by?: string
  team_a: string[]
  team_b: string[]
  winner_team?: 'A' | 'B'
  total_games_a: number
  total_games_b: number
  game_diff: number
  sets: SetResult[]
  created_at: string
}

export interface Flare {
  id: string
  player_id: string
  creator_name: string
  lat: number
  lng: number
  distance_meters: number
  scheduled_at: string
  elo_min: number
  elo_max: number
  min_players: number
  max_players: number
  match_type: 'male' | 'female' | 'mixed'
  venue_id?: string
  respondent_count: number
  status: 'active' | 'matched' | 'expired' | 'cancelled'
  expires_at: string
  match_id?: string
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

// Shape returned by GET /players/me
export interface PlayerProfile {
  id: string
  name: string
  last_name?: string
  email: string
  avatar_url?: string
  gender: string
  elo: number
  trust_score: number
  role: string
  status: string
  validated_match_count: number
  onboarding_completed: boolean
  elo_frozen: boolean
  calibration_matches_remaining: number
  created_at: string
}

// Shape returned by GET /players/{id} when caller != {id}
// Banned players return 404 for other users.
export interface PublicPlayerProfile {
  id: string
  name: string
  gender: string
  elo: number
  trust_label: 'Excelente' | 'Bueno' | 'Bajo'
  validated_match_count: number
  region_id?: string
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

// MatchHistoryEntry mirrors the MatchResponse shape from GET /players/{id}/matches
export type MatchHistoryEntry = Match

export interface EloHistoryEntry {
  id: string
  match_id: string
  elo_before: number
  elo_after: number
  delta: number
  opponent_name: string
  opponent_id: string
  created_at: string
}

// ─── Rankings feature types ───────────────────────────────────────────────────

export interface Region {
  id: string
  name: string
}

export interface RankingsResponse {
  region_id: string
  region_name: string
  entries: RankingEntry[]
  total: number
}

export interface MatchProjection {
  current_elo: number
  projected_elo: number
  delta: number
  opponent_elo: number
  expected_score: number
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
  content: Record<string, unknown>
  region_id?: string
  created_at: string
}

// ─── Admin types ─────────────────────────────────────────────────────────────

export interface KpisResponse {
  total_players: number
  active_players: number
  banned_players: number
  total_matches: number
  completed_matches: number
  pending_disputes: number
  avg_elo: number
  total_moderators: number
}

export interface ModeratorResponse {
  id: string
  email: string
  name: string
  last_name?: string
  role: 'moderator'
  status: string
  region_id?: string
  created_at: string
}

export interface AuditLogEntry {
  id: string
  admin_id: string
  action: string
  target_user_id?: string
  details?: unknown
  created_at: string
}

export interface DisputeResponse {
  id: string
  match_id: string
  raised_by: string
  reason: string
  status: 'pending' | 'resolved'
  resolved_by?: string
  penalized_player_id?: string
  resolved_at?: string
  created_at: string
}

export interface ReportResponse {
  id: string
  match_id: string
  reporter_id: string
  reason: string
  status: 'pending' | 'reviewed' | 'dismissed'
  region_id?: string
  created_at: string
}

export interface BanRequest {
  type: 'soft' | 'hard'
  reason?: string
}

export interface EloAdjustRequest {
  delta: number
  reason?: string
}

export interface ResolveDisputeRequest {
  action: 'seal' | 'dismiss'
  result_override?: { sets: unknown[] }
  penalize_player_id?: string
}

export interface CreateModeratorRequest {
  user_id?: string
  email?: string
  password?: string
  name?: string
  last_name?: string
  region_id: string
}

export interface PlayerSearchResult {
  id: string
  name: string
  elo: number
  avatar_url?: string
  gender: string
}
