 // Esperar a que Leaflet se cargue completamente
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
        });

        const maracaiboLocations = {
            'barrio hogar santa cruz': { lat: 10.6685, lng: -71.6385, name: 'Barrio Hogar Santa Cruz' },
            '18 de octubre': { lat: 10.6725, lng: -71.6345, name: 'Barrio 18 de Octubre' },
            'valle frio': { lat: 10.6550, lng: -71.6200, name: 'Valle Frío' },
            'santa lucia': { lat: 10.6400, lng: -71.6118, name: 'Santa Lucía' },
            'el milagro': { lat: 10.6800, lng: -71.6000, name: 'El Milagro' },
            'la lago': { lat: 10.6900, lng: -71.6300, name: 'La Lago' },
            'barrio venezuela': { lat: 10.6790, lng: -71.6615, name: 'Barrio Venezuela' },
            'las delicias': { lat: 10.6650, lng: -71.6250, name: 'Las Delicias' },
            'centro': { lat: 10.6316, lng: -71.6405, name: 'Centro' },
            'sabaneta': { lat: 10.6500, lng: -71.6500, name: 'Sabaneta' }
        };

        let map;
        let currentMarker;
        let currentCircle;
        let currentLocation = null;

        function initializeApp() {
            // Verificar que Leaflet esté disponible con reintentos
            if (typeof L === 'undefined') {
                console.log('Esperando a que Leaflet se cargue...');
                setTimeout(initializeApp, 200);
                return;
            }
            
            console.log('Leaflet cargado correctamente');
            initMap();
            setupEventListeners();
        }

        function setupEventListeners() {
            const searchInput = document.getElementById('locationSearch');
            const suggestionsDiv = document.getElementById('suggestions');

            searchInput.addEventListener('input', (e) => {
                const value = e.target.value.toLowerCase().trim();
                
                if (value.length < 2) {
                    suggestionsDiv.classList.remove('active');
                    return;
                }

                const matches = Object.keys(maracaiboLocations).filter(loc => 
                    loc.includes(value) || maracaiboLocations[loc].name.toLowerCase().includes(value)
                );

                if (matches.length > 0) {
                    suggestionsDiv.innerHTML = matches.map(loc => 
                        `<div class="suggestion-item" onclick="selectLocation('${loc}')">📍 ${maracaiboLocations[loc].name}</div>`
                    ).join('');
                    suggestionsDiv.classList.add('active');
                } else {
                    suggestionsDiv.innerHTML = '<div class="suggestion-item" style="color: #94a3b8;">No se encontraron resultados</div>';
                    suggestionsDiv.classList.add('active');
                }
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchLocation();
                }
            });
        }

        function initMap() {
            const center = [10.6316, -71.6405];
            const bounds = [[10.5800, -71.7200], [10.7300, -71.5800]];

            map = L.map('map', {
                center: center,
                zoom: 12,
                minZoom: 11,
                maxZoom: 16,
                maxBounds: bounds,
                maxBoundsViscosity: 1.0
            });
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);
        }

        function selectLocation(locationKey) {
            const location = maracaiboLocations[locationKey];
            const searchInput = document.getElementById('locationSearch');
            const suggestionsDiv = document.getElementById('suggestions');
            
            searchInput.value = location.name;
            suggestionsDiv.classList.remove('active');
            
            currentLocation = location;
            
            if (currentMarker) {
                map.removeLayer(currentMarker);
            }
            
            currentMarker = L.marker([location.lat, location.lng]).addTo(map);
            currentMarker.bindPopup(`<b>${location.name}</b><br>Seleccione factores de riesgo`).openPopup();
            
            map.setView([location.lat, location.lng], 14);
            
            // Habilitar el botón de análisis
            const analyzeBtn = document.getElementById('analyzeBtn');
            analyzeBtn.disabled = false;
            console.log('Ubicación seleccionada:', location.name);
        }

        function searchLocation() {
            const value = searchInput.value.toLowerCase().trim();
            const locationKey = Object.keys(maracaiboLocations).find(key => 
                maracaiboLocations[key].name.toLowerCase() === value || key === value
            );
            
            if (locationKey) {
                selectLocation(locationKey);
            } else {
                alert('Ubicación no encontrada');
            }
        }

        function toggleCheckbox(element) {
            const checkbox = element.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            element.classList.toggle('selected');
        }

        function analyzeRisks() {
            const checkboxes = document.querySelectorAll('.checkbox-item input:checked');
            
            if (checkboxes.length === 0) {
                alert('Seleccione al menos un factor de riesgo');
                return;
            }

            if (!currentLocation) {
                alert('Seleccione una ubicación primero');
                return;
            }

            const selectedRisks = Array.from(checkboxes).map(cb => ({
                id: cb.value,
                label: cb.parentElement.querySelector('label').textContent,
                level: cb.parentElement.querySelector('.risk-badge').textContent
            }));

            displayResults(selectedRisks);
        }

        function displayResults(risks) {
            const resultsContent = document.getElementById('resultsContent');
            const resultsPanel = document.getElementById('resultsPanel');

            const descriptions = {
                'salinizado': 'Acumulación de sales que dificulta el crecimiento de cultivos.',
                'erosion': 'Pérdida de suelo por agua o viento.',
                'inundacion': 'Zona susceptible a encharcamientos.',
                'aguasEstancadas': 'Agua acumulada que genera vectores.',
                'aridez': 'Déficit hídrico que limita agricultura.',
                'contaminacion': 'Degradación por hidrocarburos.',
                'bajafertilidad': 'Suelos pobres en nutrientes.',
                'topografia': 'Terrenos con pendientes pronunciadas.',
                'quemas': 'Áreas afectadas por incendios.'
            };

            const highRiskCount = risks.filter(r => r.level.includes('ALTO')).length;
            let overallRisk, riskColor;
            
            if (highRiskCount >= 3) {
                overallRisk = 'MUY ALTO';
                riskColor = '#dc2626';
            } else if (highRiskCount >= 1) {
                overallRisk = 'ALTO';
                riskColor = '#d97706';
            } else {
                overallRisk = 'MODERADO';
                riskColor = '#059669';
            }

            resultsContent.innerHTML = `
                <div style="background: #e0f2fe; padding: 16px; border-radius: 10px; margin-bottom: 16px;">
                    <h4 style="color: #1a365d; margin-bottom: 10px;">📍 ${currentLocation.name}</h4>
                    <p style="font-size: 0.85em; color: #475569; margin-bottom: 8px;">
                        Coordenadas: ${currentLocation.lat.toFixed(4)}°, ${currentLocation.lng.toFixed(4)}°
                    </p>
                    <div style="background: white; padding: 10px; border-radius: 6px;">
                        <p style="font-size: 0.85em; margin: 0;"><strong>Riesgo General:</strong></p>
                        <p style="font-size: 1.2em; font-weight: 700; color: ${riskColor}; margin: 5px 0 0;">
                            ${overallRisk}
                        </p>
                    </div>
                </div>
                
                <h4 style="color: #1a365d; margin-bottom: 12px;">Factores (${risks.length})</h4>
                
                ${risks.map(risk => `
                    <div class="result-item">
                        <h4>
                            ${risk.label} 
                            <span class="risk-badge ${risk.level.includes('ALTO') ? 'risk-high' : 'risk-medium'}">
                                ${risk.level}
                            </span>
                        </h4>
                        <p>${descriptions[risk.id]}</p>
                    </div>
                `).join('')}
                
                <div style="background: #fef3c7; padding: 16px; border-radius: 10px; margin-top: 18px;">
                    <h4 style="color: #92400e; margin-bottom: 10px;">⚠️ Recomendaciones</h4>
                    <p style="font-size: 0.85em; color: #92400e;">
                        ${highRiskCount >= 2 
                            ? 'Se requiere consulta con especialistas antes de desarrollo agrícola.' 
                            : 'Factores manejables con técnicas apropiadas.'}
                    </p>
                </div>
            `;

            resultsPanel.classList.add('active');

            if (currentCircle) {
                map.removeLayer(currentCircle);
            }

            currentCircle = L.circle([currentLocation.lat, currentLocation.lng], {
                color: riskColor,
                fillColor: riskColor,
                fillOpacity: 0.25,
                radius: 500
            }).addTo(map);
        }

        function closeResults() {
            document.getElementById('resultsPanel').classList.remove('active');
        }

        // Hacer las funciones globales para que funcionen con onclick
        window.selectLocation = selectLocation;
        window.searchLocation = searchLocation;
        window.toggleCheckbox = toggleCheckbox;
        window.analyzeRisks = analyzeRisks;
        window.closeResults = closeResults;