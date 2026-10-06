// ============================================================================
// VALIDACION CIENTIFICA DE FACTORES DE RIESGO
// Fuentes: SoilGrids (ISRIC) y NASA POWER -- datos abiertos, sin API key,
// cobertura mundial. No reemplaza a ArcGIS como geocodificador: solo valida
// con datos reales los factores de riesgo que el analista ya selecciono.
// ============================================================================

const SOILGRIDS_BASE_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const NASAPOWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const OPENTOPODATA_BASE_URL = 'https://api.opentopodata.org/v1/srtm30m';

// Propiedades de SoilGrids consultadas (capa superficial 0-5cm)
const SOILGRIDS_PROPIEDADES = ['phh2o', 'clay', 'sand', 'soc', 'nitrogen', 'cec', 'bdod'];

// Factores de conversion OFICIALES de ISRIC: valor_mapeado / factor = unidad convencional
// Fuente: https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_01.html
const SOILGRIDS_CONVERSION = {
    phh2o: 10,     // -> pH
    clay: 10,      // -> %
    sand: 10,      // -> %
    soc: 10,       // -> g/kg
    nitrogen: 100, // -> g/kg
    cec: 10,       // -> cmol(c)/kg
    bdod: 100      // -> kg/dm3
};

// ========== MAPEO: que factor de riesgo se valida con que fuente(s) ==========
// Coincidencia por palabras clave (insensible a mayusculas/acentos) para no
// depender de que el nombre exacto en la DB calce 100% con este texto.
// Si agregas un factor nuevo desde el panel admin y quieres que tenga
// validacion automatica, agrega una entrada aqui.
// Algunos factores combinan suelo + clima porque la evidencia cientifica es
// mas fuerte cruzando ambas fuentes que usando una sola (ver evaluarFactor).
const MAPEO_VALIDACION = [
    { tipo: 'suelo_salinizado', keywords: ['saliniz', 'salinidad'], fuentes: ['hwsd'] },
    { tipo: 'baja_fertilidad', keywords: ['fertilidad', 'fertil'], fuentes: ['soilgrids'] },
    { tipo: 'erosion_suelo', keywords: ['erosion', 'erosión'], fuentes: ['soilgrids'] },
    { tipo: 'suelo_blando', keywords: ['suelo blando', 'suelo suave', 'baja compactacion'], fuentes: ['soilgrids'] },
    { tipo: 'sequia', keywords: ['sequia', 'sequía'], fuentes: ['nasapower'] },
    { tipo: 'aridez_climatica', keywords: ['aridez', 'arido', 'árido', 'clima arido'], fuentes: ['nasapower'] },
    { tipo: 'aguas_estancadas', keywords: ['agua estancada', 'aguas estancadas', 'estancamiento'], fuentes: ['soilgrids', 'nasapower'] },
    { tipo: 'topografia_accidentada', keywords: ['topografia accidentada', 'topografia', 'terreno accidentado', 'relieve accidentado'], fuentes: ['opentopodata'] },
    { tipo: 'deslizamientos', keywords: ['deslizamiento', 'desliz'], fuentes: ['opentopodata', 'nasapower'] },
    { tipo: 'areas_quemadas', keywords: ['area quemada', 'areas quemadas', 'incendio', 'quema', 'quemado'], fuentes: ['firms'] },
    // ——— MINERÍA ———
    { tipo: 'mineria_activa',          keywords: ['mineria ilegal', 'mina activa', 'mineria activa'],    fuentes: ['overpass'] },
    { tipo: 'relaves_mineros',         keywords: ['relave', 'residuo minero'],                           fuentes: ['overpass', 'soilgrids'] },
    { tipo: 'contaminacion_mercurio',  keywords: ['mercurio'],                                           fuentes: ['overpass'] },
    { tipo: 'contaminacion_metales',   keywords: ['metal pesado', 'metales pesados'],                    fuentes: ['overpass'] },
    { tipo: 'deforestacion_minera',    keywords: ['deforestacion minera'],                               fuentes: ['overpass'] },
    { tipo: 'contaminacion_acuiferos', keywords: ['acuifero'],                                           fuentes: ['overpass', 'nasapower'] },
    { tipo: 'riesgo_explosion',        keywords: ['explosion', 'explosivo'],                             fuentes: ['overpass'] },
    { tipo: 'subsidencia',             keywords: ['subsidencia'],                                        fuentes: ['soilgrids', 'overpass'] },
    { tipo: 'contaminacion_petrolera', keywords: ['contaminacion petrolera', 'hidrocarburo', 'petrole'], fuentes: ['overpass'] }
];

