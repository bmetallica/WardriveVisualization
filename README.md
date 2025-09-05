# Wardrive Data Visualization

Eine Webanwendung zur Visualisierung von Wardrive-Daten des ESP32Marauder auf interaktiven Karten. 
Die Anwendung ermöglicht das Hochladen von Wardrive-Logdateien, Speicherung in einer PostgreSQL/PostGIS-Datenbank und interaktive Visualisierung der WLAN-Access-Points auf einer Karte.

![Screenshot]([https://github.com/bmetallica/WardriveVisualization/blob/main/utils/wd.png)

## Funktionen

- 📁 Upload von Wardrive-Logdateien im WigleWifi-Format
- 🗄️ Automatische Speicherung in PostgreSQL/PostGIS Datenbank
- 🗂️ Verwaltung mehrerer Datensätze
- 🗺️ Interaktive Kartenvisualisierung mit OpenStreetMap
- 📍 Farbcodierung der Access Points nach Authentifizierungstyp:
  - 🟠 Orange: WPA2_PSK
  - 🔴 Rot: WPA2_WPA3_PSK
  - 🟢 Grün: OPEN
  - ⚫ Grau: Andere
- 🔍 Zoom-Funktionalität bis zu Level 22
- 🏷️ SSID-Beschriftungen der Access Points
- 🎨 Modernes dunkles Design mit Hacker-Optik
- 📱 Responsive Design für verschiedene Bildschirmgrößen

## Voraussetzungen

- Debian-basiertes System (Debian, Ubuntu, etc.)
- Node.js 18.x oder höher
- PostgreSQL 13.x oder höher
- PostGIS 3.x oder höher
- NPM oder Yarn

## Installation

# 1. Datenbank einrichten
```sql
# Als PostgreSQL Superuser anmelden
sudo -u postgres psql

-- Datenbank erstellen
CREATE DATABASE wardrive;

-- Auf die Datenbank verbinden
\c wardrive

-- PostGIS Extension aktivieren
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabelle für hochgeladene Dateien erstellen
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    table_name VARCHAR(255) NOT NULL UNIQUE
);

-- Funktion zum Erstellen von Wardrive-Tabellen
CREATE OR REPLACE FUNCTION create_wardrive_table(table_name TEXT) RETURNS void AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            id SERIAL PRIMARY KEY,
            mac_address VARCHAR(17),
            ssid VARCHAR(255),
            auth_mode VARCHAR(50),
            first_seen TIMESTAMP,
            channel INTEGER,
            rssi INTEGER,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            altitude DOUBLE PRECISION,
            accuracy DOUBLE PRECISION,
            type VARCHAR(10),
            geom GEOMETRY(Point, 4326)
        )
    ', table_name);
END;
$$ LANGUAGE plpgsql;

-- Datenbankbenutzer für die Anwendung erstellen (optional)
CREATE USER wardrive_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE wardrive TO wardrive_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wardrive_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wardrive_user;

-- Verlassen
\q
```

# 2. Projekt einrichten
``` bash
# Projekt klonen oder herunterladen
git clone https://github.com/bmetallica/WardriveVisualization.git
cd wardrive-visualization

# Abhängigkeiten installieren
npm install
```

# 3. Datenbankverbindung konfigurieren (server.js anpassen)
``` javascript

// PostgreSQL Verbindung
const pool = new Pool({
  user: 'DATENBANKBENUTZER',
  host: 'localhost',
  database: 'wardrive',
  password: 'DATENBANKPASSWORT',
  port: 5432,
});

```

# 4. starten
``` bash
node server.js
```

Die Webanwendung ist danach unter http://localhost:8002 erreichbar.

