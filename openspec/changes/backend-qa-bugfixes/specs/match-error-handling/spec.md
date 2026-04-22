## ADDED Requirements

### Requirement: Match handler errors use errors.Is for wrapped error matching
The match handler's mapError function SHALL use `errors.Is()` for all sentinel error comparisons to correctly match errors wrapped with `fmt.Errorf("...: %w", err)`.

#### Scenario: Wrapped ErrForbidden returns 403
- **WHEN** match service returns `fmt.Errorf("only captain_b can confirm: %w", ErrForbidden)`
- **THEN** handler responds with HTTP 403 and RFC 7807 problem detail

#### Scenario: Wrapped ErrMatchNotFound returns 404
- **WHEN** match service returns `fmt.Errorf("fetch match: %w", ErrMatchNotFound)`
- **THEN** handler responds with HTTP 404 and RFC 7807 problem detail

#### Scenario: Wrapped ErrInvalidTransition returns 409
- **WHEN** match service returns `fmt.Errorf("%w: match is in status sealed", ErrInvalidTransition)`
- **THEN** handler responds with HTTP 409 and RFC 7807 problem detail

#### Scenario: GenderMismatch with errors.Is returns 422
- **WHEN** match service returns a wrapped ErrGenderMismatch error
- **THEN** handler responds with HTTP 422 and error_code GENDER_MISMATCH

#### Scenario: Unknown errors still return 500
- **WHEN** match service returns an error not matching any sentinel
- **THEN** handler responds with HTTP 500 and RFC 7807 problem detail
