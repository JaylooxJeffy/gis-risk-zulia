// ============================================================================
// SISTEMA GIS PROFESIONAL - ESTADO ZULIA
// Versión con ArcGIS Geocoding para coordenadas reales
// ============================================================================

// ========== API KEY ARCGIS ==========
const ARCGIS_API_KEY = 'AAPTaMKrX59a-jofBVBMprI0_Sg..GjN9K8jS-2j7eDMlNLcGaKhUczamg6MVKv7QKejVajh2-YqAgDEdWqflCpOWBLtZNT42H9IoN87s8Qg_g75S9WsfUdBPlLOq_gcbI0-PJrwr53YqmuGv7Qs4qprNDj8jp14jEGH5hic3P2hg_E6FnjyaXUbuehsrfHLbXT_RfMUETmaRg9h024WsaJJShNxGdeQdSTq6zKFLAylBh_zLt1m8TYpviVKT-3Oh8jMV1A-doWiXwiW944SKw5vaAT1_kAlpKvJW';
const ARCGIS_SUGGEST_URL = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
const ARCGIS_FIND_URL = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

// ========== VARIABLES GLOBALES ==========
let map;
let currentMarker;
let currentCircle;
let currentLocation = null;
let selectedRisks = new Set();
let selectedSeverity = new Set();
let selectedImpacts = new Set();
let currentUser = null;
let analysisHistory = [];
let searchTimeout = null;

// ========== ZONAS PREDETERMINADAS ==========
const predefinedZones = [
    { name: 'Maracaibo', description: 'Capital del Estado Zulia' },
    { name: 'San Francisco, Zulia', description: 'Municipio San Francisco' },
    { name: 'Cabimas, Zulia', description: 'Municipio Cabimas' },
    { name: 'Ciudad Ojeda, Zulia', description: 'Municipio Lagunillas' },
    { name: 'Machiques de Perija', description: 'Municipio Machiques' },
    { name: 'Santa Rita, Zulia', description: 'Municipio Santa Rita' },
    { name: 'Sinamaica, Zulia', description: 'Municipio Guajira' },
    { name: 'Bobures, Zulia', description: 'Municipio Sucre' },
    { name: 'San Carlos del Zulia', description: 'Municipio Colon' },
    { name: 'Rosario de Perija', description: 'Municipio Rosario de Perija' }
];

// ========== FACTORES DE RIESGO ==========
const riskFactors = [
    { id: 'salinizado', name: 'Suelo Salinizado', level: 'high', category: 'soil' },
    { id: 'erosion', name: 'Erosion del Suelo', level: 'high', category: 'soil' },
    { id: 'inundacion', name: 'Riesgo de Inundacion', level: 'high', category: 'water' },
    { id: 'aguasEstancadas', name: 'Aguas Estancadas', level: 'medium', category: 'water' },
    { id: 'aridez', name: 'Aridez Climatica', level: 'medium', category: 'climate' },
    { id: 'contaminacion', name: 'Contaminacion Petrolera', level: 'high', category: 'pollution' },
    { id: 'bajafertilidad', name: 'Baja Fertilidad', level: 'medium', category: 'soil' },
    { id: 'topografia', name: 'Topografia Accidentada', level: 'medium', category: 'terrain' },
    { id: 'quemas', name: 'Areas Quemadas', level: 'high', category: 'fire' },
    { id: 'deforestacion', name: 'Deforestacion', level: 'high', category: 'environmental' },
    { id: 'sequia', name: 'Sequia', level: 'high', category: 'climate' },
    { id: 'plagas', name: 'Plagas y Enfermedades', level: 'medium', category: 'biological' }
];

const severityLevels = [
    { id: 'muy-alto', name: 'Muy Alto' },
    { id: 'alto', name: 'Alto' },
    { id: 'moderado', name: 'Moderado' },
    { id: 'bajo', name: 'Bajo' }
];

const impactTypes = [
    { id: 'suelo', name: 'Suelo' },
    { id: 'agua', name: 'Agua' },
    { id: 'clima', name: 'Clima' },
    { id: 'biodiversidad', name: 'Biodiversidad' },
    { id: 'agricultura', name: 'Agricultura' }
];

