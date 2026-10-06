const pool = require('../config/database');

class AnalistaController {

    static async guardarUbicacion(req, res) {
        const usuarioId = req.usuario.id;
        const { nombre, direccion, municipio, lat, lng, notas, factores, nivel_riesgo, color_riesgo, recomendacion, validacion } = req.body;

        if (!nombre || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Nombre y coordenadas son obligatorios' });
        }

        try {
            const result = await pool.query(
                `INSERT INTO ubicaciones_guardadas
                 (usuario_id, nombre, direccion, municipio, lat, lng, notas, factores, nivel_riesgo, color_riesgo, recomendacion, validacion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                 RETURNING *`,
                [
                    usuarioId, nombre, direccion || null, municipio || null,
                    lat, lng, notas || '',
                    JSON.stringify(factores || []),
                    nivel_riesgo || null, color_riesgo || null,
                    recomendacion || null,
                    validacion ? JSON.stringify(validacion) : null
                ]
            );
            res.status(201).json({ success: true, ubicacion: result.rows[0] });
        } catch (error) {
            console.error('Error al guardar ubicacion:', error);
            res.status(500).json({ error: 'Error al guardar ubicación' });
        }
    }

    static async listarUbicaciones(req, res) {
        const usuarioId = req.usuario.id;
        try {
            const result = await pool.query(
                'SELECT * FROM ubicaciones_guardadas WHERE usuario_id = $1 ORDER BY fecha_guardado DESC',
                [usuarioId]
            );
            res.json({ success: true, ubicaciones: result.rows });
        } catch (error) {
            console.error('Error al listar ubicaciones:', error);
            res.status(500).json({ error: 'Error al obtener ubicaciones' });
        }
    }

    static async actualizarNotas(req, res) {
        const { id } = req.params;
        const usuarioId = req.usuario.id;
        const { notas } = req.body;

        try {
            const result = await pool.query(
                'UPDATE ubicaciones_guardadas SET notas = $1 WHERE id = $2 AND usuario_id = $3 RETURNING *',
                [notas || '', id, usuarioId]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Ubicación no encontrada' });
            res.json({ success: true, ubicacion: result.rows[0] });
        } catch (error) {
            console.error('Error al actualizar notas:', error);
            res.status(500).json({ error: 'Error al actualizar notas' });
        }
    }

    static async eliminarUbicacion(req, res) {
        const { id } = req.params;
        const usuarioId = req.usuario.id;

        try {
            const result = await pool.query(
                'DELETE FROM ubicaciones_guardadas WHERE id = $1 AND usuario_id = $2 RETURNING id',
                [id, usuarioId]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Ubicación no encontrada' });
            res.json({ success: true, mensaje: 'Ubicación eliminada' });
        } catch (error) {
            console.error('Error al eliminar ubicacion:', error);
            res.status(500).json({ error: 'Error al eliminar ubicación' });
        }
    }
}

module.exports = AnalistaController;