function normalizarTexto(texto) {
    return String(texto)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function identificarFactoresValidables(risks) {
    const encontrados = [];
    risks.forEach(risk => {
        const nombreNorm = normalizarTexto(risk.name);
        const match = MAPEO_VALIDACION.find(m =>
            m.keywords.some(kw => nombreNorm.includes(normalizarTexto(kw)))
        );
        if (match) {
            encontrados.push({ risk, mapeo: match });
        } else {
            console.log('[Validacion cientifica] Sin mapeo automatico para: "' + risk.name + '" (ajusta MAPEO_VALIDACION si corresponde)');
        }
    });
    return encontrados;
}

// ========== SOILGRIDS ==========
async function consultarSoilGrids(lat, lon) {
    try {
        const params = new URLSearchParams();
        params.append('lon', lon);
        params.append('lat', lat);
        SOILGRIDS_PROPIEDADES.forEach(p => params.append('property', p));
        params.append('depth', '0-5cm');
        params.append('value', 'mean');

        const response = await fetch(SOILGRIDS_BASE_URL + '?' + params.toString());
        if (!response.ok) throw new Error('SoilGrids respondio HTTP ' + response.status);

        const data = await response.json();
        const layers = (data && data.properties && data.properties.layers) || [];
        const resultado = {};

        layers.forEach(layer => {
            const depthData = layer.depths && layer.depths[0];
            const valorCrudo = depthData && depthData.values && depthData.values.mean;
            if (valorCrudo !== undefined && valorCrudo !== null) {
                const factor = SOILGRIDS_CONVERSION[layer.name] || 1;
                resultado[layer.name] = valorCrudo / factor;
            }
        });

        return Object.keys(resultado).length > 0 ? resultado : null;
    } catch (error) {
        console.error('Error consultando SoilGrids:', error);
        return null;
    }
}

// ========== NASA POWER ==========
function formatearFechaPOWER(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return '' + y + m + d;
}

async function consultarNasaPower(lat, lon) {
    try {
        // NASA POWER (NRT) suele tener unos dias de rezago; se pide hasta hace 4 dias
        const fin = new Date();
        fin.setDate(fin.getDate() - 4);
        const inicio = new Date(fin);
        inicio.setDate(inicio.getDate() - 365);

        const params = new URLSearchParams({
            parameters: 'PRECTOTCORR,T2M,RH2M',
            community: 'AG',
            latitude: lat,
            longitude: lon,
            start: formatearFechaPOWER(inicio),
            end: formatearFechaPOWER(fin),
            format: 'JSON'
        });

        const response = await fetch(NASAPOWER_BASE_URL + '?' + params.toString());
        if (!response.ok) throw new Error('NASA POWER respondio HTTP ' + response.status);

        const data = await response.json();
        const parametros = data && data.properties && data.properties.parameter;
        if (!parametros) return null;

        const precipDiaria = Object.values(parametros.PRECTOTCORR || {});
        const tempDiaria = Object.values(parametros.T2M || {});
        const humedadDiaria = Object.values(parametros.RH2M || {});

        // -999 es el codigo de "sin dato" de NASA POWER
        const precipValida = precipDiaria.filter(v => v > -900);
        const tempValida = tempDiaria.filter(v => v > -900);
        const humedadValida = humedadDiaria.filter(v => v > -900);

        if (precipValida.length === 0) return null;

        const precipAnual = precipValida.reduce((a, b) => a + b, 0);
        const tempPromedio = tempValida.length > 0 ? tempValida.reduce((a, b) => a + b, 0) / tempValida.length : null;
        const humedadPromedio = humedadValida.length > 0 ? humedadValida.reduce((a, b) => a + b, 0) / humedadValida.length : null;

        const precipUlt30 = precipValida.slice(-30).reduce((a, b) => a + b, 0);
        const precipUlt90 = precipValida.slice(-90).reduce((a, b) => a + b, 0);

        const esperado30 = precipAnual * (30 / 365);
        const esperado90 = precipAnual * (90 / 365);

        // Indice de aridez de De Martonne: I = P / (T + 10)  [De Martonne, 1926]
        const indiceDeMartonne = tempPromedio !== null ? precipAnual / (tempPromedio + 10) : null;

        // Anomalia de precipitacion reciente respecto al propio promedio anual del punto
        // (aproximacion simplificada tipo SPI; no sustituye un calculo de SPI/SPEI completo)
        const anomalia90 = esperado90 > 0 ? ((precipUlt90 - esperado90) / esperado90) * 100 : 0;
        const anomalia30 = esperado30 > 0 ? ((precipUlt30 - esperado30) / esperado30) * 100 : 0;

        return { precipAnual, tempPromedio, humedadPromedio, indiceDeMartonne, anomalia90, anomalia30 };
    } catch (error) {
        console.error('Error consultando NASA POWER:', error);
        return null;
    }
}

// ========== OPENTOPODATA (SRTM 30m — NASA/USGS) ==========
// Consulta elevacion en el punto central + 4 puntos cardinales a ~1km.
// Con esos 5 valores calcula la pendiente maxima aproximada (%) y el rango
// de elevacion dentro del radio de 1km. Estos dos indicadores permiten
// clasificar si el terreno es accidentado y si tiene susceptibilidad a
// deslizamientos (pendiente elevada + señal climatica de exceso hidrico).
// Limite publico: 1 req/seg, 1000 req/dia — suficiente para uso academico.
async function consultarOpenTopoData(lat, lon) {
    try {
        const delta = 0.009; // ~1km a latitudes ecuatoriales
        const puntos = [
            lat + ',' + lon,
            (lat + delta) + ',' + lon,
            (lat - delta) + ',' + lon,
            lat + ',' + (lon + delta),
            lat + ',' + (lon - delta)
        ].join('|');

        const response = await fetch(OPENTOPODATA_BASE_URL + '?locations=' + puntos + '&interpolation=bilinear');
        if (!response.ok) throw new Error('OpenTopoData respondio HTTP ' + response.status);

        const data = await response.json();
        if (data.status !== 'OK' || !data.results || data.results.length < 5) return null;

        const elevaciones = data.results.map(r => r.elevation).filter(e => e !== null && e !== undefined);
        if (elevaciones.length < 3) return null;

        const elevCentro = elevaciones[0];
        const distanciaHorizontal = delta * 111000; // metros aprox (1 grado lat ~ 111km)

        // Pendiente maxima entre el centro y cada punto cardinal (%)
        const pendientes = elevaciones.slice(1).map(e => Math.abs(e - elevCentro) / distanciaHorizontal * 100);
        const pendienteMax = Math.max(...pendientes);
        const rangoElevacion = Math.max(...elevaciones) - Math.min(...elevaciones);

        return { elevCentro, pendienteMax, rangoElevacion };
    } catch (error) {
        console.error('Error consultando OpenTopoData:', error);
        return null;
    }
}

// ========== FIRMS (NASA LANCE/EOSDIS — via backend) ==========
// La MAP_KEY de FIRMS se mantiene en el .env del backend y nunca llega al
// cliente. Esta funcion llama al endpoint propio del backend que actua como
// proxy hacia la API de FIRMS (VIIRS S-NPP NRT, 375m de resolucion).
async function consultarFIRMS(lat, lon) {
    try {
        const response = await ApiClient.consultarIncendios(lat, lon);
        if (!response.success) return null;
        return {
            totalDetecciones: response.totalDetecciones,
            deteccionesCercanas: response.deteccionesCercanas,
            deteccionesZona: response.deteccionesZona,
            fechaReciente: response.fechaReciente
        };
    } catch (error) {
        console.error('Error consultando FIRMS:', error);
        return null;
    }
}

// ========== HWSD v2.0 (FAO/IIASA — via backend PostGIS) ==========
// Consulta conductividad electrica del extracto de saturacion (ECe) en dS/m
// del topsuelo (capa D1, 0-20 cm) a partir del raster HWSD importado en PostGIS.
// El backend hace ST_Value() sobre el raster y devuelve el atributo ELEC_COND
// de la tabla hwsd_layers. -9 = sentinel value HWSD (zona urbana / sin perfil).
// Referencia: FAO & IIASA (2023). HWSD v2.0. FAO, Rome.
//             Richards (1954). USDA Handbook 60. Umbral: ECe > 4 dS/m.
async function consultarHWSD(lat, lon) {
    try {
        const response = await ApiClient.fetch(`/hwsd/salinidad?lat=${lat}&lng=${lon}`);
        if (!response.success) return null;
        return {
            salinidad_ds_m: response.salinidad_ds_m,
            es_salino:      response.es_salino,
            nivel:          response.nivel,
            tipo_suelo:     response.tipo_suelo,
            mu_global:      response.mu_global,
            umbral_ds_m:    response.umbral_ds_m,
            mensaje:        response.mensaje,
            fuente:         response.fuente,
            referencia:     response.referencia
        };
    } catch (error) {
        console.error('Error consultando HWSD:', error);
        return null;
    }
}

// ========== EVALUACION POR TIPO DE FACTOR ==========
// ========== OVERPASS API (OpenStreetMap) — MINERÍA Y ACTIVIDAD EXTRACTIVA ==========
async function consultarOverpass(lat, lon) {
    const radio = 15000; // 15 km
    const query = `[out:json][timeout:20];
(
  node["landuse"~"quarry|mining"](around:${radio},${lat},${lon});
  way["landuse"~"quarry|mining"](around:${radio},${lat},${lon});
  relation["landuse"~"quarry|mining"](around:${radio},${lat},${lon});
  node["man_made"~"mine_shaft|petroleum_well|oil_well"](around:${radio},${lat},${lon});
  way["man_made"~"mine_shaft|petroleum_well|oil_well"](around:${radio},${lat},${lon});
  node["industrial"~"mine|smelting|chemical|oil|refinery|gas"](around:${radio},${lat},${lon});
  way["industrial"~"mine|smelting|chemical|oil|refinery|gas"](around:${radio},${lat},${lon});
  node["landuse"="industrial"](around:${radio},${lat},${lon});
  way["landuse"="industrial"](around:${radio},${lat},${lon});
);
out count;`;

    try {
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(query)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        const tags = data.elements?.[0]?.tags || {};
        const total = parseInt(tags.total || '0', 10);
        return { disponible: true, totalExtractivo: total, radio: radio / 1000 };
    } catch (err) {
        console.warn('[Overpass] Error:', err.message);
        return { disponible: false, totalExtractivo: 0, radio: radio / 1000 };
    }
}

function sinDatos(fuente) {
    return {
        veredicto: 'sin_datos',
        detalle: 'No se pudieron obtener datos de ' + fuente + ' para esta ubicacion (puede tratarse de una zona urbana, un cuerpo de agua, u otra area sin cobertura en la fuente).'
    };
}

function evaluarFactor(tipo, suelo, clima, topo, fires, hwsd, mineria) {
    switch (tipo) {
        case 'suelo_salinizado': {
            // Conductividad electrica del extracto de saturacion (ECe) medida
            // directamente en el ráster FAO/IIASA HWSD v2.0 (capa D1, 0-20 cm),
            // almacenado localmente en PostGIS. ECe es el indicador directo de
            // salinidad del suelo: > 4 dS/m = salino segun Richards (1954).
            // Reemplaza el proxy anterior (pH + indice De Martonne) por el dato real.
            if (!hwsd) return sinDatos('FAO/IIASA HWSD v2.0');

            if (hwsd.salinidad_ds_m === null) {
                return {
                    veredicto: 'sin_datos',
                    detalle: hwsd.mensaje || 'Sin datos HWSD para esta ubicacion (posible zona urbana o cuerpo de agua).'
                };
            }

            const ec     = hwsd.salinidad_ds_m;
            const UMBRAL = hwsd.umbral_ds_m || 4.0;
            const tipo_s = hwsd.tipo_suelo  || '—';
            const nivel  = hwsd.nivel       || '—';

            if (ec > UMBRAL) {
                return { veredicto: 'coincide', detalle: 'ECe topsuelo (0-20 cm): ' + ec.toFixed(2) + ' dS/m — ' + nivel + '. Supera el umbral FAO de salinizacion agricola (>' + UMBRAL + ' dS/m). Tipo de suelo FAO-90: ' + tipo_s + '. Codigo HWSD: SMU ' + (hwsd.mu_global || '—') + '. Fuente: ' + (hwsd.fuente || 'FAO/IIASA HWSD v2.0') + '.' };
            }
            if (ec > 2) {
                return { veredicto: 'parcial', detalle: 'ECe topsuelo (0-20 cm): ' + ec.toFixed(2) + ' dS/m — ' + nivel + '. No supera el umbral de salinizacion agricola (>' + UMBRAL + ' dS/m) pero indica presencia de sales. Tipo de suelo FAO-90: ' + tipo_s + '.' };
            }
            return { veredicto: 'no_coincide', detalle: 'ECe topsuelo (0-20 cm): ' + ec.toFixed(2) + ' dS/m — ' + nivel + '. Sin indicios de salinizacion segun datos HWSD v2.0 (FAO). Tipo de suelo FAO-90: ' + tipo_s + '.' };
        }
        case 'baja_fertilidad': {
            // Umbral SOC < 15 g/kg validado por meta-analisis global + experimentos
            // de campo multi-continentales (Yang et al., Nature Communications 2025).
            // CEC < 5 cmol(+)/kg = clasificacion de baja capacidad de retencion de
            // nutrientes (AGVISE Laboratories, Soil Science Review: CEC).
            if (!suelo || suelo.soc === undefined) return sinDatos('SoilGrids');
            const socBajo = suelo.soc < 15;
            const cecBaja = suelo.cec !== undefined && suelo.cec < 5;
            if (socBajo && cecBaja) return { veredicto: 'coincide', detalle: 'Carbono organico ' + suelo.soc.toFixed(1) + ' g/kg (umbral de referencia: 15 g/kg) y CEC ' + suelo.cec.toFixed(1) + ' cmol(+)/kg, ambos bajos -- consistente con baja fertilidad.' };
            if (socBajo || cecBaja) return { veredicto: 'parcial', detalle: 'Carbono organico ' + suelo.soc.toFixed(1) + ' g/kg -- indicio parcial de baja fertilidad (un solo indicador confirma).' };
            return { veredicto: 'no_coincide', detalle: 'Carbono organico ' + suelo.soc.toFixed(1) + ' g/kg y CEC ' + (suelo.cec !== undefined ? suelo.cec.toFixed(1) : '?') + ' cmol(+)/kg -- niveles consistentes con fertilidad aceptable.' };
        }
        case 'erosion_suelo': {
            // Proxy simplificado basado en los mismos insumos de textura y materia
            // organica que usa el nomograma de erodabilidad K de la USLE/RUSLE
            // (Wischmeier & Smith, 1978); no se calcula el factor K completo porque
            // SoilGrids no reporta clase de estructura ni de permeabilidad.
            if (!suelo || suelo.sand === undefined) return sinDatos('SoilGrids');
            const arenoso = suelo.sand > 60;
            const pocaMO = suelo.soc !== undefined && suelo.soc < 15;
            if (arenoso && pocaMO) return { veredicto: 'coincide', detalle: 'Suelo arenoso (' + suelo.sand.toFixed(0) + '% arena) con baja materia organica -- ambos factores aumentan la erodabilidad segun el enfoque de textura+MO de la USLE/RUSLE.' };
            if (arenoso || pocaMO) return { veredicto: 'parcial', detalle: 'Composicion del suelo con cierta susceptibilidad a erosion (' + suelo.sand.toFixed(0) + '% arena, ' + (suelo.soc !== undefined ? suelo.soc.toFixed(1) : '?') + ' g/kg de carbono organico).' };
            return { veredicto: 'no_coincide', detalle: 'Textura del suelo (' + suelo.sand.toFixed(0) + '% arena) con menor susceptibilidad a erosion.' };
        }
        case 'suelo_blando': {
            // Rango tipico de densidad aparente en suelos no disturbados: 1.0-1.4
            // g/cm3 (NRCS Soil Quality Indicators - Bulk Density; SDSU Extension).
            // Valores por debajo de ese rango indican suelo suelto/poroso, a menudo
            // con alta materia organica.
            if (!suelo || suelo.bdod === undefined) return sinDatos('SoilGrids');
            if (suelo.bdod < 1.0) return { veredicto: 'coincide', detalle: 'Densidad aparente ' + suelo.bdod.toFixed(2) + ' kg/dm3, por debajo del rango tipico de suelos no disturbados (1.0-1.4) -- compatible con suelo blando/poco compactado.' };
            if (suelo.bdod < 1.3) return { veredicto: 'parcial', detalle: 'Densidad aparente ' + suelo.bdod.toFixed(2) + ' kg/dm3 -- dentro del rango tipico, no concluyente.' };
            return { veredicto: 'no_coincide', detalle: 'Densidad aparente ' + suelo.bdod.toFixed(2) + ' kg/dm3 -- en el extremo superior o por encima del rango tipico, compatible con suelo compactado/firme.' };
        }
        case 'sequia': {
            if (!clima) return sinDatos('NASA POWER');
            if (clima.anomalia90 <= -50) return { veredicto: 'coincide', detalle: 'Precipitacion de los ultimos 90 dias ' + clima.anomalia90.toFixed(0) + '% por debajo del promedio anual de la zona -- señal de sequia.' };
            if (clima.anomalia90 <= -20) return { veredicto: 'parcial', detalle: 'Deficit de precipitacion moderado (' + clima.anomalia90.toFixed(0) + '% vs. promedio anual).' };
            return { veredicto: 'no_coincide', detalle: 'Precipitacion reciente dentro de rango normal (' + clima.anomalia90.toFixed(0) + '% vs. promedio anual).' };
        }
        case 'aridez_climatica': {
            if (!clima || clima.indiceDeMartonne === null) return sinDatos('NASA POWER');
            const I = clima.indiceDeMartonne;
            if (I < 20) return { veredicto: 'coincide', detalle: 'Indice de aridez de De Martonne = ' + I.toFixed(1) + ' (clima arido/semiarido).' };
            if (I < 28) return { veredicto: 'parcial', detalle: 'Indice de De Martonne = ' + I.toFixed(1) + ' (clima sub-humedo, zona de transicion).' };
            return { veredicto: 'no_coincide', detalle: 'Indice de De Martonne = ' + I.toFixed(1) + ' (clima humedo, poco compatible con aridez).' };
        }
        case 'aguas_estancadas': {
            // Se cruza la señal climatica (exceso de precipitacion reciente +
            // humedad relativa) con el contenido de arcilla del suelo: los suelos
            // arcillosos drenan peor y retienen mas agua superficial, favoreciendo
            // el encharcamiento (principio basico de hidrologia de suelos).
            if (!clima) return sinDatos('NASA POWER');
            const humedad = clima.humedadPromedio !== null ? clima.humedadPromedio : 0;
            const excesoLluvia = clima.anomalia30 >= 40;
            const arcilloso = suelo && suelo.clay !== undefined && suelo.clay > 35;

            if (excesoLluvia && (humedad >= 70 || arcilloso)) {
                const detalleArcilla = arcilloso ? (', suelo arcilloso (' + suelo.clay.toFixed(0) + '% arcilla) con drenaje limitado') : '';
                return { veredicto: 'coincide', detalle: 'Precipitacion de los ultimos 30 dias ' + clima.anomalia30.toFixed(0) + '% sobre el promedio, humedad relativa ' + humedad.toFixed(0) + '%' + detalleArcilla + ' -- condiciones favorables a encharcamiento.' };
            }
            if (excesoLluvia || humedad >= 75 || arcilloso) {
                return { veredicto: 'parcial', detalle: 'Condiciones de humedad elevadas, sin ser concluyentes (precip. ' + clima.anomalia30.toFixed(0) + '%, humedad ' + humedad.toFixed(0) + '%' + (arcilloso ? ', suelo arcilloso' : '') + ').' };
            }
            return { veredicto: 'no_coincide', detalle: 'Sin señales recientes de exceso hidrico (precip. ' + clima.anomalia30.toFixed(0) + '% vs. promedio, sin suelo de drenaje limitado).' };
        }
        case 'topografia_accidentada': {
            // Clasificacion basada en pendiente aproximada calculada a partir de
            // elevaciones SRTM (30m) en un radio de ~1km. Umbrales adaptados de la
            // clasificacion de pendientes del USGS (National Landslide Hazards Program):
            // <5% plano, 5-10% suavemente inclinado, 10-20% moderadamente empinado,
            // >20% empinado/muy accidentado.
            if (!topo) return sinDatos('OpenTopoData (SRTM/NASA)');
            if (topo.pendienteMax > 20 || topo.rangoElevacion > 300) {
                return { veredicto: 'coincide', detalle: 'Pendiente maxima ~' + topo.pendienteMax.toFixed(1) + '% y rango de elevacion ' + topo.rangoElevacion.toFixed(0) + 'm en radio de 1km -- compatible con topografia accidentada/empinada (USGS: >20% = empinado).' };
            }
            if (topo.pendienteMax > 10 || topo.rangoElevacion > 100) {
                return { veredicto: 'parcial', detalle: 'Pendiente maxima ~' + topo.pendienteMax.toFixed(1) + '% y rango de elevacion ' + topo.rangoElevacion.toFixed(0) + 'm -- terreno moderadamente inclinado, no totalmente accidentado.' };
            }
            return { veredicto: 'no_coincide', detalle: 'Pendiente maxima ~' + topo.pendienteMax.toFixed(1) + '% y rango de elevacion ' + topo.rangoElevacion.toFixed(0) + 'm -- terreno relativamente plano o suavemente inclinado.' };
        }
        case 'deslizamientos': {
            // Pendiente elevada es el factor topografico principal de susceptibilidad
            // a deslizamientos; combinada con exceso de precipitacion reciente aumenta
            // significativamente el riesgo (USGS Landslide Hazards Program; Hungr et
            // al. 2014, Landslides).
            if (!topo) return sinDatos('OpenTopoData (SRTM/NASA)');
            const pendienteAlta = topo.pendienteMax > 15;
            const excesoPrecip = clima && clima.anomalia90 >= 20;
            if (pendienteAlta && excesoPrecip) {
                return { veredicto: 'coincide', detalle: 'Pendiente ~' + topo.pendienteMax.toFixed(1) + '% (alta) con precipitacion de los ultimos 90 dias ' + clima.anomalia90.toFixed(0) + '% sobre el promedio -- combinacion de riesgo clasica para deslizamientos (USGS).' };
            }
            if (pendienteAlta || excesoPrecip) {
                const det = pendienteAlta
                    ? 'Pendiente ~' + topo.pendienteMax.toFixed(1) + '% (alta), pero sin exceso de precipitacion reciente que la active.'
                    : 'Exceso de precipitacion reciente (' + clima.anomalia90.toFixed(0) + '%), pero la pendiente (~' + topo.pendienteMax.toFixed(1) + '%) no es suficientemente alta para deslizamientos tipicos.';
                return { veredicto: 'parcial', detalle: det };
            }
            return { veredicto: 'no_coincide', detalle: 'Pendiente ~' + topo.pendienteMax.toFixed(1) + '% y precipitacion dentro del rango normal -- sin condiciones topograficas ni climaticas tipicas de deslizamientos.' };
        }
        case 'areas_quemadas': {
            // Detecciones satelitales de incendios activos via VIIRS S-NPP (375m de
            // resolucion) de NASA LANCE/EOSDIS. Datos NRT (Near Real Time) de los
            // ultimos 10 dias. Umbral de confianza: se excluyen detecciones de baja
            // confianza ('l') para reducir falsas alarmas.
            if (!fires) return sinDatos('NASA FIRMS');
            const { deteccionesCercanas, deteccionesZona, fechaReciente } = fires;
            const fechaStr = fechaReciente ? ' (ultima deteccion: ' + fechaReciente + ')' : '';
            if (deteccionesCercanas >= 2) {
                return { veredicto: 'coincide', detalle: deteccionesCercanas + ' detecciones satelitales de incendio activo en radio de ~10km en los ultimos 10 dias' + fechaStr + ' (NASA FIRMS/VIIRS S-NPP NRT).' };
            }
            if (deteccionesCercanas >= 1 || deteccionesZona >= 3) {
                return { veredicto: 'parcial', detalle: (deteccionesCercanas >= 1 ? '1 deteccion cercana' : deteccionesZona + ' detecciones en radio de ~50km') + ' en los ultimos 10 dias' + fechaStr + ' -- actividad de incendio proxima pero no sobre la ubicacion exacta.' };
            }
            return { veredicto: 'no_coincide', detalle: 'Sin detecciones satelitales de incendio activo en radio de ~50km en los ultimos 10 dias (NASA FIRMS/VIIRS S-NPP NRT).' };
        }
        case 'mineria_activa': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 3) return { veredicto: 'coincide', detalle: mineria.totalExtractivo + ' instalaciones mineras/extractivas registradas en un radio de ' + mineria.radio + 'km (OSM Overpass). Alta densidad de actividad extractiva.' };
            if (mineria.totalExtractivo >= 1) return { veredicto: 'parcial', detalle: mineria.totalExtractivo + ' instalacion(es) extractiva(s) detectada(s) en radio de ' + mineria.radio + 'km — presencia de actividad minera proxima.' };
            return { veredicto: 'no_coincide', detalle: 'Sin instalaciones extractivas registradas en OSM en radio de ' + mineria.radio + 'km. Nota: la cobertura OSM puede ser incompleta en zonas remotas.' };
        }
        case 'relaves_mineros': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            const hayMineria = mineria.totalExtractivo > 0;
            const sueloAlterado = suelo && suelo.soc !== undefined && suelo.soc < 10;
            if (hayMineria && sueloAlterado) return { veredicto: 'coincide', detalle: 'Actividad extractiva detectada (' + mineria.totalExtractivo + ' instalaciones) + carbono organico del suelo bajo (' + suelo.soc.toFixed(1) + ' g/kg) — condiciones compatibles con depositos de relaves.' };
            if (hayMineria) return { veredicto: 'parcial', detalle: 'Actividad extractiva en la zona (' + mineria.totalExtractivo + ' instalaciones) — riesgo de relaves presente, sin confirmacion del estado del suelo.' };
            return { veredicto: 'no_coincide', detalle: 'Sin actividad extractiva registrada en OSM en radio de ' + mineria.radio + 'km.' };
        }
        case 'contaminacion_mercurio': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 2) return { veredicto: 'coincide', detalle: mineria.totalExtractivo + ' instalaciones extractivas detectadas — alta probabilidad de uso de mercurio en mineria artesanal segun patrones globales (UNEP Global Mercury Assessment 2023).' };
            if (mineria.totalExtractivo >= 1) return { veredicto: 'parcial', detalle: '1 instalacion extractiva detectada — posible riesgo de contaminacion por mercurio si es mineria de oro.' };
            return { veredicto: 'no_coincide', detalle: 'Sin instalaciones extractivas en radio de ' + mineria.radio + 'km en OSM.' };
        }
        case 'contaminacion_metales': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 1) return { veredicto: mineria.totalExtractivo >= 2 ? 'coincide' : 'parcial', detalle: mineria.totalExtractivo + ' fuente(s) extractiva(s)/industrial(es) detectada(s) — vector potencial de metales pesados en suelo y agua segun EPA Mining and Ore Processing guidelines.' };
            return { veredicto: 'no_coincide', detalle: 'Sin fuentes extractivas registradas en OSM en radio de ' + mineria.radio + 'km.' };
        }
        case 'deforestacion_minera': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 1) return { veredicto: 'coincide', detalle: 'Actividad minera/extractiva detectada en la zona (' + mineria.totalExtractivo + ' instalaciones en radio de ' + mineria.radio + 'km) — la apertura de minas conlleva perdida directa de cobertura vegetal (IPBES Land Degradation Assessment 2018).' };
            return { veredicto: 'no_coincide', detalle: 'Sin actividad extractiva registrada en OSM que explique deforestacion de origen minero en radio de ' + mineria.radio + 'km.' };
        }
        case 'contaminacion_acuiferos': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            const hayFuente = mineria.totalExtractivo > 0;
            const altaPrecip = clima && clima.anomalia90 !== undefined && clima.anomalia90 > 10;
            if (hayFuente && altaPrecip) return { veredicto: 'coincide', detalle: 'Instalaciones extractivas detectadas (' + mineria.totalExtractivo + ') + precipitacion elevada — la infiltracion pluvial puede arrastrar contaminantes hacia acuiferos.' };
            if (hayFuente) return { veredicto: 'parcial', detalle: 'Actividad extractiva en la zona — riesgo de contaminacion de acuiferos presente segun EPA Underground Injection Control Program.' };
            return { veredicto: 'no_coincide', detalle: 'Sin fuentes extractivas identificadas en OSM en radio de ' + mineria.radio + 'km.' };
        }
        case 'riesgo_explosion': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 2) return { veredicto: 'coincide', detalle: mineria.totalExtractivo + ' instalaciones extractivas/mineras detectadas en radio de ' + mineria.radio + 'km — las operaciones de canteras y minas tipicamente usan explosivos (ISEE Blasting Guidelines).' };
            if (mineria.totalExtractivo >= 1) return { veredicto: 'parcial', detalle: '1 instalacion extractiva detectada — posible uso de explosivos en la zona.' };
            return { veredicto: 'no_coincide', detalle: 'Sin instalaciones mineras registradas en OSM en radio de ' + mineria.radio + 'km.' };
        }
        case 'subsidencia': {
            if (!mineria || !suelo) return sinDatos('SoilGrids + Overpass API');
            const hayMineria = mineria.disponible && mineria.totalExtractivo > 0;
            const bdodBajo = suelo.bdod !== undefined && suelo.bdod < 1.1;
            if (hayMineria && bdodBajo) return { veredicto: 'coincide', detalle: 'Actividad extractiva detectada (' + mineria.totalExtractivo + ' instalaciones) + baja densidad aparente del suelo (' + suelo.bdod.toFixed(2) + ' kg/dm3) — condiciones compatibles con subsidencia por extraccion subterranea.' };
            if (hayMineria) return { veredicto: 'parcial', detalle: 'Actividad extractiva detectada (' + mineria.totalExtractivo + ' instalaciones) — riesgo de subsidencia presente, datos de suelo no concluyentes.' };
            if (bdodBajo) return { veredicto: 'parcial', detalle: 'Densidad aparente baja (' + suelo.bdod.toFixed(2) + ' kg/dm3) pero sin actividad extractiva registrada en OSM.' };
            return { veredicto: 'no_coincide', detalle: 'Sin indicadores de subsidencia: sin actividad extractiva en OSM ni densidad aparente anomala.' };
        }
        case 'contaminacion_petrolera': {
            if (!mineria || !mineria.disponible) return sinDatos('OpenStreetMap Overpass API');
            if (mineria.totalExtractivo >= 2) return { veredicto: 'coincide', detalle: mineria.totalExtractivo + ' instalaciones industriales/extractivas detectadas en radio de ' + mineria.radio + 'km — fuentes potenciales de hidrocarburos en suelo y agua (EPA Petroleum Brownfields).' };
            if (mineria.totalExtractivo >= 1) return { veredicto: 'parcial', detalle: '1 instalacion industrial/extractiva detectada — riesgo moderado de contaminacion por hidrocarburos.' };
            return { veredicto: 'no_coincide', detalle: 'Sin instalaciones petroleras/industriales registradas en OSM en radio de ' + mineria.radio + 'km.' };
        }
        default:
            return sinDatos('fuente desconocida');
    }
}