// ========== INICIALIZACION ==========
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    const sessionValid = await ApiClient.validateSession();
    if (!sessionValid) {
        window.location.href = 'auth.html';
        return;
    }

    currentUser = ApiClient.getUser();
    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }

    displayUserInfo();

    if (typeof L === 'undefined') {
        setTimeout(initializeApp, 200);
        return;
    }

    initMap();
    renderTags();
    setupEventListeners();
    loadRoleFeatures();
}

function displayUserInfo() {
    document.getElementById('username-display').textContent = currentUser.username;
    document.getElementById('role-display').textContent = capitalizeRole(currentUser.rol);

    if (currentUser.rol === 'administrador') {
        document.getElementById('btn-admin-panel').style.display = 'flex';
    }
}

function capitalizeRole(role) {
    const roles = {
        'consultor': 'Consultor',
        'analista': 'Analista',
        'administrador': 'Administrador'
    };
    return roles[role] || role;
}

// ========== FUNCIONALIDADES POR ROL ==========
function loadRoleFeatures() {
    console.log('Usuario: ' + currentUser.username + ' | Rol: ' + currentUser.rol);

    if (currentUser.rol === 'analista' || currentUser.rol === 'administrador') {
        addExportButton();
        addHistoryButton();
    }

    if (currentUser.rol === 'administrador') {
        addDataManagementFeatures();
    }
}

function addExportButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');

    let btnContainer = document.querySelector('.analyze-btn-container');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.className = 'analyze-btn-container';
        btnContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; width: calc(100% - 40px); margin: 0 20px 20px;';
        const parent = analyzeBtn.parentElement;
        parent.insertBefore(btnContainer, analyzeBtn);
        btnContainer.appendChild(analyzeBtn);
    }

    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportPdfBtn';
    exportBtn.innerHTML = 'Exportar Analisis';
    exportBtn.disabled = true;
    exportBtn.style.cssText = 'width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;border:none;border-radius:10px;font-size:0.95em;font-weight:600;cursor:pointer;transition:all 0.3s ease;';
    exportBtn.onclick = exportToPDF;
    btnContainer.appendChild(exportBtn);
}

function addHistoryButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const btnContainer = analyzeBtn.parentElement;

    const historyBtn = document.createElement('button');
    historyBtn.id = 'historyBtn';
    historyBtn.innerHTML = 'Ver Historial';
    historyBtn.style.cssText = 'width:100%;padding:12px;background:linear-gradient(135deg,#0891b2,#0e7490);color:white;border:none;border-radius:10px;font-size:0.95em;font-weight:600;cursor:pointer;transition:all 0.3s ease;';
    historyBtn.onclick = showHistory;
    btnContainer.appendChild(historyBtn);
}

function addDataManagementFeatures() {
    console.log('Funcionalidades de administrador habilitadas');
}

// ========== EXPORTAR ==========
function exportToPDF() {
    if (!currentLocation) {
        alert('No hay analisis para exportar');
        return;
    }

    const risks = Array.from(selectedRisks).map(id => riskFactors.find(f => f.id === id));
    const highRiskCount = risks.filter(r => r.level === 'high').length;
    let overallRisk;

    if (highRiskCount >= 4) overallRisk = 'MUY ALTO';
    else if (highRiskCount >= 2) overallRisk = 'ALTO';
    else if (highRiskCount >= 1) overallRisk = 'MODERADO';
    else overallRisk = 'BAJO';

    let reportContent = 'REPORTE DE ANALISIS DE RIESGO - GIS ZULIA\n\n';
    reportContent += 'UBICACION: ' + currentLocation.name + '\n';
    reportContent += 'DIRECCION: ' + (currentLocation.address || currentLocation.name) + '\n';
    reportContent += 'COORDENADAS: ' + currentLocation.lat.toFixed(6) + 'N, ' + Math.abs(currentLocation.lng).toFixed(6) + 'W\n';
    reportContent += 'FUENTE: ArcGIS World Geocoding Service\n\n';
    reportContent += 'NIVEL DE RIESGO GENERAL: ' + overallRisk + '\n\n';
    reportContent += 'FACTORES DE RIESGO (' + risks.length + '):\n';

    risks.forEach((risk, index) => {
        reportContent += (index + 1) + '. ' + risk.name + ' [' + (risk.level === 'high' ? 'ALTO' : 'MEDIO') + ']\n';
    });

    reportContent += '\nGenerado por: ' + currentUser.username + ' (' + capitalizeRole(currentUser.rol) + ')\n';
    reportContent += 'Fecha: ' + new Date().toLocaleString('es-ES') + '\n';

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reporte_' + currentLocation.name.replace(/ /g, '_') + '_' + new Date().getTime() + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Reporte exportado correctamente');
}

