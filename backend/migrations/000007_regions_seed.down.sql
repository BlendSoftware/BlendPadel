DELETE FROM regions WHERE name IN ('Gran Mendoza', 'Zona Este', 'Valle de Uco', 'Sur');

DROP INDEX IF EXISTS idx_users_region_elo;
