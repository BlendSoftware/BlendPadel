package match

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo is the PostgreSQL implementation of Repository.
type postgresRepo struct {
	q    *db.Queries
	pool interface{ BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error) }
}

// NewPostgresRepo creates a new Repository backed by the given sqlc Queries and pool.
func NewPostgresRepo(q *db.Queries, pool interface{ BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error) }) Repository {
	return &postgresRepo{q: q, pool: pool}
}

func (r *postgresRepo) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.pool.BeginTx(ctx, pgx.TxOptions{})
}

func (r *postgresRepo) WithTx(tx pgx.Tx) Repository {
	return &postgresRepo{q: db.New(tx), pool: r.pool}
}

func (r *postgresRepo) CreateMatch(ctx context.Context, in CreateMatchInput) (*MatchFull, error) {
	scheduledAt, _ := in.ScheduledAtTime.(time.Time)
	venueID := pgtype.UUID{}
	if in.VenueID != nil {
		venueID = uuidToPg(*in.VenueID)
	}
	row, err := r.q.CreateMatch(ctx, db.CreateMatchParams{
		ScheduledAt:   pgtype.Timestamptz{Time: scheduledAt, Valid: true},
		StMakepoint:   in.Latitude,
		StMakepoint_2: in.Longitude,
		CaptainAID:    uuidToPg(in.CaptainAID),
		CaptainBID:    uuidToPg(in.CaptainBID),
		AvgElo:        pgtype.Int4{Int32: int32(in.AvgELO), Valid: true},
		MatchType:     in.MatchType,
		VenueID:       venueID,
	})
	if err != nil {
		return nil, err
	}

	return &MatchFull{
		ID:          pgToUUID(row.ID),
		Status:      row.Status,
		ScheduledAt: row.ScheduledAt.Time,
		CaptainAID:  pgToUUID(row.CaptainAID),
		CaptainBID:  pgToUUID(row.CaptainBID),
		AvgELO:      int(row.AvgElo.Int32),
		MatchType:   row.MatchType,
		VenueID:     pgToOptionalUUID(row.VenueID),
		SealedBy:    row.SealedBy.String,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}, nil
}

func (r *postgresRepo) GetMatch(ctx context.Context, matchID uuid.UUID) (*MatchFull, error) {
	row, err := r.q.GetMatchByID(ctx, uuidToPg(matchID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMatchNotFound
		}
		return nil, err
	}

	return &MatchFull{
		ID:          pgToUUID(row.ID),
		Status:      row.Status,
		ScheduledAt: row.ScheduledAt.Time,
		CaptainAID:  pgToUUID(row.CaptainAID),
		CaptainBID:  pgToUUID(row.CaptainBID),
		AvgELO:      int(row.AvgElo.Int32),
		MatchType:   row.MatchType,
		VenueID:     pgToOptionalUUID(row.VenueID),
		SealedBy:    row.SealedBy.String,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}, nil
}

func (r *postgresRepo) GetMatchWithPlayers(ctx context.Context, matchID uuid.UUID) (*MatchFull, error) {
	row, err := r.q.GetMatchByIDForUpdate(ctx, uuidToPg(matchID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMatchNotFound
		}
		return nil, err
	}

	m := &MatchFull{
		ID:          pgToUUID(row.ID),
		Status:      row.Status,
		ScheduledAt: row.ScheduledAt.Time,
		CaptainAID:  pgToUUID(row.CaptainAID),
		CaptainBID:  pgToUUID(row.CaptainBID),
		AvgELO:      int(row.AvgElo.Int32),
		MatchType:   row.MatchType,
		VenueID:     pgToOptionalUUID(row.VenueID),
		SealedBy:    row.SealedBy.String,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}

	// Load players.
	players, err := r.q.GetMatchPlayers(ctx, uuidToPg(matchID))
	if err != nil {
		return nil, err
	}
	for _, p := range players {
		if p.Team == "A" {
			m.TeamA = append(m.TeamA, pgToUUID(p.PlayerID))
		} else {
			m.TeamB = append(m.TeamB, pgToUUID(p.PlayerID))
		}
	}

	// Load result (optional).
	result, err := r.q.GetMatchResult(ctx, uuidToPg(matchID))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err == nil {
		var sets []SetScore
		if parseErr := json.Unmarshal(result.Sets, &sets); parseErr != nil {
			return nil, parseErr
		}
		m.Result = &MatchResultData{
			MatchID:     pgToUUID(result.MatchID),
			Sets:        sets,
			WinnerTeam:  result.WinnerTeam,
			TotalGamesA: int(result.TotalGamesA),
			TotalGamesB: int(result.TotalGamesB),
			GameDiff:    int(result.GameDiff),
			SubmittedBy: pgToUUID(result.SubmittedBy),
			SubmittedAt: result.SubmittedAt.Time,
		}
	}

	return m, nil
}