// ========== HISTORIAL ==========
function showHistory() {
    if (analysisHistory.length === 0) {
        alert('No hay analisis en el historial');
        return;
    }

    let historyContent = 'HISTORIAL DE ANALISIS\n\n';
    analysisHistory.forEach((item, index) => {
        historyContent += (index + 1) + '. ' + item.location + ' - ' + item.date + '\n';
        historyContent += '   Riesgo: ' + item.risk + ' | Factores: ' + item.factorsCount + '\n\n';
    });

    alert(historyContent);
}

function saveToHistory(location, risk, factorsCount) {
    analysisHistory.push({
        location: location,
        date: new Date().toLocaleString('es-ES'),
        risk: risk,
        factorsCount: factorsCount
    });
}

// ========== MAPA ==========
function initMap() {
    const center = [10.2500, -71.7500];

    map = L.map('map', {
        center: center,
        zoom: 8,
        minZoom: 3,
        maxZoom: 18
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors'
    }).addTo(map);
}

// ========== RENDERIZAR TAGS ==========
function renderTags() {
    const riskTagsContainer = document.getElementById('riskTags');
    const severityTagsContainer = document.getElementById('severityTags');
    const impactTagsContainer = document.getElementById('impactTags');

    riskFactors.forEach(factor => {
        riskTagsContainer.appendChild(createTag(factor.name, factor.id, 'risk', factor.level));
    });

    severityLevels.forEach(level => {
        severityTagsContainer.appendChild(createTag(level.name, level.id, 'severity'));
    });

    impactTypes.forEach(impact => {
        impactTagsContainer.appendChild(createTag(impact.name, impact.id, 'impact'));
    });
}

function createTag(text, id, type, riskLevel) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.dataset.id = id;
    tag.dataset.type = type;

    let indicator = '';
    if (riskLevel) {
        indicator = '<span class="risk-indicator risk-' + riskLevel + '"></span>';
    }

    tag.innerHTML = indicator + text;
    tag.onclick = () => toggleTag(tag, id, type, text);

    return tag;
}

function toggleTag(tag, id, type, text) {
    tag.classList.toggle('selected');

    if (tag.classList.contains('selected')) {
        if (type === 'risk') selectedRisks.add(id);
        if (type === 'severity') selectedSeverity.add(id);
        if (type === 'impact') selectedImpacts.add(id);
        addSelectedTag(id, text, type);
    } else {
        if (type === 'risk') selectedRisks.delete(id);
        if (type === 'severity') selectedSeverity.delete(id);
        if (type === 'impact') selectedImpacts.delete(id);
        removeSelectedTag(id);
    }

    updateSelectedFilters();
    updateAnalyzeButton();
}

function addSelectedTag(id, text, type) {
    const container = document.getElementById('selectedTags');
    const tag = document.createElement('div');
    tag.className = 'selected-tag';
    tag.dataset.id = id;
    tag.innerHTML = text + '<span class="selected-tag-close" onclick="removeTagById(\'' + id + '\',\'' + type + '\')">x</span>';
    container.appendChild(tag);
}

function removeSelectedTag(id) {
    const tag = document.querySelector('.selected-tag[data-id="' + id + '"]');
    if (tag) tag.remove();
}