// ========== ORQUESTADOR PRINCIPAL ==========
async function validarCientificamente(lat, lon, risks) {
    const validables = identificarFactoresValidables(risks);

    if (validables.length === 0) {
        return { sinMapeo: true, total: risks.length, validados: [], noValidados: risks.length, porcentaje: null };
    }

    const necesitaSoilGrids    = validables.some(v => v.mapeo.fuentes.includes('soilgrids'));
    const necesitaNasaPower    = validables.some(v => v.mapeo.fuentes.includes('nasapower'));
    const necesitaOpenTopoData = validables.some(v => v.mapeo.fuentes.includes('opentopodata'));
    const necesitaFIRMS        = validables.some(v => v.mapeo.fuentes.includes('firms'));
    const necesitaHWSD         = validables.some(v => v.mapeo.fuentes.includes('hwsd'));
    const necesitaOverpass     = validables.some(v => v.mapeo.fuentes.includes('overpass'));

    const [datosSuelo, datosClima, datosTopo, datosIncendios, datosHWSD, datosMineria] = await Promise.all([
        necesitaSoilGrids    ? consultarSoilGrids(lat, lon)    : Promise.resolve(null),
        necesitaNasaPower    ? consultarNasaPower(lat, lon)    : Promise.resolve(null),
        necesitaOpenTopoData ? consultarOpenTopoData(lat, lon) : Promise.resolve(null),
        necesitaFIRMS        ? consultarFIRMS(lat, lon)        : Promise.resolve(null),
        necesitaHWSD         ? consultarHWSD(lat, lon)         : Promise.resolve(null),
        necesitaOverpass     ? consultarOverpass(lat, lon)     : Promise.resolve(null)
    ]);

    const etiquetasFuente = {
        soilgrids:    'SoilGrids (ISRIC)',
        nasapower:    'NASA POWER',
        opentopodata: 'OpenTopoData (SRTM/NASA)',
        firms:        'NASA FIRMS (VIIRS)',
        hwsd:         'FAO/IIASA HWSD v2.0',
        overpass:     'OpenStreetMap Overpass API'
    };

    const resultados = validables.map(v => {
        const evaluacion = evaluarFactor(v.mapeo.tipo, datosSuelo, datosClima, datosTopo, datosIncendios, datosHWSD, datosMineria);
        return {
            nombre: v.risk.name,
            fuente: v.mapeo.fuentes.map(f => etiquetasFuente[f]).join(' + '),
            veredicto: evaluacion.veredicto,
            detalle: evaluacion.detalle
        };
    });

    const conDatos = resultados.filter(r => r.veredicto !== 'sin_datos');
    const puntos = conDatos.reduce((acc, r) => {
        if (r.veredicto === 'coincide') return acc + 1;
        if (r.veredicto === 'parcial') return acc + 0.5;
        return acc;
    }, 0);
    const porcentaje = conDatos.length > 0 ? Math.round((puntos / conDatos.length) * 100) : null;

    return {
        sinMapeo: false,
        total: risks.length,
        validados: resultados,
        conDatos: conDatos.length,
        noValidados: risks.length - validables.length,
        porcentaje
    };
}

