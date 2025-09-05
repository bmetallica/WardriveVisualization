const express = require('express');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');
const fs = require('fs');

const app = express();
const port = 8002;

// PostgreSQL Verbindung
const pool = new Pool({
  user: 'DATENBANKBENUTZER',
  host: 'localhost',
  database: 'wardrive',
  password: 'DATENBANKPASSWORT',
  port: 5432,
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Multer Konfiguration für Dateiuploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) === '.log') {
      cb(null, true);
    } else {
      cb(new Error('Nur .log-Dateien sind erlaubt'));
    }
  }
});

// Routen
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM uploaded_files ORDER BY upload_time DESC');
    res.render('index', { files: result.rows });
  } catch (error) {
    console.error('Fehler beim Abrufen der Dateien:', error);
    res.status(500).send('Interner Serverfehler');
  }
});

app.post('/upload', upload.single('wardriveFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Keine Datei hochgeladen');
  }

  const filename = req.file.originalname;
  const tableName = 'wardrive_' + Date.now();
  
  try {
    // Dateiinhalt lesen und verarbeiten
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.split('\n').slice(2); // Header überspringen
    
    // Tabelle erstellen
    await pool.query('SELECT create_wardrive_table($1)', [tableName]);
    
    // Daten einfügen
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      const [
        mac, ssid, authMode, firstSeen, channel, rssi, 
        lat, lon, alt, acc, type
      ] = line.split(',');
      
      if (!mac || mac === 'MAC') continue; // Headerzeile überspringen
      
      const query = `
        INSERT INTO ${tableName} 
        (mac_address, ssid, auth_mode, first_seen, channel, rssi, 
         latitude, longitude, altitude, accuracy, type, geom)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, ST_SetSRID(ST_MakePoint($8, $7), 4326))
      `;
      
      await pool.query(query, [
        mac, ssid, authMode, firstSeen, parseInt(channel), parseInt(rssi),
        parseFloat(lat), parseFloat(lon), parseFloat(alt), parseFloat(acc), type
      ]);
    }
    
    // Metadaten speichern
    await pool.query(
      'INSERT INTO uploaded_files (filename, table_name) VALUES ($1, $2)',
      [filename, tableName]
    );
    
    // Temporäre Datei löschen
    fs.unlinkSync(req.file.path);
    
    res.redirect('/');
  } catch (error) {
    console.error('Fehler beim Verarbeiten der Datei:', error);
    res.status(500).send('Fehler beim Verarbeiten der Datei');
  }
});

app.get('/data/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    
    // Sicherheitsprüfung: Tabellenname sollte nur alphanumerische Zeichen und Unterstriche enthalten
    if (!/^wardrive_\d+$/.test(tableName)) {
        return res.status(400).json({ error: 'Ungültiger Tabellenname' });
    }
    
    try {
        // Prüfen ob Tabelle existiert
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [tableName]);
        
        if (!tableExists.rows[0].exists) {
            return res.status(404).json({ error: 'Tabelle nicht gefunden' });
        }
        
        const result = await pool.query(`
            SELECT mac_address, ssid, auth_mode, first_seen, channel, rssi, 
                   latitude, longitude, altitude, accuracy, type,
                   ST_AsGeoJSON(geom) as geometry
            FROM ${tableName}
            WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            ORDER BY first_seen
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Daten' });
    }
});


app.get('/stats/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    
    // Sicherheitsprüfung
    if (!/^wardrive_\d+$/.test(tableName)) {
        return res.status(400).json({ error: 'Ungültiger Tabellenname' });
    }
    
    try {
        // Prüfen ob Tabelle existiert
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `, [tableName]);
        
        if (!tableExists.rows[0].exists) {
            return res.status(404).json({ error: 'Tabelle nicht gefunden' });
        }
        
        // Statistiken zu doppelten Koordinaten
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_points,
                COUNT(DISTINCT CONCAT(latitude::text, longitude::text)) as unique_locations,
                COUNT(*) - COUNT(DISTINCT CONCAT(latitude::text, longitude::text)) as duplicate_locations,
                MAX(point_count) as max_points_per_location
            FROM (
                SELECT 
                    latitude, 
                    longitude, 
                    COUNT(*) as point_count
                FROM ${tableName}
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY latitude, longitude
            ) location_counts;
        `);
        
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Fehler beim Abrufen der Statistiken:', error);
        res.status(500).json({ error: 'Fehler beim Abrufen der Statistiken' });
    }
});

app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
