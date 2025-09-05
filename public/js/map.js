document.addEventListener('DOMContentLoaded', function() {
    // Karte initialisieren
    const map = L.map('map').setView([50.537, 7.465], 13);
    
    // Zuerst den Standard-Layer hinzufügen, bevor andere Controls
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
        minZoom: 1
    }).addTo(map);
    
    // Verschiedene Kartenlayer mit hohen Zoom-Stufen
    const baseLayers = {
        'OpenStreetMap Standard': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22,
            minZoom: 1
        }),
        'OpenStreetMap DE': L.tileLayer('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22,
            minZoom: 1
        }),
        'Satellit (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 22,
            minZoom: 1
        }),
        'OpenTopoMap (Topografie)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            maxZoom: 17, // OpenTopoMap hat max Zoom 17
            minZoom: 1
        }),
        'CyclOSM (Fahrradkarte)': L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style: &copy; <a href="https://www.cyclosm.org/">CyclOSM</a>',
            maxZoom: 22,
            minZoom: 1
        }),
        'CartoDB Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 22,
            minZoom: 1,
            subdomains: 'abcd'
        })
    };

    // Marker-Gruppe für spätere Anpassung der Kartenansicht
    const markerGroup = L.layerGroup().addTo(map);
    
    // Layer für SSID-Beschriftungen (standardmäßig deaktiviert)
    const labelGroup = L.layerGroup();
    
    // Legende hinzufügen - erst nachdem die Karte vollständig initialisiert ist
    setTimeout(() => {
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.innerHTML = `
                <h4>Legende</h4>
                <div><i style="background: orange"></i> WPA2_PSK</div>
                <div><i style="background: red"></i> WPA2_WPA3_PSK</div>
                <div><i style="background: green"></i> OPEN</div>
                <div><i style="background: gray"></i> Andere</div>
            `;
            return div;
        };
        
        legend.addTo(map);
        
        // Layer-Control für Basiskarten und Overlays
        const overlayLayers = {
            'Access Points': markerGroup,
            'SSID Beschriftungen': labelGroup
        };
        
        L.control.layers(baseLayers, overlayLayers, { 
            collapsed: true,
            position: 'topright'
        }).addTo(map);
    }, 100);
    
    // Event-Listener für den Datenladen-Button
    document.getElementById('loadDataBtn').addEventListener('click', loadData);
    
    // Funktion zum Gruppieren von Punkten nach Koordinaten
    function groupPointsByLocation(points) {
        const groups = {};
        const precision = 6; // Anzahl Dezimalstellen für Gruppierung
        
        points.forEach(point => {
            if (!point.latitude || !point.longitude) return;
            
            // Koordinaten auf bestimmte Präzision runden für Gruppierung
            const latKey = point.latitude.toFixed(precision);
            const lngKey = point.longitude.toFixed(precision);
            const key = `${latKey},${lngKey}`;
            
            if (!groups[key]) {
                groups[key] = {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    points: []
                };
            }
            
            groups[key].points.push(point);
        });
        
        return Object.values(groups);
    }
    
    // Funktion zum Verteilen von Punkten um eine Zentrumsposition
    function distributePointsAroundCenter(centerLat, centerLng, count, radius = 0.00002) {
        const positions = [];
        
        if (count === 1) {
            // Nur ein Punkt - bleibt in der Mitte
            return [{ lat: centerLat, lng: centerLng }];
        }
        
        // Punkte auf einem Kreis um das Zentrum verteilen
        for (let i = 0; i < count; i++) {
            const angle = (i * 2 * Math.PI) / count;
            const latOffset = radius * Math.cos(angle);
            const lngOffset = radius * Math.sin(angle);
            
            positions.push({
                lat: centerLat + latOffset,
                lng: centerLng + lngOffset
            });
        }
        
        return positions;
    }
    
    // Funktion zum Erstellen eines benutzerdefinierten Markers
    function createMarker(lat, lng, authMode, ssid) {
        let markerColor;
        
        // Farbe basierend auf AuthMode
        if (authMode.includes('WPA2_PSK')) {
            markerColor = 'orange';
        } else if (authMode.includes('WPA2_WPA3_PSK')) {
            markerColor = 'red';
        } else if (authMode.includes('OPEN')) {
            markerColor = 'green';
        } else {
            markerColor = 'gray';
        }
        
        // Custom Icon erstellen
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="position: relative;">
                    <div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
                    <div class="marker-ssid">${ssid || ''}</div>
                </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        return L.marker([lat, lng], { icon: icon });
    }
    
    // Funktion zum Erstellen von Labels
    function createLabel(lat, lng, ssid) {
        // Position leicht nach oben verschieben
        const labelLat = lat + 0.000001;
        
        return L.marker([labelLat, lng], {
            icon: L.divIcon({
                className: 'ssid-label',
                html: `<div class="label-text">${ssid || 'Unbenannt'}</div>`,
                iconSize: [120, 20],
                iconAnchor: [60, 10]
            })
        });
    }
    
    function loadData() {
        const tableName = document.getElementById('datasetSelect').value;
        
        // Lade-Animation anzeigen
        const loadBtn = document.getElementById('loadDataBtn');
        const originalText = loadBtn.textContent;
        loadBtn.textContent = 'Lädt...';
        loadBtn.disabled = true;
        
        fetch(`/data/${tableName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Serverfehler: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Vorherige Marker und Labels entfernen
                markerGroup.clearLayers();
                labelGroup.clearLayers();
                
                // Punkte nach Standort gruppieren
                const groupedPoints = groupPointsByLocation(data);
                
                // Array für alle Marker erstellen
                const allMarkers = [];
                
                // Durch jede Gruppe von Punkten iterieren
                groupedPoints.forEach(group => {
                    const pointCount = group.points.length;
                    const distributedPositions = distributePointsAroundCenter(
                        group.latitude, 
                        group.longitude, 
                        pointCount
                    );
                    
                    // Jeden Punkt an seiner verteilten Position erstellen
                    group.points.forEach((point, index) => {
                        const position = distributedPositions[index];
                        
                        // Marker erstellen
                        const marker = createMarker(
                            position.lat, 
                            position.lng, 
                            point.auth_mode,
                            point.ssid
                        );
                        
                        // Popup mit Informationen
                        const popupContent = `
                            <div style="min-width: 200px;">
                                <h3>${point.ssid || 'Unbenannt'}</h3>
                                <p><span class="info-label">MAC:</span> ${point.mac_address}</p>
                                <p><span class="info-label">Auth Mode:</span> ${point.auth_mode}</p>
                                <p><span class="info-label">Channel:</span> ${point.channel}</p>
                                <p><span class="info-label">RSSI:</span> ${point.rssi} dBm</p>
                                <p><span class="info-label">First Seen:</span> ${point.first_seen}</p>
                                <p><span class="info-label">Altitude:</span> ${point.altitude} m</p>
                                <p><span class="info-label">Accuracy:</span> ${point.accuracy} m</p>
                                ${pointCount > 1 ? `<p><span class="info-label">Standort:</span> ${pointCount} Access Points</p>` : ''}
                            </div>
                        `;
                        
                        marker.bindPopup(popupContent);
                        marker.addTo(markerGroup);
                        allMarkers.push(marker);
                        
                        // Label erstellen (wird nur angezeigt, wenn labelGroup aktiv ist)
                        const label = createLabel(position.lat, position.lng, point.ssid);
                        label.addTo(labelGroup);
                    });
                });
                
                // Karte an die Daten anpassen, wenn Marker vorhanden sind
                if (allMarkers.length > 0) {
                    // Erstelle eine FeatureGroup aus allen Markern
                    const featureGroup = L.featureGroup(allMarkers);
                    map.fitBounds(featureGroup.getBounds().pad(0.1));
                }
                
                // Erfolgsmeldung
                showStatus(`${allMarkers.length} Access Points geladen (${groupedPoints.length} Standorte)`, 'success');
            })
            .catch(error => {
                console.error('Fehler beim Laden der Daten:', error);
                showStatus('Fehler beim Laden der Daten: ' + error.message, 'error');
            })
            .finally(() => {
                // Button zurücksetzen
                loadBtn.textContent = originalText;
                loadBtn.disabled = false;
            });
    }
    
    // Statusmeldungen anzeigen
    function showStatus(message, type) {
        // Vorherige Statusmeldungen entfernen
        const existingStatus = document.getElementById('statusMessage');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Neue Statusmeldung erstellen
        const statusDiv = document.createElement('div');
        statusDiv.id = 'statusMessage';
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;
        
        // Meldung einfügen
        const dataSection = document.querySelector('.data-section');
        const mapContainer = document.getElementById('mapContainer');
        dataSection.insertBefore(statusDiv, mapContainer);
        
        // Meldung nach 5 Sekunden ausblenden
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.style.opacity = '0';
                setTimeout(() => statusDiv.remove(), 1000);
            }
        }, 5000);
    }
    
    // Automatisch Daten laden, wenn eine Tabelle ausgewählt ist
    if (document.getElementById('datasetSelect') && document.getElementById('datasetSelect').options.length > 0) {
        // Kurze Verzögerung, um sicherzustellen, dass die Karte vollständig geladen ist
        setTimeout(loadData, 500);
    }
});
