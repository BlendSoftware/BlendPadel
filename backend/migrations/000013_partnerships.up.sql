CREATE TABLE player_partnerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id),
    partner_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'dissolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_partnership CHECK (requester_id != partner_id),
    CONSTRAINT unique_partnership UNIQUE (requester_id, partner_id)
);

CREATE INDEX idx_partnerships_requester ON player_partnerships(requester_id, status);
CREATE INDEX idx_partnerships_partner ON player_partnerships(partner_id, status);