function removeTagById(id, type) {
    const tag = document.querySelector('.tag[data-id="' + id + '"][data-type="' + type + '"]');
    if (tag) {
        tag.classList.remove('selected');
        if (type === 'risk') selectedRisks.delete(id);
        if (type === 'severity') selectedSeverity.delete(id);
        if (type === 'impact') selectedImpacts.delete(id);
        removeSelectedTag(id);
        updateSelectedFilters();
        updateAnalyzeButton();
    }
}

function updateSelectedFilters() {
    const section = document.getElementById('selectedFiltersSection');
    const hasFilters = selectedRisks.size > 0 || selectedSeverity.size > 0 || selectedImpacts.size > 0;
    section.style.display = hasFilters ? 'block' : 'none';
}

function updateAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    const exportBtn = document.getElementById('exportPdfBtn');
    const hasLocation = currentLocation !== null;
    const hasFilters = selectedRisks.size > 0;
    btn.disabled = !hasLocation || !hasFilters;
    if (exportBtn) exportBtn.disabled = !hasLocation || !hasFilters;
}

// ========== MAPA DE PAÍSES ==========
const PAISES = {
    'VEN': 'Venezuela', 'MEX': 'México', 'COL': 'Colombia', 'ARG': 'Argentina',
    'BRA': 'Brasil', 'CHL': 'Chile', 'PER': 'Perú', 'ECU': 'Ecuador',
    'BOL': 'Bolivia', 'PRY': 'Paraguay', 'URY': 'Uruguay', 'PAN': 'Panamá',
    'CRI': 'Costa Rica', 'GTM': 'Guatemala', 'HND': 'Honduras', 'SLV': 'El Salvador',
    'NIC': 'Nicaragua', 'CUB': 'Cuba', 'DOM': 'Rep. Dominicana', 'PRI': 'Puerto Rico',
    'USA': 'Estados Unidos', 'CAN': 'Canadá', 'ESP': 'España', 'FRA': 'Francia',
    'DEU': 'Alemania', 'ITA': 'Italia', 'GBR': 'Reino Unido', 'PRT': 'Portugal',
    'KOR': 'Corea del Sur', 'JPN': 'Japón', 'CHN': 'China', 'IND': 'India',
    'AUS': 'Australia', 'NZL': 'Nueva Zelanda', 'ZAF': 'Sudáfrica',
    'EGY': 'Egipto', 'MAR': 'Marruecos', 'NGA': 'Nigeria', 'KEN': 'Kenia',
    'RUS': 'Rusia', 'UKR': 'Ucrania', 'POL': 'Polonia', 'NLD': 'Países Bajos',
    'BEL': 'Bélgica', 'CHE': 'Suiza', 'AUT': 'Austria', 'SWE': 'Suecia',
    'NOR': 'Noruega', 'DNK': 'Dinamarca', 'FIN': 'Finlandia', 'IRL': 'Irlanda',
    'GRC': 'Grecia', 'TUR': 'Turquía', 'ISR': 'Israel', 'SAU': 'Arabia Saudita',
    'ARE': 'Emiratos Árabes', 'IDN': 'Indonesia', 'THA': 'Tailandia', 'VNM': 'Vietnam',
    'PHL': 'Filipinas', 'MYS': 'Malasia', 'SGP': 'Singapur', 'PAK': 'Pakistán',
    'CUW': 'Curazao', 'TTO': 'Trinidad y Tobago', 'JAM': 'Jamaica',
    'HTI': 'Haití', 'BLZ': 'Belice', 'GUY': 'Guyana', 'SUR': 'Surinam'
};

function extraerPais(texto) {
    const partes = texto.split(',').map(p => p.trim());
    const ultimo = partes[partes.length - 1];
    return PAISES[ultimo] || ultimo;
}

