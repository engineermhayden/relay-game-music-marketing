CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS greetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(60) NOT NULL,
  message varchar(240) NOT NULL,
  city varchar(80) NOT NULL,
  location geography(Point, 4326) NOT NULL,
  seeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS greetings_location_idx ON greetings USING gist(location);
CREATE INDEX IF NOT EXISTS greetings_created_idx ON greetings(created_at DESC);
INSERT INTO greetings (name,message,city,location,seeded) VALUES
('Ada','Hello, world. A little curiosity goes a long way.','London',ST_SetSRID(ST_MakePoint(-0.1276,51.5072),4326),true),
('Yuki','こんにちは、世界！ Greetings from the other side of the planet.','Tokyo',ST_SetSRID(ST_MakePoint(139.6917,35.6895),4326),true),
('Maya','Hello from the foothills. Keep exploring.','Denver',ST_SetSRID(ST_MakePoint(-104.9903,39.7392),4326),true),
('Luca','Ciao mondo! A universe of possibilities.','Florence',ST_SetSRID(ST_MakePoint(11.2558,43.7696),4326),true),
('Amara','A warm hello from Cape Town.','Cape Town',ST_SetSRID(ST_MakePoint(18.4241,-33.9249),4326),true),
('Sofia','Olá, mundo! Building something beautiful together.','São Paulo',ST_SetSRID(ST_MakePoint(-46.6333,-23.5505),4326),true),
('Oliver','Hello from down under.','Sydney',ST_SetSRID(ST_MakePoint(151.2093,-33.8688),4326),true),
('Alex','Hello, world. Let’s make it a little more interesting.','San Francisco',ST_SetSRID(ST_MakePoint(-122.4194,37.7749),4326),true);
