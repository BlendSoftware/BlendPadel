-- Seed 4 Mendoza regions with approximate WKT POLYGON boundaries (SRID 4326 / WGS84).
-- Coordinate order: longitude latitude (as required by PostGIS ST_GeomFromText).

INSERT INTO regions (name, boundary) VALUES
(
    'Gran Mendoza',
    ST_GeomFromText(
        'POLYGON((-68.7 -33.1, -68.3 -33.1, -68.3 -32.7, -68.7 -32.7, -68.7 -33.1))',
        4326
    )
),
(
    'Zona Este',
    ST_GeomFromText(
        'POLYGON((-68.3 -33.5, -67.8 -33.5, -67.8 -33.1, -68.3 -33.1, -68.3 -33.5))',
        4326
    )
),
(
    'Valle de Uco',
    ST_GeomFromText(
        'POLYGON((-69.5 -34.0, -69.0 -34.0, -69.0 -33.5, -69.5 -33.5, -69.5 -34.0))',
        4326
    )
),
(
    'Sur',
    ST_GeomFromText(
        'POLYGON((-68.5 -35.0, -67.5 -35.0, -67.5 -34.0, -68.5 -34.0, -68.5 -35.0))',
        4326
    )
);

CREATE INDEX IF NOT EXISTS idx_users_region_elo ON users (region_id, status, elo DESC);
