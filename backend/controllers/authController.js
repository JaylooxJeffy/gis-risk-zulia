const Usuario = require('../models/Usuario');
const Solicitud = require('../models/Solicitud');
const CodigoAcceso = require('../models/CodigoAcceso');
const { generarToken } = require('../middleware/auth');
const { sendNewRequestNotification } = require('../config/email');
const pool = require('../config/database');

const SUFIJOS = {
    'consultor': '-Con',
    'analista': '-An',
    'administrador': '-Admin'
};

// Generar username único con muletilla si es necesario
async function generarUsernameUnico(usernameBase, rol) {
    // Primero intentar el username tal cual
    const existeBase = await pool.query('SELECT id FROM usuarios WHERE username = $1', [usernameBase]);
    if (existeBase.rows.length === 0) return usernameBase;

    // Agregar muletilla del rol
    const sufijo = SUFIJOS[rol] || '';
    const usernameConSufijo = usernameBase + sufijo;
    const existeSufijo = await pool.query('SELECT id FROM usuarios WHERE username = $1', [usernameConSufijo]);
    if (existeSufijo.rows.length === 0) return usernameConSufijo;

    // Si también existe, agregar número
    let contador = 2;
    while (contador <= 99) {
        const usernameNumero = usernameConSufijo + contador;
        const existe = await pool.query('SELECT id FROM usuarios WHERE username = $1', [usernameNumero]);
        if (existe.rows.length === 0) return usernameNumero;
        contador++;
    }

    // Fallback con timestamp
    return usernameConSufijo + Date.now();
}

