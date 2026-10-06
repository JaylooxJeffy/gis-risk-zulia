const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verificarToken } = require('../middleware/auth');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT) || 5432,
});

/**
 * GET /api/hwsd/salinidad?lat=X&lng=Y
 *
 * Devuelve conductividad eléctrica del extracto de saturación (ECe)
 * del topsuelo (capa D1, 0–20 cm) en dS/m, leída del ráster HWSD v2.0
 * importado en PostGIS + tabla de atributos hwsd_layers.
 *
 * Umbral salinidad agrícola: ECe > 4 dS/m
 * -9 = sentinel value HWSD = sin dato (zonas urbanas o sin perfil)
 *
 * Referencias:
 *   FAO & IIASA (2023). Harmonized World Soil Database v2.0. FAO, Rome.
 *   Richards, L.A. (1954). Diagnosis and Improvement of Saline and
 *     Alkali Soils. USDA Agriculture Handbook No. 60.
 */
router.get('/salinidad', verificarToken, async (req, res) => {
  const lng = parseFloat(req.query.lng);
  const lat = parseFloat(req.query.lat);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      error: 'Parámetros lat y lng requeridos y deben ser numéricos'
    });
  }

  try {
    /*
     * CTE en dos pasos:
     * 1. 'mu' → extrae el código HWSD2_SMU_ID del ráster en el punto dado
     * 2. JOIN con hwsd_layers → recupera ECe de la capa D1 (0–20 cm)
     *
     * ST_MakePoint recibe (lng, lat) — orden X, Y en PostGIS
     */
    const sql = `
      WITH punto AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS geom
      ),
      mu AS (
        SELECT ST_Value(r.rast, p.geom)::integer AS smu_id
        FROM hwsd_raster r, punto p
        WHERE ST_Intersects(r.rast, p.geom)
        LIMIT 1
      )
      SELECT
        m.smu_id,
        l.fao90,
        l.layer,
        l.topdep,
        l.botdep,
        l.elec_cond::numeric AS elec_cond
      FROM mu m
      LEFT JOIN hwsd_layers l
        ON l.hwsd2_smu_id = m.smu_id
        AND l.layer = 'D1'
      WHERE m.smu_id IS NOT NULL
        AND m.smu_id > 0
      LIMIT 1;
    `;

    const result = await pool.query(sql, [lng, lat]);

    // Sin cobertura HWSD (agua, fuera de bbox Venezuela, etc.)
    if (!result.rows.length || result.rows[0].smu_id === null) {
      return res.json({
        salinidad_ds_m: null,
        es_salino:      false,
        nivel:          'Sin datos',
        fuente:         'FAO/IIASA HWSD v2.0',
        mensaje:        'Ubicación fuera de cobertura HWSD o cuerpo de agua.',
        referencia:     'FAO & IIASA (2023). HWSD v2.0. FAO, Rome.'
      });
    }

    const { smu_id, fao90, elec_cond } = result.rows[0];
    const ec = parseFloat(elec_cond);

    // -9 = sentinel value HWSD = sin dato (urbano o unidad sin perfil)
    if (ec === -9 || isNaN(ec)) {
      return res.json({
        mu_global:      smu_id,
        tipo_suelo:     fao90 || '—',
        salinidad_ds_m: null,
        es_salino:      false,
        nivel:          fao90 === 'UR' ? 'Área urbana' : 'Sin datos de perfil',
        fuente:         'FAO/IIASA HWSD v2.0',
        mensaje:        fao90 === 'UR'
          ? 'Zona urbana — HWSD no registra perfil de suelo para áreas urbanizadas.'
          : 'Sin datos de conductividad eléctrica para esta unidad cartográfica.',
        referencia:     'FAO & IIASA (2023). HWSD v2.0. FAO, Rome.'
      });
    }

    const UMBRAL = 4.0; // dS/m — estándar FAO (Richards, 1954)

    const nivel =
      ec <= 2   ? 'No salino'
      : ec <= 4 ? 'Ligeramente salino'
      : ec <= 8 ? 'Moderadamente salino'
                : 'Fuertemente salino';

    return res.json({
      mu_global:      smu_id,
      tipo_suelo:     fao90 || '—',
      salinidad_ds_m: ec,
      umbral_ds_m:    UMBRAL,
      es_salino:      ec > UMBRAL,
      nivel,
      fuente:         'FAO/IIASA Harmonized World Soil Database v2.0',
      referencia:     'FAO & IIASA (2023). HWSD v2.0. FAO, Rome. & Richards (1954). USDA Handbook 60.',
      descripcion:    `ECe topsuelo (0–20 cm): ${ec.toFixed(2)} dS/m — ${nivel}. ` +
                      `Tipo de suelo FAO-90: ${fao90 || '—'}. ` +
                      `Código HWSD: SMU ${smu_id}. ` +
                      `Umbral salinidad agrícola: >${UMBRAL} dS/m.`
    });

  } catch (err) {
    console.error('[HWSD] Error en consulta PostGIS:', err.message);
    return res.status(500).json({
      error:   'Error consultando HWSD en base de datos local',
      detalle: err.message
    });
  }
});

module.exports = router;