func (r *postgresRepo) InsertMatchPlayers(ctx context.Context, matchID uuid.UUID, teamA, teamB []uuid.UUID) error {
	for _, pid := range teamA {
		if err := r.q.InsertMatchPlayer(ctx, db.InsertMatchPlayerParams{
			MatchID:  uuidToPg(matchID),
			PlayerID: uuidToPg(pid),
			Team:     "A",
		}); err != nil {
			return err
		}
	}
	for _, pid := range teamB {
		if err := r.q.InsertMatchPlayer(ctx, db.InsertMatchPlayerParams{
			MatchID:  uuidToPg(matchID),
			PlayerID: uuidToPg(pid),
			Team:     "B",
		}); err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresRepo) InsertResult(ctx context.Context, matchID uuid.UUID, in MatchResultInput) error {
	setsJSON, err := json.Marshal(in.Sets)
	if err != nil {
		return err
	}
	_, err = r.q.InsertMatchResult(ctx, db.InsertMatchResultParams{
		MatchID:     uuidToPg(matchID),
		Sets:        setsJSON,
		WinnerTeam:  in.WinnerTeam,
		TotalGamesA: int32(in.TotalGamesA),
		TotalGamesB: int32(in.TotalGamesB),
		GameDiff:    int32(in.GameDiff),
		SubmittedBy: uuidToPg(in.SubmittedBy),
	})
	return err
}

func (r *postgresRepo) UpdateStatus(ctx context.Context, matchID uuid.UUID, status, sealedBy string) error {
	return r.q.UpdateMatchStatus(ctx, db.UpdateMatchStatusParams{
		ID:       uuidToPg(matchID),
		Status:   status,
		SealedBy: pgtype.Text{String: sealedBy, Valid: sealedBy != ""},
	})
}

func (r *postgresRepo) UpdateStatusCAS(ctx context.Context, matchID uuid.UUID, expectedStatus, newStatus, sealedBy string) error {
	_, err := r.q.UpdateMatchStatusCAS(ctx, db.UpdateMatchStatusCASParams{
		ID:       uuidToPg(matchID),
		Status:   expectedStatus,
		Status_2: newStatus,
		SealedBy: pgtype.Text{String: sealedBy, Valid: sealedBy != ""},
	})
	if err != nil {
		return fmt.Errorf("%w: match is no longer in status %s", ErrInvalidTransition, expectedStatus)
	}
	return nil
}

func (r *postgresRepo) UpdateResultSets(ctx context.Context, matchID uuid.UUID, sets []SetScore, winnerTeam string, totalA, totalB, gameDiff int) error {
	setsJSON, err := json.Marshal(sets)
	if err != nil {
		return err
	}
	return r.q.UpdateMatchResult(ctx, db.UpdateMatchResultParams{
		MatchID:     uuidToPg(matchID),
		Sets:        setsJSON,
		WinnerTeam:  winnerTeam,
		TotalGamesA: int32(totalA),
		TotalGamesB: int32(totalB),
		GameDiff:    int32(gameDiff),
	})
}

func (r *postgresRepo) GetPendingSealMatches(ctx context.Context) ([]MatchFull, error) {
	rows, err := r.q.GetMatchesAwaitingConfirmation(ctx)
	if err != nil {
		return nil, err
	}

	matches := make([]MatchFull, 0, len(rows))
	for _, row := range rows {
		m := MatchFull{
			ID:          pgToUUID(row.ID),
			Status:      row.Status,
			ScheduledAt: row.ScheduledAt.Time,
			CaptainAID:  pgToUUID(row.CaptainAID),
			CaptainBID:  pgToUUID(row.CaptainBID),
			AvgELO:      int(row.AvgElo.Int32),
			MatchType:   row.MatchType,
			VenueID:     pgToOptionalUUID(row.VenueID),
			SealedBy:    row.SealedBy.String,
			CreatedAt:   row.CreatedAt.Time,
			UpdatedAt:   row.UpdatedAt.Time,
		}

		// Load players.
		players, pErr := r.q.GetMatchPlayers(ctx, uuidToPg(m.ID))
		if pErr != nil {
			return nil, pErr
		}
		for _, p := range players {
			if p.Team == "A" {
				m.TeamA = append(m.TeamA, pgToUUID(p.PlayerID))
			} else {
				m.TeamB = append(m.TeamB, pgToUUID(p.PlayerID))
			}
		}

		// Load result.
		result, rErr := r.q.GetMatchResult(ctx, uuidToPg(m.ID))
		if rErr != nil && !errors.Is(rErr, pgx.ErrNoRows) {
			return nil, rErr
		}
		if rErr == nil {
			var sets []SetScore
			if parseErr := json.Unmarshal(result.Sets, &sets); parseErr != nil {
				return nil, parseErr
			}
			m.Result = &MatchResultData{
				MatchID:     pgToUUID(result.MatchID),
				Sets:        sets,
				WinnerTeam:  result.WinnerTeam,
				TotalGamesA: int(result.TotalGamesA),
				TotalGamesB: int(result.TotalGamesB),
				GameDiff:    int(result.GameDiff),
				SubmittedBy: pgToUUID(result.SubmittedBy),
				SubmittedAt: result.SubmittedAt.Time,
			}
		}

		matches = append(matches, m)
	}

	return matches, nil
}

func (r *postgresRepo) GetMatchHistory(ctx context.Context, playerID uuid.UUID, limit, offset int) ([]MatchHistoryItem, error) {
	rows, err := r.q.GetMatchesByPlayer(ctx, db.GetMatchesByPlayerParams{
		PlayerID: uuidToPg(playerID),
		Limit:    int32(limit),
		Offset:   int32(offset),
	})
	if err != nil {
		return nil, err
	}

	items := make([]MatchHistoryItem, 0, len(rows))
	for _, row := range rows {
		item := MatchHistoryItem{
			ID:          pgToUUID(row.ID),
			Status:      row.Status,
			ScheduledAt: row.ScheduledAt.Time,
			CaptainAID:  pgToUUID(row.CaptainAID),
			CaptainBID:  pgToUUID(row.CaptainBID),
			AvgELO:      int(row.AvgElo.Int32),
			MatchType:   row.MatchType,
			VenueID:     pgToOptionalUUID(row.VenueID),
			SealedBy:    row.SealedBy.String,
			CreatedAt:   row.CreatedAt.Time,
		}

		// Load players.
		players, pErr := r.q.GetMatchPlayers(ctx, uuidToPg(item.ID))
		if pErr != nil {
			return nil, pErr
		}
		for _, p := range players {
			if p.Team == "A" {
				item.TeamA = append(item.TeamA, pgToUUID(p.PlayerID))
			} else {
				item.TeamB = append(item.TeamB, pgToUUID(p.PlayerID))
			}
		}

		// Load result.
		result, rErr := r.q.GetMatchResult(ctx, uuidToPg(item.ID))
		if rErr == nil {
			item.WinnerTeam = result.WinnerTeam
			item.TotalGamesA = int(result.TotalGamesA)
			item.TotalGamesB = int(result.TotalGamesB)
			item.GameDiff = int(result.GameDiff)
		}

		items = append(items, item)
	}

	return items, nil
}

func (r *postgresRepo) GetActiveMatches(ctx context.Context, playerID uuid.UUID) ([]MatchHistoryItem, error) {
	rows, err := r.q.GetActiveMatchesByPlayer(ctx, uuidToPg(playerID))
	if err != nil {
		return nil, err
	}

	items := make([]MatchHistoryItem, 0, len(rows))
	for _, row := range rows {
		item := MatchHistoryItem{
			ID:          pgToUUID(row.ID),
			Status:      row.Status,
			ScheduledAt: row.ScheduledAt.Time,
			CaptainAID:  pgToUUID(row.CaptainAID),
			CaptainBID:  pgToUUID(row.CaptainBID),
			AvgELO:      int(row.AvgElo.Int32),
			MatchType:   row.MatchType,
			VenueID:     pgToOptionalUUID(row.VenueID),
			SealedBy:    row.SealedBy.String,
			CreatedAt:   row.CreatedAt.Time,
		}

		// Load players.
		players, pErr := r.q.GetMatchPlayers(ctx, uuidToPg(item.ID))
		if pErr != nil {
			return nil, pErr
		}
		for _, p := range players {
			if p.Team == "A" {
				item.TeamA = append(item.TeamA, pgToUUID(p.PlayerID))
			} else {
				item.TeamB = append(item.TeamB, pgToUUID(p.PlayerID))
			}
		}

		// Load result if available.
		result, rErr := r.q.GetMatchResult(ctx, uuidToPg(item.ID))
		if rErr == nil {
			item.WinnerTeam = result.WinnerTeam
			item.TotalGamesA = int(result.TotalGamesA)
			item.TotalGamesB = int(result.TotalGamesB)
			item.GameDiff = int(result.GameDiff)
		}

		items = append(items, item)
	}

	return items, nil
}

func (r *postgresRepo) CreateDispute(ctx context.Context, matchID, raisedBy uuid.UUID, reason string) (*Dispute, error) {
	row, err := r.q.CreateDispute(ctx, db.CreateDisputeParams{
		MatchID:  uuidToPg(matchID),
		RaisedBy: uuidToPg(raisedBy),
		Reason:   reason,
	})
	if err != nil {
		return nil, err
	}
	return mapDBDispute(row), nil
}

func (r *postgresRepo) GetDispute(ctx context.Context, disputeID uuid.UUID) (*Dispute, error) {
	row, err := r.q.GetDisputeByID(ctx, uuidToPg(disputeID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDisputeNotFound
		}
		return nil, err
	}
	return mapDBDispute(row), nil
}

func (r *postgresRepo) GetDisputeByMatch(ctx context.Context, matchID uuid.UUID) (*Dispute, error) {
	row, err := r.q.GetDisputeByMatch(ctx, uuidToPg(matchID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDisputeNotFound
		}
		return nil, err
	}
	return mapDBDispute(row), nil
}

func (r *postgresRepo) GetDisputesByStatus(ctx context.Context, status string) ([]Dispute, error) {
	rows, err := r.q.GetDisputesByStatus(ctx, status)
	if err != nil {
		return nil, err
	}
	disputes := make([]Dispute, 0, len(rows))
	for _, row := range rows {
		disputes = append(disputes, *mapDBDispute(row))
	}
	return disputes, nil
}

func (r *postgresRepo) ResolveDispute(ctx context.Context, disputeID, resolvedBy uuid.UUID, result []byte, penalizedID *uuid.UUID) error {
	penalized := pgtype.UUID{}
	if penalizedID != nil {
		penalized = uuidToPg(*penalizedID)
	}
	return r.q.ResolveDispute(ctx, db.ResolveDisputeParams{
		ID:                uuidToPg(disputeID),
		ResolvedBy:        uuidToPg(resolvedBy),
		ResolutionResult:  result,
		PenalizedPlayerID: penalized,
	})
}

func (r *postgresRepo) GetPlayerProfile(ctx context.Context, playerID uuid.UUID) (*PlayerBasic, error) {
	row, err := r.q.GetUserByID(ctx, uuidToPg(playerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("player not found")
		}
		return nil, err
	}
	return &PlayerBasic{
		ID:                  pgToUUID(row.ID),
		Status:              row.Status,
		ValidatedMatchCount: int(row.ValidatedMatchCount),
	}, nil
}

func (r *postgresRepo) UpdatePlayerStatus(ctx context.Context, playerID uuid.UUID, status string) error {
	return r.q.UpdatePlayerStatus(ctx, db.UpdatePlayerStatusParams{
		ID:     uuidToPg(playerID),
		Status: status,
	})
}

func (r *postgresRepo) UnfreezePlayerELO(ctx context.Context, playerID uuid.UUID) error {
	return r.q.UnfreezePlayerELO(ctx, uuidToPg(playerID))
}

func (r *postgresRepo) CreateMatchTx(ctx context.Context, tx pgx.Tx, in CreateMatchInput, teamA, teamB []uuid.UUID) (*MatchFull, error) {
	scheduledAt, _ := in.ScheduledAtTime.(time.Time)
	venueID := pgtype.UUID{}
	if in.VenueID != nil {
		venueID = uuidToPg(*in.VenueID)
	}
	tq := db.New(tx)
	row, err := tq.CreateMatch(ctx, db.CreateMatchParams{
		ScheduledAt:   pgtype.Timestamptz{Time: scheduledAt, Valid: true},
		StMakepoint:   in.Latitude,
		StMakepoint_2: in.Longitude,
		CaptainAID:    uuidToPg(in.CaptainAID),
		CaptainBID:    uuidToPg(in.CaptainBID),
		AvgElo:        pgtype.Int4{Int32: int32(in.AvgELO), Valid: true},
		MatchType:     in.MatchType,
		VenueID:       venueID,
	})
	if err != nil {
		return nil, err
	}

	matchID := pgToUUID(row.ID)
	for _, pid := range teamA {
		if err := tq.InsertMatchPlayer(ctx, db.InsertMatchPlayerParams{
			MatchID:  uuidToPg(matchID),
			PlayerID: uuidToPg(pid),
			Team:     "A",
		}); err != nil {
			return nil, err
		}
	}
	for _, pid := range teamB {
		if err := tq.InsertMatchPlayer(ctx, db.InsertMatchPlayerParams{
			MatchID:  uuidToPg(matchID),
			PlayerID: uuidToPg(pid),
			Team:     "B",
		}); err != nil {
			return nil, err
		}
	}

	return &MatchFull{
		ID:          matchID,
		Status:      row.Status,
		ScheduledAt: row.ScheduledAt.Time,
		CaptainAID:  pgToUUID(row.CaptainAID),
		CaptainBID:  pgToUUID(row.CaptainBID),
		AvgELO:      int(row.AvgElo.Int32),
		MatchType:   row.MatchType,
		VenueID:     pgToOptionalUUID(row.VenueID),
		SealedBy:    row.SealedBy.String,
		TeamA:       teamA,
		TeamB:       teamB,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}, nil
}

func (r *postgresRepo) GetPlayerGenders(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	pgIDs := make([]pgtype.UUID, len(playerIDs))
	for i, id := range playerIDs {
		pgIDs[i] = uuidToPg(id)
	}
	rows, err := r.q.GetPlayerGenders(ctx, pgIDs)
	if err != nil {
		return nil, err
	}
	result := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		result[pgToUUID(row.ID)] = row.Gender
	}
	return result, nil
}