class AuthController {
    static async registroConsultor(req, res) {
        const { username, email, password } = req.body;

        try {
            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Todos los campos son obligatorios' });
            }

            // Verificar si ya existe un consultor con este email
            const existeEmailRol = await pool.query(
                "SELECT id FROM usuarios WHERE email = $1 AND rol = 'consultor'",
                [email]
            );
            if (existeEmailRol.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe una cuenta de consultor con este email' });
            }

            // Generar username único con muletilla si hace falta
            const usernameUnico = await generarUsernameUnico(username, 'consultor');
            const passwordHash = await Usuario.hashPassword(password);
            const nuevoUsuario = await Usuario.crear(usernameUnico, email, passwordHash, 'consultor');
            const token = generarToken(nuevoUsuario);

            res.status(201).json({
                success: true,
                mensaje: 'Usuario consultor registrado exitosamente',
                usernameAsignado: usernameUnico,
                usernameSolicitado: username,
                fueModificado: usernameUnico !== username,
                usuario: {
                    id: nuevoUsuario.id,
                    username: nuevoUsuario.username,
                    email: nuevoUsuario.email,
                    rol: nuevoUsuario.rol
                },
                token
            });
        } catch (error) {
            console.error('Error en registro consultor:', error);
            res.status(500).json({ error: 'Error al registrar usuario consultor' });
        }
    }

    static async solicitarRegistro(req, res) {
        const { username, email, rol } = req.body;

        try {
            if (!username || !email || !rol) {
                return res.status(400).json({ error: 'Todos los campos son obligatorios' });
            }

            if (rol !== 'analista' && rol !== 'administrador') {
                return res.status(400).json({ error: 'Rol inválido' });
            }

            // Verificar si ya existe una cuenta con este email y rol
            const existeEmailRol = await pool.query(
                'SELECT id FROM usuarios WHERE email = $1 AND rol = $2',
                [email, rol]
            );
            if (existeEmailRol.rows.length > 0) {
                return res.status(400).json({ error: `Ya existe una cuenta de ${rol} con este email` });
            }

            // Verificar solicitud pendiente para este email+rol
            const solicitudExistente = await pool.query(
                "SELECT id FROM solicitudes_pendientes WHERE email = $1 AND rol_solicitado = $2 AND estado = 'pendiente'",
                [email, rol]
            );
            if (solicitudExistente.rows.length > 0) {
                return res.status(400).json({ error: `Ya tienes una solicitud pendiente de ${rol}` });
            }

            // Calcular username que se asignará
            const usernameUnico = await generarUsernameUnico(username, rol);

            const nuevaSolicitud = await Solicitud.crear(email, usernameUnico, rol);
            await sendNewRequestNotification(nuevaSolicitud);

            res.status(201).json({
                success: true,
                mensaje: 'Solicitud enviada exitosamente',
                usernameAsignado: usernameUnico,
                fueModificado: usernameUnico !== username,
                solicitud: {
                    id: nuevaSolicitud.id,
                    email: nuevaSolicitud.email,
                    rol_solicitado: nuevaSolicitud.rol_solicitado,
                    estado: nuevaSolicitud.estado
                }
            });
        } catch (error) {
            console.error('Error en solicitud:', error);
            res.status(500).json({ error: 'Error al procesar solicitud' });
        }
    }

    static async completarRegistro(req, res) {
        const { email, codigo, password } = req.body;

        try {
            if (!email || !codigo || !password) {
                return res.status(400).json({ error: 'Todos los campos son obligatorios' });
            }

            const verificacion = await CodigoAcceso.verificarValidez(codigo, email);
            if (!verificacion.valido) {
                return res.status(400).json({ error: verificacion.mensaje });
            }

            const solicitud = await Solicitud.buscarPorId(verificacion.codigo.id_solicitud);
            if (!solicitud || solicitud.estado !== 'aprobada') {
                return res.status(400).json({ error: 'Solicitud no válida' });
            }

            // Verificar que no exista ya esta combinación email+rol
            const existeEmailRol = await pool.query(
                'SELECT id FROM usuarios WHERE email = $1 AND rol = $2',
                [email, verificacion.codigo.rol]
            );
            if (existeEmailRol.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe un usuario con este email y rol' });
            }

            const passwordHash = await Usuario.hashPassword(password);
            const nuevoUsuario = await Usuario.crear(solicitud.nombre_usuario, email, passwordHash, verificacion.codigo.rol);
            await CodigoAcceso.marcarComoUsado(verificacion.codigo.id);

            const token = generarToken(nuevoUsuario);

            res.status(201).json({
                success: true,
                mensaje: 'Registro completado exitosamente',
                usuario: {
                    id: nuevoUsuario.id,
                    username: nuevoUsuario.username,
                    email: nuevoUsuario.email,
                    rol: nuevoUsuario.rol
                },
                token
            });
        } catch (error) {
            console.error('Error al completar registro:', error);
            res.status(500).json({ error: 'Error al completar el registro' });
        }
    }

    static async login(req, res) {
        const { email, password } = req.body;

        try {
            if (!email || !password) {
                return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
            }

            // Si hay múltiples cuentas con el mismo email, buscar todas
            const result = await pool.query(
                'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE ORDER BY id',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            // Verificar password contra la primera cuenta encontrada
            // (todas las cuentas del mismo email comparten contraseña)
            const usuario = result.rows[0];
            const passwordValido = await Usuario.verificarPassword(password, usuario.password_hash);

            if (!passwordValido) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            // Si tiene múltiples cuentas, devolver lista para que elija
            if (result.rows.length > 1) {
                return res.json({
                    success: true,
                    multiplesCuentas: true,
                    cuentas: result.rows.map(u => ({
                        id: u.id,
                        username: u.username,
                        email: u.email,
                        rol: u.rol
                    }))
                });
            }

            const token = generarToken(usuario);

            res.json({
                success: true,
                usuario: {
                    id: usuario.id,
                    username: usuario.username,
                    email: usuario.email,
                    rol: usuario.rol,
                    password_temporal: usuario.password_temporal || false
                },
                token
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error al iniciar sesión' });
        }
    }

    // Login con cuenta específica cuando hay múltiples
    static async loginConCuenta(req, res) {
        const { email, password, userId } = req.body;

        try {
            const result = await pool.query(
                'SELECT * FROM usuarios WHERE id = $1 AND email = $2 AND activo = TRUE',
                [userId, email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Cuenta no encontrada' });
            }

            const usuario = result.rows[0];
            const passwordValido = await Usuario.verificarPassword(password, usuario.password_hash);

            if (!passwordValido) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const token = generarToken(usuario);

            res.json({
                success: true,
                usuario: {
                    id: usuario.id,
                    username: usuario.username,
                    email: usuario.email,
                    rol: usuario.rol,
                    password_temporal: usuario.password_temporal || false
                },
                token
            });
        } catch (error) {
            console.error('Error en login con cuenta:', error);
            res.status(500).json({ error: 'Error al iniciar sesión' });
        }
    }

    static async verificarSolicitud(req, res) {
        const { email } = req.params;
        try {
            const solicitud = await Solicitud.buscarPorEmail(email, 'pendiente');
            if (!solicitud) {
                return res.status(404).json({ mensaje: 'No hay solicitudes pendientes' });
            }
            res.json({ solicitud });
        } catch (error) {
            res.status(500).json({ error: 'Error al verificar solicitud' });
        }
    }
}

module.exports = AuthController;