// ========== RENDER HTML ==========
function renderValidacionHTML(resultado) {
    const titulo = '<h4>🔬 Validación con Datos Científicos</h4>';

    if (resultado.sinMapeo) {
        return titulo + '<p class="validacion-info">Ninguno de los factores seleccionados cuenta aun con una fuente de datos cientificos automatizada (SoilGrids / NASA POWER).</p>';
    }

    const iconos = { coincide: '✅', parcial: '⚠️', no_coincide: '❌', sin_datos: '➖' };

    let itemsHtml = '';
    resultado.validados.forEach(r => {
        itemsHtml += '<div class="validacion-item">' +
            '<div class="validacion-item-header">' +
            '<span>' + iconos[r.veredicto] + ' <strong>' + r.nombre + '</strong></span>' +
            '<span class="validacion-fuente">' + r.fuente + '</span>' +
            '</div>' +
            '<div class="validacion-detalle">' + r.detalle + '</div>' +
            '</div>';
    });

    let resumenHtml = '';
    if (resultado.porcentaje !== null) {
        resumenHtml = '<div class="validacion-resumen">Coincidencia con datos cientificos: <strong>' + resultado.porcentaje + '%</strong> &mdash; calculado sobre ' + resultado.conDatos + ' factor(es) con datos obtenidos en esta ubicacion (de ' + resultado.validados.length + ' factor(es) seleccionados que cuentan con una fuente de validacion disponible).</div>';
    } else {
        resumenHtml = '<div class="validacion-resumen">' + resultado.validados.length + ' factor(es) seleccionados cuentan con una fuente de validacion, pero ninguno obtuvo datos para esta ubicacion especifica.</div>';
    }

    let nota = '';
    if (resultado.noValidados > 0) {
        nota = '<p class="validacion-nota">' + resultado.noValidados + ' factor(es) seleccionados no cuentan aun con fuente de datos cientificos automatizada.</p>';
    }

    return titulo + resumenHtml + itemsHtml + nota +
        '<p class="validacion-disclaimer">Validacion basada en datos abiertos de SoilGrids (ISRIC), NASA POWER, OpenTopoData (SRTM/NASA), NASA FIRMS (VIIRS S-NPP NRT) y OpenStreetMap Overpass API. Es un indicador de apoyo y no sustituye un estudio de suelo, topografico, hidrologico, forestal o ambiental in situ. La cobertura de OSM puede ser incompleta en zonas remotas o de mineria informal.</p>';
}

// ========== ESTILOS (inyectados para no depender de sig-pro-styles.css) ==========
(function inyectarEstilosValidacion() {
    if (document.getElementById('validacion-cientifica-styles')) return;
    const style = document.createElement('style');
    style.id = 'validacion-cientifica-styles';
    style.textContent = `
        .validacion-cientifica-section { margin-top: 20px; padding-top: 16px; border-top: 1px dashed #cbd5e1; }
        .validacion-item { background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
        .validacion-item-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.9em; }
        .validacion-fuente { font-size: 0.72em; color: #64748b; white-space: nowrap; }
        .validacion-detalle { font-size: 0.82em; color: #475569; margin-top: 4px; line-height: 1.4; }
        .validacion-resumen { background: #eff6ff; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; font-size: 0.9em; color: #1e3a8a; }
        .validacion-nota, .validacion-disclaimer, .validacion-info { font-size: 0.78em; color: #94a3b8; margin-top: 8px; }
        .validacion-loading { font-size: 0.85em; color: #64748b; font-style: italic; }
    `;
    document.head.appendChild(style);
})();

window.validarCientificamente = validarCientificamente;
window.renderValidacionHTML = renderValidacionHTML;