// ========== BUSQUEDA ARCGIS ==========
function setupEventListeners() {
    const searchInput = document.getElementById('locationSearch');
    const dropdown = document.getElementById('locationDropdown');

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length < 2) {
            showPredefinedZones(dropdown);
        }
    });

    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();

        if (value.length < 2) {
            showPredefinedZones(dropdown);
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchWithArcGIS(value, dropdown);
        }, 350);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function showPredefinedZones(dropdown) {
    let html = '<div style="padding:8px 16px;font-size:0.75em;color:#94a3b8;font-weight:600;text-transform:uppercase;">Zonas predeterminadas</div>';

    predefinedZones.forEach(zone => {
        html += '<div class="location-item" onclick="selectPredefinedZone(\'' + zone.name.replace(/'/g, '') + '\')">';
        html += '<span class="location-item-icon">📍</span>';
        html += '<div class="location-item-text">';
        html += '<div class="location-item-name">' + zone.name + '</div>';
        html += '<div class="location-item-details">' + zone.description + '</div>';
        html += '</div></div>';
    });

    dropdown.innerHTML = html;
    dropdown.classList.add('active');
}

async function searchWithArcGIS(query, dropdown) {
    dropdown.innerHTML = '<div class="no-results">Buscando...</div>';
    dropdown.classList.add('active');

    try {
        const params = new URLSearchParams({
            text: query,
            location: '-71.6405,10.6316',
            distance: '300000',
            maxSuggestions: '8',
            f: 'json',
            token: ARCGIS_API_KEY
        });

        const response = await fetch(ARCGIS_SUGGEST_URL + '?' + params.toString());
        const data = await response.json();

        if (data.suggestions && data.suggestions.length > 0) {
            let html = '<div style="padding:8px 16px;font-size:0.75em;color:#94a3b8;font-weight:600;text-transform:uppercase;">Resultados</div>';

            data.suggestions.forEach(suggestion => {
                const encodedText = encodeURIComponent(suggestion.text);
                const encodedKey = encodeURIComponent(suggestion.magicKey);
                const pais = extraerPais(suggestion.text);
                html += '<div class="location-item" onclick="selectArcGISLocation(\'' + encodedText + '\',\'' + encodedKey + '\')">';
                html += '<span class="location-item-icon">📍</span>';
                html += '<div class="location-item-text">';
                html += '<div class="location-item-name">' + suggestion.text + '</div>';
                html += '<div class="location-item-details">' + pais + '</div>';
                html += '</div></div>';
            });

            dropdown.innerHTML = html;
        } else {
            dropdown.innerHTML = '<div class="no-results">No se encontraron resultados</div>';
        }

        dropdown.classList.add('active');
    } catch (error) {
        console.error('Error ArcGIS suggest:', error);
        dropdown.innerHTML = '<div class="no-results">Error al buscar. Intenta de nuevo.</div>';
    }
}

async function selectArcGISLocation(encodedText, encodedMagicKey) {
    const text = decodeURIComponent(encodedText);
    const magicKey = decodeURIComponent(encodedMagicKey);
    const dropdown = document.getElementById('locationDropdown');
    const searchInput = document.getElementById('locationSearch');

    searchInput.value = text;
    dropdown.innerHTML = '<div class="no-results">Obteniendo coordenadas...</div>';
    dropdown.classList.add('active');

    try {
        const params = new URLSearchParams({
            SingleLine: text,
            magicKey: magicKey,
            outFields: 'Match_addr,PlaceName,Type,Addr_type,City,Region',
            outSR: '4326',
            f: 'json',
            token: ARCGIS_API_KEY
        });

        const response = await fetch(ARCGIS_FIND_URL + '?' + params.toString());
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const lat = candidate.location.y;
            const lng = candidate.location.x;
            const attrs = candidate.attributes;

            currentLocation = {
                lat: lat,
                lng: lng,
                name: attrs.PlaceName || attrs.Match_addr || text,
                address: attrs.Match_addr || text,
                type: attrs.Addr_type || attrs.Type || 'Lugar',
                municipality: attrs.City || attrs.Region || 'Zulia'
            };

            placeMarkerOnMap(lat, lng, currentLocation);
            updateAnalyzeButton();
            dropdown.classList.remove('active');
        } else {
            dropdown.innerHTML = '<div class="no-results">No se pudo obtener la ubicacion exacta</div>';
        }
    } catch (error) {
        console.error('Error ArcGIS findAddressCandidates:', error);
        dropdown.innerHTML = '<div class="no-results">Error al obtener coordenadas</div>';
    }
}

