// ============================================================================
// FIRMS CONTROLLER — NASA Fire Information for Resource Management System
// Consulta incendios activos vía satélite VIIRS (Suomi NPP) en un radio de
// ~50km alrededor de las coordenadas. La MAP_KEY de FIRMS se mantiene en
// el backend (.env) y nunca se expone al cliente.
// Fuente citable: NASA/LANCE/EOSDIS, VIIRS S-NPP 375m NRT
// ============================================================================

const https = require('https');

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

function parsearCSVFIRMS(csv) {
    const lineas = csv.trim().split('\n');
    if (lineas.length < 2) return [];
    const headers = lineas[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lineas.slice(1)
        .filter(l => l.trim().length > 0)
        .map(linea => {
            const valores = linea.split(',').map(v => v.trim().replace(/"/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
            return obj;
        });
}

function distanciaGrados(lat1, lng1, lat2, lng2) {
    const dlat = parseFloat(lat1) - parseFloat(lat2);
    const dlng = parseFloat(lng1) - parseFloat(lng2);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

class FirmsController {
    static async consultarIncendios(req, res) {
        const { lat, lng } = req.query;

        if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
            return res.status(400).json({ error: 'Coordenadas inválidas' });
        }

        const mapKey = process.env.FIRMS_MAP_KEY;
        if (!mapKey) {
            return res.status(500).json({ error: 'FIRMS_MAP_KEY no configurada en el servidor' });
        }

        const latF = parseFloat(lat);
        const lngF = parseFloat(lng);
        const delta = 0.45; // ~50km

        const W = (lngF - delta).toFixed(6);
        const S = (latF - delta).toFixed(6);
        const E = (lngF + delta).toFixed(6);
        const N = (latF + delta).toFixed(6);
        const area = `${W},${S},${E},${N}`;

        // VIIRS S-NPP NRT: resolución 375m, disponibilidad dentro de las 3h
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_SNPP_NRT/${area}/10`;

        try {
            const { status, body } = await httpGet(url);

            if (status !== 200) {
                return res.status(502).json({ error: 'Error al consultar FIRMS (HTTP ' + status + ')' });
            }

            const detecciones = parsearCSVFIRMS(body);

            // Separar por proximidad al punto de interés
            const RADIO_CERCANO = 0.09;  // ~10km
            const RADIO_ZONA = 0.45;     // ~50km

            const cercanas = detecciones.filter(d => {
                const dist = distanciaGrados(d.latitude, d.longitude, latF, lngF);
                const confianza = (d.confidence || '').toLowerCase();
                return dist <= RADIO_CERCANO && confianza !== 'l';
            });

            const enZona = detecciones.filter(d => {
                const dist = distanciaGrados(d.latitude, d.longitude, latF, lngF);
                return dist <= RADIO_ZONA;
            });

            res.json({
                success: true,
                totalDetecciones: detecciones.length,
                deteccionesCercanas: cercanas.length,
                deteccionesZona: enZona.length,
                // Fecha más reciente de detección en la zona (para el detalle del veredicto)
                fechaReciente: enZona.length > 0
                    ? enZona.sort((a, b) => b.acq_date > a.acq_date ? 1 : -1)[0].acq_date
                    : null
            });
        } catch (error) {
            console.error('Error al consultar FIRMS:', error);
            res.status(500).json({ error: 'Error interno al consultar FIRMS' });
        }
    }
}

module.exports = FirmsController;
