package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJWTManager_GenerateAndValidate(t *testing.T) {
	mgr := NewJWTManager("test-secret-key-1234567890", time.Hour)
	userID := uuid.New()
	regionID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "player", &regionID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := mgr.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID.String(), claims.Subject)
	assert.Equal(t, "player", claims.Role)
	require.NotNil(t, claims.RegionID)
	assert.Equal(t, regionID, *claims.RegionID)
}

func TestJWTManager_ValidateExpiredToken(t *testing.T) {
	mgr := NewJWTManager("test-secret-key-1234567890", -time.Second) // already expired
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "player", nil)
	require.NoError(t, err)

	_, err = mgr.ValidateToken(token)
	assert.ErrorIs(t, err, ErrTokenExpired)
}

func TestJWTManager_ValidateInvalidSignature(t *testing.T) {
	mgr1 := NewJWTManager("secret-one", time.Hour)
	mgr2 := NewJWTManager("secret-two", time.Hour)
	userID := uuid.New()

	token, err := mgr1.GenerateAccessToken(userID, "player", nil)
	require.NoError(t, err)

	_, err = mgr2.ValidateToken(token)
	assert.Error(t, err)
}

func TestJWTManager_ClaimsContainRoleAndRegionID(t *testing.T) {
	mgr := NewJWTManager("my-secret", time.Hour)
	userID := uuid.New()
	regionID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "moderator", &regionID)
	require.NoError(t, err)

	claims, err := mgr.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, "moderator", claims.Role)
	assert.Equal(t, regionID, *claims.RegionID)
}

func TestJWTManager_NilRegionID(t *testing.T) {
	mgr := NewJWTManager("my-secret", time.Hour)
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "superadmin", nil)
	require.NoError(t, err)

	claims, err := mgr.ValidateToken(token)
	require.NoError(t, err)
	assert.Nil(t, claims.RegionID)
}