func (r *postgresRepo) GetPlayerELOs(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	pgIDs := make([]pgtype.UUID, len(playerIDs))
	for i, id := range playerIDs {
		pgIDs[i] = uuidToPg(id)
	}
	rows, err := r.q.GetPlayerELOs(ctx, pgIDs)
	if err != nil {
		return nil, err
	}
	result := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		result[pgToUUID(row.ID)] = int(row.Elo)
	}
	return result, nil
}

func (r *postgresRepo) GetPlayerStatuses(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	pgIDs := make([]pgtype.UUID, len(playerIDs))
	for i, id := range playerIDs {
		pgIDs[i] = uuidToPg(id)
	}
	rows, err := r.q.GetPlayerStatuses(ctx, pgIDs)
	if err != nil {
		return nil, err
	}
	result := make(map[uuid.UUID]string, len(rows))
	for _, row := range rows {
		result[pgToUUID(row.ID)] = row.Status
	}
	return result, nil
}

// --- helpers ---

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

func pgToOptionalUUID(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	id := uuid.UUID(p.Bytes)
	return &id
}

func mapDBDispute(d db.Dispute) *Dispute {
	dispute := &Dispute{
		ID:               pgToUUID(d.ID),
		MatchID:          pgToUUID(d.MatchID),
		RaisedBy:         pgToUUID(d.RaisedBy),
		Reason:           d.Reason,
		Status:           d.Status,
		ResolutionResult: d.ResolutionResult,
		CreatedAt:        d.CreatedAt.Time,
	}
	if d.ResolvedBy.Valid {
		id := pgToUUID(d.ResolvedBy)
		dispute.ResolvedBy = &id
	}
	if d.PenalizedPlayerID.Valid {
		id := pgToUUID(d.PenalizedPlayerID)
		dispute.PenalizedPlayerID = &id
	}
	if d.ResolvedAt.Valid {
		t := d.ResolvedAt.Time
		dispute.ResolvedAt = &t
	}
	return dispute
}
