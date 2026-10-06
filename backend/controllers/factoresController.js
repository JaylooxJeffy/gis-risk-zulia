const pool = require('../config/database');

function extraerPalabras(texto) {
    return texto.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(p => p.length > 3);
}

function calcularSimilitud(nombre1, nombre2) {
    const palabras1 = new Set(extraerPalabras(nombre1));
    const palabras2 = new Set(extraerPalabras(nombre2));
    if (palabras1.size === 0 || palabras2.size === 0) return 0;
    const interseccion = [...palabras1].filter(p => palabras2.has(p));
    const union = new Set([...palabras1, ...palabras2]);
    return interseccion.length / union.size;
}

class FactoresController {
    static async listarFactores(req, res) {
        try {
            const result = await pool.query('SELECT * FROM factores_riesgo WHERE activo = TRUE ORDER BY categoria, nombre');
            res.json({ success: true, factores: result.rows });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener factores' });
        }
    }

    static async listarTodosFactores(req, res) {
        try {
            const result = await pool.query(
                'SELECT f.*, u.username as creado_por_username FROM factores_riesgo f LEFT JOIN usuarios u ON f.creado_por = u.id ORDER BY f.categoria, f.nombre'
            );
            res.json({ success: true, factores: result.rows });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener factores' });
        }
    }

    static async verificarSimilitud(req, res) {
        const { nombre } = req.body;
        try {
            const result = await pool.query('SELECT * FROM factores_riesgo WHERE activo = TRUE');
            const similares = result.rows
                .map(f => ({ ...f, similitud: calcularSimilitud(nombre, f.nombre) }))
                .filter(f => f.similitud > 0.3)
                .sort((a, b) => b.similitud - a.similitud);

            res.json({
                success: true,
                tieneSimilares: similares.length > 0,
                similares: similares.map(f => ({ id: f.id, nombre: f.nombre, similitud: Math.round(f.similitud * 100) }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Error al verificar similitudes' });
        }
    }

    static async crearFactor(req, res) {
        const { nombre, descripcion, nivel, categoria, forzar } = req.body;
        const userId = req.usuario.id;

        try {
            if (!nombre || !nivel) return res.status(400).json({ error: 'Nombre y nivel son obligatorios' });

            if (!forzar) {
                const result = await pool.query('SELECT * FROM factores_riesgo WHERE activo = TRUE');
                const similares = result.rows
                    .map(f => ({ ...f, similitud: calcularSimilitud(nombre, f.nombre) }))
                    .filter(f => f.similitud > 0.5);

                if (similares.length > 0) {
                    return res.status(409).json({
                        success: false,
                        requiereConfirmacion: true,
                        mensaje: 'Factores similares encontrados',
                        similares: similares.map(f => ({ id: f.id, nombre: f.nombre, similitud: Math.round(f.similitud * 100) }))
                    });
                }
            }

            const insert = await pool.query(
                'INSERT INTO factores_riesgo (nombre, descripcion, nivel, categoria, creado_por) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [nombre, descripcion, nivel, categoria || 'general', userId]
            );
            res.status(201).json({ success: true, factor: insert.rows[0] });
        } catch (error) {
            res.status(500).json({ error: 'Error al crear factor' });
        }
    }

    static async editarFactor(req, res) {
        const { id } = req.params;
        const { nombre, descripcion, nivel, categoria } = req.body;
        try {
            const result = await pool.query(
                'UPDATE factores_riesgo SET nombre=$1, descripcion=$2, nivel=$3, categoria=$4 WHERE id=$5 RETURNING *',
                [nombre, descripcion, nivel, categoria, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Factor no encontrado' });
            res.json({ success: true, factor: result.rows[0] });
        } catch (error) {
            res.status(500).json({ error: 'Error al editar factor' });
        }
    }

    static async desactivarFactor(req, res) {
        const { id } = req.params;
        try {
            await pool.query('UPDATE factores_riesgo SET activo = FALSE WHERE id = $1', [id]);
            res.json({ success: true, mensaje: 'Factor desactivado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al desactivar factor' });
        }
    }

    static async activarFactor(req, res) {
        const { id } = req.params;
        try {
            await pool.query('UPDATE factores_riesgo SET activo = TRUE WHERE id = $1', [id]);
            res.json({ success: true, mensaje: 'Factor activado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al activar factor' });
        }
    }
}

module.exports = FactoresController;
