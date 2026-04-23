-- Seed: Real padel venues in Mendoza province
-- Cleans existing data and inserts 34 curated venues

DELETE FROM venues;

-- RIVADAVIA (Zona Este)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Go Padel Rivadavia', 'Godoy Cruz 184, Rivadavia, Mendoza',
 ST_MakePoint(-68.466, -33.184)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Rivadavia Tenis Club', 'Rivadavia, Mendoza',
 ST_MakePoint(-68.472, -33.185)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Mundo Padel Rivadavia', 'Belgrano Norte 61, Rivadavia, Mendoza',
 ST_MakePoint(-68.473, -33.182)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- SAN MARTIN (Zona Este)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Full Padel Indoor San Martin', 'Leandro Alem 1031, San Martin, Mendoza',
 ST_MakePoint(-68.471, -33.077)::geography, 3,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Full Padel Outdoor San Martin', 'Calle de la Armonia y Lateral Norte Acceso Este, San Martin, Mendoza',
 ST_MakePoint(-68.452, -33.094)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Complejo Padel Ruta 7', 'Lateral Norte Ruta 7 km 1003, San Martin, Mendoza',
 ST_MakePoint(-68.443, -33.091)::geography, 4,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- JUNIN (Zona Este)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Junin Padel', 'Carril Barriales, Junin, Mendoza',
 ST_MakePoint(-68.485, -33.095)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Black Padel Club', 'Junin, Mendoza',
 ST_MakePoint(-68.482, -33.092)::geography, 2,
 '7a519f52-4f20-41e1-8dbb-d56dfe3d1bd7', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- GUAYMALLEN (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Arena Padel Mendoza', 'Pedro del Castillo 3050, Guaymallen, Mendoza',
 ST_MakePoint(-68.792, -32.921)::geography, 3,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('UMaza Padel Club', '25 de Mayo 160, Guaymallen, Mendoza',
 ST_MakePoint(-68.812, -32.894)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Alto Las Canas Padel', '25 de Mayo 2425, Guaymallen, Mendoza',
 ST_MakePoint(-68.797, -32.919)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Cofam Padel y Futbol', 'Antonelli 189, Rodeo de la Cruz, Guaymallen, Mendoza',
 ST_MakePoint(-68.739, -32.917)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Boss Mendoza', 'Av. Bandera de los Andes 7713, Guaymallen, Mendoza',
 ST_MakePoint(-68.732, -32.890)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- GODOY CRUZ (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Keops', 'Benjamin Matienzo, Godoy Cruz, Mendoza',
 ST_MakePoint(-68.842, -32.939)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Cordillera Padel', '9 de Julio 310, Godoy Cruz, Mendoza',
 ST_MakePoint(-68.846, -32.914)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('De Volea Padel y Futbol', 'Isuani 1800, Godoy Cruz, Mendoza',
 ST_MakePoint(-68.852, -32.947)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Tolentino', 'Godoy Cruz, Mendoza',
 ST_MakePoint(-68.844, -32.930)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- MENDOZA CIUDAD (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Punto de Oro', 'Altos Hornos Zapla 1662, Mendoza',
 ST_MakePoint(-68.848, -32.890)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Bandera Center / Green Club', 'Av. Bandera de los Andes 5965, Villa Nueva, Mendoza',
 ST_MakePoint(-68.780, -32.892)::geography, 3,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Fox Padel', 'Mendoza Capital',
 ST_MakePoint(-68.850, -32.890)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Pacifico Padel', 'Mendoza Capital',
 ST_MakePoint(-68.842, -32.896)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- LUJAN DE CUYO (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Indoor Mendoza Padel Center', 'Lateral Este Acceso Sur 7557, Carrodilla, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.867, -32.934)::geography, 4,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Lujan Padel Club', 'Lamadrid 220, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.869, -32.981)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Club Social Lujan', 'Santa Maria de Oro 790, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.872, -32.980)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('H Club Padel & Lifestyle', 'Vieytes y Bulnes, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.858, -32.962)::geography, 3,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Hache Club', 'Terrada 7551, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.866, -32.972)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- CHACRAS DE CORIA (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Chacras Indoors', 'Besares 1214, Chacras de Coria, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.873, -32.967)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Boedo Camp Sports Complex', 'Chacras de Coria, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.870, -32.966)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('El Ombu Padel', 'Chacras de Coria, Lujan de Cuyo, Mendoza',
 ST_MakePoint(-68.868, -32.968)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

-- MAIPU (Gran Mendoza)
INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('El Paseo Padel Club', 'J. A. Maza 766, Maipu, Mendoza',
 ST_MakePoint(-68.792, -32.985)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Padel Cumbres', 'Andrade 271, Coquimbito, Maipu, Mendoza',
 ST_MakePoint(-68.744, -32.956)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Maipu Tennis Club', 'Paganotto 195, Maipu, Mendoza',
 ST_MakePoint(-68.783, -32.983)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Buho Blanco Padel', 'Maipu, Mendoza',
 ST_MakePoint(-68.788, -32.983)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);

INSERT INTO venues (name, address, location, court_count, region_id, added_by, verified) VALUES
('Kondor Padel Club', 'Adolfo Villanueva 548, Maipu, Mendoza',
 ST_MakePoint(-68.784, -32.974)::geography, 2,
 '8c7c486f-83f4-46d7-90ea-60f29e2897a9', '041dd549-c902-44d3-a953-23121aea5c32', true);
