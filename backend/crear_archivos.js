const fs = require('fs');
const path = require('path');

// Config Email
const emailConfig = `const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD.replace(/\\s/g, ''),
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en email:', error);
  } else {
    console.log('✅ Servidor de email listo');
  }
});

const sendNewRequestNotification = async (solicitud) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: \`🔔 Nueva Solicitud - \${solicitud.rol_solicitado}\`,
    html: \`<h2>Nueva Solicitud de Registro</h2>
           <p><strong>Usuario:</strong> \${solicitud.nombre_usuario}</p>
           <p><strong>Email:</strong> \${solicitud.email}</p>
           <p><strong>Rol:</strong> \${solicitud.rol_solicitado}</p>\`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
};

const sendAccessCode = async (email, codigo, rol) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '✅ Código de Acceso',
    html: \`<h2>Solicitud Aprobada</h2><p>Tu código: <strong>\${codigo}</strong></p>\`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};

const sendRejectionEmail = async (email, nombreUsuario) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: '❌ Solicitud No Aprobada',
    html: \`<h2>Solicitud Rechazada</h2><p>Tu solicitud no fue aprobada.</p>\`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = { transporter, sendNewRequestNotification, sendAccessCode, sendRejectionEmail };`;

fs.writeFileSync('config/email.js', emailConfig);
console.log('✅ config/email.js creado');

// Middleware Auth
const authMiddleware = `const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'administrador') {
    return res.status(403).json({ error: 'Requiere permisos de administrador' });
  }
  next();
};

const generarToken = (usuario) => {
  return jwt.sign(
    { id: usuario.id, username: usuario.username, email: usuario.email, rol: usuario.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

module.exports = { verificarToken, verificarAdmin, generarToken };`;

fs.writeFileSync('middleware/auth.js', authMiddleware);
console.log('✅ middleware/auth.js creado');

// Modelo Usuario
const usuarioModel = `const pool = require('../config/database');
const bcrypt = require('bcrypt');

class Usuario {
  static async crear(username, email, passwordHash, rol) {
    const query = 'INSERT INTO usuarios (username, email, password_hash, rol, fecha_creacion, activo) VALUES ($1, $2, $3, $4, NOW(), true) RETURNING id, username, email, rol';
    const result = await pool.query(query, [username, email, passwordHash, rol]);
    return result.rows[0];
  }
  
  static async buscarPorEmail(email) {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    return result.rows[0];
  }
  
  static async buscarPorUsername(username) {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    return result.rows[0];
  }
  
  static async verificarPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }
  
  static async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }
  
  static async listarTodos() {
    const result = await pool.query('SELECT id, username, email, rol, fecha_creacion, activo FROM usuarios ORDER BY fecha_creacion DESC');
    return result.rows;
  }
}

module.exports = Usuario;`;

fs.writeFileSync('models/Usuario.js', usuarioModel);
console.log('✅ models/Usuario.js creado');

// Modelo Solicitud
const solicitudModel = `const pool = require('../config/database');

class Solicitud {
  static async crear(email, nombreUsuario, rolSolicitado) {
    const query = 'INSERT INTO solicitudes_pendientes (email, nombre_usuario, rol_solicitado, fecha_solicitud, estado) VALUES ($1, $2, $3, NOW(), \\'pendiente\\') RETURNING *';
    const result = await pool.query(query, [email, nombreUsuario, rolSolicitado]);
    return result.rows[0];
  }
  
  static async buscarPorEmail(email, estado = 'pendiente') {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes WHERE email = $1 AND estado = $2 ORDER BY fecha_solicitud DESC LIMIT 1', [email, estado]);
    return result.rows[0];
  }
  
  static async buscarPorId(id) {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes WHERE id = $1', [id]);
    return result.rows[0];
  }
  
  static async listarPendientes() {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes WHERE estado = \\'pendiente\\' ORDER BY fecha_solicitud DESC');
    return result.rows;
  }
  
  static async listarTodas() {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes ORDER BY fecha_solicitud DESC');
    return result.rows;
  }
  
  static async aprobar(id) {
    const result = await pool.query('UPDATE solicitudes_pendientes SET estado = \\'aprobada\\' WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
  
  static async rechazar(id) {
    const result = await pool.query('UPDATE solicitudes_pendientes SET estado = \\'rechazada\\' WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
  
  static async contarPendientes() {
    const result = await pool.query('SELECT COUNT(*) as total FROM solicitudes_pendientes WHERE estado = \\'pendiente\\'');
    return parseInt(result.rows[0].total);
  }
}

module.exports = Solicitud;`;

fs.writeFileSync('models/Solicitud.js', solicitudModel);
console.log('✅ models/Solicitud.js creado');

// Modelo CodigoAcceso
const codigoModel = `const pool = require('../config/database');
const crypto = require('crypto');

class CodigoAcceso {
  static generarCodigo() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  
  static async crear(emailUsuario, rol, idSolicitud) {
    const codigo = this.generarCodigo();
    const minutes = process.env.CODE_EXPIRATION_MINUTES || 10;
    const query = \`INSERT INTO codigos_acceso (codigo, email_usuario, rol, fecha_generacion, fecha_expiracion, usado, id_solicitud) VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '\${minutes} minutes', false, $4) RETURNING *\`;
    const result = await pool.query(query, [codigo, emailUsuario, rol, idSolicitud]);
    return result.rows[0];
  }
  
  static async buscarPorCodigoYEmail(codigo, email) {
    const result = await pool.query('SELECT * FROM codigos_acceso WHERE codigo = $1 AND email_usuario = $2', [codigo.toUpperCase(), email]);
    return result.rows[0];
  }
  
  static async verificarValidez(codigo, email) {
    const codigoData = await this.buscarPorCodigoYEmail(codigo, email);
    if (!codigoData) return { valido: false, mensaje: 'Código no encontrado' };
    if (codigoData.usado) return { valido: false, mensaje: 'Código ya usado' };
    if (new Date() > new Date(codigoData.fecha_expiracion)) return { valido: false, mensaje: 'Código expirado' };
    return { valido: true, mensaje: 'Código válido', codigo: codigoData };
  }
  
  static async marcarComoUsado(id) {
    const result = await pool.query('UPDATE codigos_acceso SET usado = true WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
  
  static async invalidarCodigosAnteriores(email) {
    await pool.query('UPDATE codigos_acceso SET usado = true WHERE email_usuario = $1 AND usado = false', [email]);
    return true;
  }
}

module.exports = CodigoAcceso;`;

fs.writeFileSync('models/CodigoAcceso.js', codigoModel);
console.log('✅ models/CodigoAcceso.js creado');

console.log('\n🎉 Archivos base creados. Ahora ejecuta: node crear_controllers.js');