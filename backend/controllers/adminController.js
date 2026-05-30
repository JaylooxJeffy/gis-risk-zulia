const Solicitud = require('../models/Solicitud');
const CodigoAcceso = require('../models/CodigoAcceso');
const Usuario = require('../models/Usuario');
const { sendAccessCode, sendRejectionEmail } = require('../config/email');
const pool = require('../config/database');

const ADMIN_PRINCIPAL_EMAIL = 'jeffersonrosales2014@gmail.com';

// Verificar si el usuario puede aprobar/rechazar solicitudes
function tienePermisosAprobacion(usuario) {
    return usuario.email === ADMIN_PRINCIPAL_EMAIL || usuario.delegado === true;
}

class AdminController {
    static async listarSolicitudesPendientes(req, res) {
        try {
            const solicitudes = await Solicitud.listarPendientes();
            res.json({ success: true, total: solicitudes.length, solicitudes });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    }

    static async listarTodasSolicitudes(req, res) {
        try {
            const solicitudes = await Solicitud.listarTodas();
            res.json({ success: true, total: solicitudes.length, solicitudes });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    }

    static async aprobarSolicitud(req, res) {
        const { id } = req.params;

        if (!tienePermisosAprobacion(req.usuario)) {
            return res.status(403).json({ error: 'No tienes permisos para aprobar solicitudes' });
        }

        try {
            const solicitud = await Solicitud.buscarPorId(id);
            if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
            if (solicitud.estado !== 'pendiente') return res.status(400).json({ error: 'Solicitud ya procesada' });

            const usuarioExistente = await Usuario.buscarPorEmail(solicitud.email);
            if (usuarioExistente) return res.status(400).json({ error: 'Ya existe un usuario con este email' });

            await CodigoAcceso.invalidarCodigosAnteriores(solicitud.email);
            const codigoData = await CodigoAcceso.crear(solicitud.email, solicitud.rol_solicitado, id);
            await Solicitud.aprobar(id);
            await sendAccessCode(solicitud.email, codigoData.codigo, solicitud.rol_solicitado);

            res.json({ success: true, mensaje: 'Solicitud aprobada y código enviado' });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al aprobar solicitud' });
        }
    }

    static async rechazarSolicitud(req, res) {
        const { id } = req.params;

        if (!tienePermisosAprobacion(req.usuario)) {
            return res.status(403).json({ error: 'No tienes permisos para rechazar solicitudes' });
        }

        try {
            const solicitud = await Solicitud.buscarPorId(id);
            if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
            if (solicitud.estado !== 'pendiente') return res.status(400).json({ error: 'Solicitud ya procesada' });

            await Solicitud.rechazar(id);
            await sendRejectionEmail(solicitud.email, solicitud.nombre_usuario);

            res.json({ success: true, mensaje: 'Solicitud rechazada' });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al rechazar solicitud' });
        }
    }

    static async regenerarCodigo(req, res) {
        const { id } = req.params;
        try {
            const solicitud = await Solicitud.buscarPorId(id);
            if (!solicitud || solicitud.estado !== 'aprobada') {
                return res.status(400).json({ error: 'Solo para solicitudes aprobadas' });
            }
            await CodigoAcceso.invalidarCodigosAnteriores(solicitud.email);
            const codigoData = await CodigoAcceso.crear(solicitud.email, solicitud.rol_solicitado, id);
            await sendAccessCode(solicitud.email, codigoData.codigo, solicitud.rol_solicitado);
            res.json({ success: true, mensaje: 'Nuevo código generado' });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al regenerar código' });
        }
    }

    static async listarUsuarios(req, res) {
        try {
            const result = await pool.query(
                'SELECT id, username, email, rol, activo, delegado, fecha_creacion FROM usuarios ORDER BY fecha_creacion DESC'
            );
            res.json({ success: true, total: result.rows.length, usuarios: result.rows });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Error al obtener usuarios' });
        }
    }

    static async desactivarUsuario(req, res) {
        const { id } = req.params;
        try {
            const usuario = await Usuario.desactivar(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json({ success: true, mensaje: 'Usuario desactivado', usuario });
        } catch (error) {
            res.status(500).json({ error: 'Error al desactivar usuario' });
        }
    }

    static async activarUsuario(req, res) {
        const { id } = req.params;
        try {
            const usuario = await Usuario.activar(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json({ success: true, mensaje: 'Usuario activado', usuario });
        } catch (error) {
            res.status(500).json({ error: 'Error al activar usuario' });
        }
    }

    static async contarPendientes(req, res) {
        try {
            const total = await Solicitud.contarPendientes();
            res.json({ success: true, count: total });
        } catch (error) {
            res.status(500).json({ error: 'Error al contar solicitudes' });
        }
    }

    static async delegarAdmin(req, res) {
        const { id } = req.params;

        if (req.usuario.email !== ADMIN_PRINCIPAL_EMAIL) {
            return res.status(403).json({ error: 'Solo el administrador principal puede delegar permisos' });
        }

        try {
            const result = await pool.query(
                'UPDATE usuarios SET delegado = TRUE WHERE id = $1 AND rol = $2 RETURNING id, username, email, rol, delegado',
                [id, 'administrador']
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado o no es administrador' });
            }
            res.json({ success: true, mensaje: 'Delegación otorgada', usuario: result.rows[0] });
        } catch (error) {
            res.status(500).json({ error: 'Error al delegar permisos' });
        }
    }

    static async quitarDelegacionAdmin(req, res) {
        const { id } = req.params;

        if (req.usuario.email !== ADMIN_PRINCIPAL_EMAIL) {
            return res.status(403).json({ error: 'Solo el administrador principal puede quitar delegaciones' });
        }

        try {
            const result = await pool.query(
                'UPDATE usuarios SET delegado = FALSE WHERE id = $1 AND rol = $2 RETURNING id, username, email, rol, delegado',
                [id, 'administrador']
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado o no es administrador' });
            }
            res.json({ success: true, mensaje: 'Delegación removida', usuario: result.rows[0] });
        } catch (error) {
            res.status(500).json({ error: 'Error al quitar delegación' });
        }
    }

    static async obtenerMisPermisos(req, res) {
        try {
            const result = await pool.query(
                'SELECT id, username, email, rol, delegado FROM usuarios WHERE email = $1',
                [req.usuario.email]
            );
            const usuario = result.rows[0];
            res.json({
                success: true,
                esPrincipal: req.usuario.email === ADMIN_PRINCIPAL_EMAIL,
                puedeAprobar: tienePermisosAprobacion(usuario),
                usuario
            });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener permisos' });
        }
    }
}

module.exports = AdminController;
