const pool = require('../config/database');
const crypto = require('crypto');

class CodigoAcceso {
  static generarCodigo() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  static async crear(emailUsuario, rol, idSolicitud) {
    const codigo = this.generarCodigo();
    const expirationMinutes = parseInt(process.env.CODE_EXPIRATION_MINUTES) || 10;
    
    const query = `
      INSERT INTO codigos_acceso (codigo, email_usuario, rol, fecha_generacion, fecha_expiracion, usado, id_solicitud)
      VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${expirationMinutes} minutes', false, $4)
      RETURNING *
    `;
    
    const result = await pool.query(query, [codigo, emailUsuario, rol, idSolicitud]);
    return result.rows[0];
  }

  static async buscarPorCodigoYEmail(codigo, email) {
    const result = await pool.query(
      'SELECT * FROM codigos_acceso WHERE codigo = $1 AND email_usuario = $2',
      [codigo.toUpperCase(), email]
    );
    return result.rows[0];
  }

  static async verificarValidez(codigo, email) {
    const codigoData = await this.buscarPorCodigoYEmail(codigo, email);
    
    if (!codigoData) {
      return { valido: false, mensaje: 'Código no encontrado' };
    }

    if (codigoData.usado) {
      return { valido: false, mensaje: 'Código ya usado' };
    }

    const ahora = new Date();
    const expiracion = new Date(codigoData.fecha_expiracion);

    if (ahora > expiracion) {
      return { valido: false, mensaje: 'Código expirado' };
    }

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

module.exports = CodigoAcceso;