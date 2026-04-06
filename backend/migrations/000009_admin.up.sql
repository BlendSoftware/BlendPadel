CREATE TABLE admin_audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id       UUID NOT NULL REFERENCES users(id),
    action         TEXT NOT NULL,
    target_user_id UUID REFERENCES users(id),
    details        JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_admin_id    ON admin_audit_log (admin_id);
CREATE INDEX idx_admin_audit_log_created_at  ON admin_audit_log (created_at DESC);