async function selectPredefinedZone(zoneName) {
    const searchInput = document.getElementById('locationSearch');
    const dropdown = document.getElementById('locationDropdown');

    searchInput.value = zoneName;
    dropdown.innerHTML = '<div class="no-results">Obteniendo coordenadas...</div>';
    dropdown.classList.add('active');

    try {
        const params = new URLSearchParams({
            SingleLine: zoneName + ', Venezuela',
            outFields: 'Match_addr,PlaceName,Type,Addr_type,City,Region',
            outSR: '4326',
            f: 'json',
            token: ARCGIS_API_KEY
        });

        const response = await fetch(ARCGIS_FIND_URL + '?' + params.toString());
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            const lat = candidate.location.y;
            const lng = candidate.location.x;
            const attrs = candidate.attributes;

            currentLocation = {
                lat: lat,
                lng: lng,
                name: attrs.PlaceName || zoneName,
                address: attrs.Match_addr || zoneName,
                type: attrs.Addr_type || 'Zona',
                municipality: attrs.City || attrs.Region || 'Zulia'
            };

            placeMarkerOnMap(lat, lng, currentLocation);
            updateAnalyzeButton();
            dropdown.classList.remove('active');
        } else {
            dropdown.innerHTML = '<div class="no-results">No se pudo obtener la ubicacion</div>';
        }
    } catch (error) {
        console.error('Error geocodificando zona:', error);
        dropdown.innerHTML = '<div class="no-results">Error al obtener coordenadas</div>';
    }
}

function placeMarkerOnMap(lat, lng, location) {
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    currentMarker = L.marker([lat, lng]).addTo(map);
    currentMarker.bindPopup(
        '<strong>' + location.name + '</strong><br>' +
        (location.address ? location.address + '<br>' : '') +
        '<small>Lat: ' + lat.toFixed(6) + ', Lng: ' + lng.toFixed(6) + '</small><br>' +
        '<small style="color:#2563eb;">Coordenadas ArcGIS</small>'
    ).openPopup();

    map.setView([lat, lng], 13);
}

// ========== ANALISIS DE RIESGOS ==========
function analyzeRisks() {
    if (!currentLocation || selectedRisks.size === 0) {
        alert('Seleccione una ubicacion y al menos un factor de riesgo');
        return;
    }

    const risks = Array.from(selectedRisks).map(id => {
        const factor = riskFactors.find(f => f.id === id);
        return { id: factor.id, name: factor.name, level: factor.level, category: factor.category };
    });

    displayResults(risks);
}

