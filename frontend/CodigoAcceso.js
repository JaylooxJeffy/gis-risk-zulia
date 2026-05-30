const pool = require('../config/database');
const crypto = require('crypto');

class CodigoAcceso {
  // Generar código aleatorio de 8 caracteres
  static generarCodigo() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  // Crear un nuevo código de acceso
  static async crear(emailUsuario, rol, idSolicitud) {
    const codigo = this.generarCodigo();
    const expirationMinutes = parseInt(process.env.CODE_EXPIRATION_MINUTES) || 10;
    
    const query = `
      INSERT INTO codigos_acceso (codigo, email_usuario, rol, fecha_generacion, fecha_expiracion, usado, id_solicitud)
      VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '${expirationMinutes} minutes', false, $4)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [codigo, emailUsuario, rol, idSolicitud]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Buscar código por email y código
  static async buscarPorCodigoYEmail(codigo, email) {
    const query = 'SELECT * FROM codigos_acceso WHERE codigo = $1 AND email_usuario = $2';
    
    try {
      const result = await pool.query(query, [codigo.toUpperCase(), email]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Verificar si el código es válido (no usado y no expirado)
  static async verificarValidez(codigo, email) {
    const codigoData = await this.buscarPorCodigoYEmail(codigo, email);
    
    if (!codigoData) {
      return { valido: false, mensaje: 'Código no encontrado' };
    }

    if (codigoData.usado) {
      return { valido: false, mensaje: 'Este código ya ha sido utilizado' };
    }

    const ahora = new Date();
    const expiracion = new Date(codigoData.fecha_expiracion);

    if (ahora > expiracion) {
      return { valido: false, mensaje: 'Este código ha expirado' };
    }

    return { 
      valido: true, 
      mensaje: 'Código válido',
      codigo: codigoData
    };
  }

  // Marcar código como usado
  static async marcarComoUsado(id) {
    const query = 'UPDATE codigos_acceso SET usado = true WHERE id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Invalidar todos los códigos anteriores de un email
  static async invalidarCodigosAnteriores(email) {
    const query = 'UPDATE codigos_acceso SET usado = true WHERE email_usuario = $1 AND usado = false';
    
    try {
      await pool.query(query, [email]);
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Listar códigos por email
  static async listarPorEmail(email) {
    const query = `
      SELECT * FROM codigos_acceso 
      WHERE email_usuario = $1 
      ORDER BY fecha_generacion DESC
    `;
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Limpiar códigos expirados (mantenimiento)
  static async limpiarExpirados() {
    const query = 'DELETE FROM codigos_acceso WHERE fecha_expiracion < NOW() AND usado = false';
    
    try {
      const result = await pool.query(query);
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  }

  // Verificar si existe un código válido para un email
  static async existeCodigoValido(email) {
    const query = `
      SELECT * FROM codigos_acceso 
      WHERE email_usuario = $1 
        AND usado = false 
        AND fecha_expiracion > NOW()
      ORDER BY fecha_generacion DESC
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CodigoAcceso;