function displayResults(risks) {
    const resultsContent = document.getElementById('resultsContent');
    const resultsPanel = document.getElementById('resultsPanel');

    const descriptions = {
        'salinizado': 'Acumulacion excesiva de sales que afecta la capacidad del suelo para soportar cultivos.',
        'erosion': 'Perdida progresiva de suelo fertil por accion del agua, viento o actividad humana.',
        'inundacion': 'Zona susceptible a encharcamientos y desbordamientos durante temporadas de lluvia.',
        'aguasEstancadas': 'Presencia de agua acumulada que favorece la proliferacion de vectores de enfermedades.',
        'aridez': 'Deficit hidrico severo que limita el desarrollo de actividades agricolas.',
        'contaminacion': 'Degradacion del suelo por presencia de hidrocarburos y derivados del petroleo.',
        'bajafertilidad': 'Suelos pobres en nutrientes esenciales para el crecimiento de plantas.',
        'topografia': 'Terrenos con pendientes pronunciadas que dificultan el uso agricola.',
        'quemas': 'Areas afectadas por incendios que han degradado la capa vegetal y organica.',
        'deforestacion': 'Perdida de cobertura forestal que aumenta la vulnerabilidad del ecosistema.',
        'sequia': 'Periodos prolongados sin precipitaciones que afectan la disponibilidad de agua.',
        'plagas': 'Presencia de organismos que danan cultivos y reducen la productividad.'
    };

    const highRiskCount = risks.filter(r => r.level === 'high').length;
    let overallRisk, riskColor;

    if (highRiskCount >= 4) { overallRisk = 'MUY ALTO'; riskColor = '#dc2626'; }
    else if (highRiskCount >= 2) { overallRisk = 'ALTO'; riskColor = '#d97706'; }
    else if (highRiskCount >= 1) { overallRisk = 'MODERADO'; riskColor = '#f59e0b'; }
    else { overallRisk = 'BAJO'; riskColor = '#059669'; }

    let riskItemsHtml = '';
    risks.forEach(risk => {
        riskItemsHtml += '<div class="result-item">';
        riskItemsHtml += '<div class="result-item-header">';
        riskItemsHtml += '<span class="result-item-name">' + risk.name + '</span>';
        riskItemsHtml += '<span class="result-item-badge ' + (risk.level === 'high' ? 'badge-high' : 'badge-medium') + '">';
        riskItemsHtml += (risk.level === 'high' ? 'ALTO' : 'MEDIO') + '</span>';
        riskItemsHtml += '</div>';
        riskItemsHtml += '<div class="result-item-desc">' + (descriptions[risk.id] || '') + '</div>';
        riskItemsHtml += '</div>';
    });

    let recommendation;
    if (highRiskCount >= 3) {
        recommendation = 'Se requiere consulta urgente con especialistas en gestion ambiental antes de iniciar cualquier desarrollo en la zona.';
    } else if (highRiskCount >= 1) {
        recommendation = 'Los factores de riesgo identificados son manejables con tecnicas apropiadas. Se recomienda implementar practicas de conservacion de suelos.';
    } else {
        recommendation = 'La zona presenta condiciones aceptables. Se recomienda monitoreo periodico y buenas practicas agricolas.';
    }

    resultsContent.innerHTML =
        '<div class="result-location">' +
        '<h4>📍 ' + currentLocation.name + '</h4>' +
        '<div class="result-coords">' +
        (currentLocation.address ? currentLocation.address + '<br>' : '') +
        'Municipio: ' + currentLocation.municipality + '<br>' +
        'Coordenadas: ' + currentLocation.lat.toFixed(6) + 'N, ' + Math.abs(currentLocation.lng).toFixed(6) + 'W<br>' +
        '<small style="color:#2563eb;">Fuente: ArcGIS World Geocoding</small>' +
        '</div>' +
        '<div class="risk-level-box">' +
        '<div class="risk-level-label">NIVEL DE RIESGO GENERAL</div>' +
        '<div class="risk-level-value" style="color:' + riskColor + ';">' + overallRisk + '</div>' +
        '</div></div>' +
        '<div class="results-list"><h4>Factores de Riesgo Detectados (' + risks.length + ')</h4>' +
        riskItemsHtml + '</div>' +
        '<div class="recommendations"><h4>Recomendaciones Tecnicas</h4><p>' + recommendation + '</p></div>';

    resultsPanel.classList.add('active');

    if (currentCircle) map.removeLayer(currentCircle);

    currentCircle = L.circle([currentLocation.lat, currentLocation.lng], {
        color: riskColor,
        fillColor: riskColor,
        fillOpacity: 0.25,
        radius: 800
    }).addTo(map);

    if (currentUser.rol === 'analista' || currentUser.rol === 'administrador') {
        saveToHistory(currentLocation.name, overallRisk, risks.length);
    }
}

function closeResults() {
    document.getElementById('resultsPanel').classList.remove('active');
}

function goToAdminPanel() {
    window.location.href = 'admin-panel.html';
}

function handleLogout() {
    if (confirm('Estas seguro de cerrar sesion?')) {
        ApiClient.logout();
    }
}

window.selectArcGISLocation = selectArcGISLocation;
window.selectPredefinedZone = selectPredefinedZone;
window.toggleTag = toggleTag;
window.removeTagById = removeTagById;
window.analyzeRisks = analyzeRisks;
window.closeResults = closeResults;
window.goToAdminPanel = goToAdminPanel;
window.handleLogout = handleLogout;
window.exportToPDF = exportToPDF;
window.showHistory = showHistory;
