const pool = require('../config/database');

class Solicitud {
  // Crear una nueva solicitud
  static async crear(email, nombreUsuario, rolSolicitado) {
    const query = `
      INSERT INTO solicitudes_pendientes (email, nombre_usuario, rol_solicitado, fecha_solicitud, estado)
      VALUES ($1, $2, $3, NOW(), 'pendiente')
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [email, nombreUsuario, rolSolicitado]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Buscar solicitud por email y estado
  static async buscarPorEmail(email, estado = 'pendiente') {
    const query = 'SELECT * FROM solicitudes_pendientes WHERE email = $1 AND estado = $2 ORDER BY fecha_solicitud DESC LIMIT 1';
    
    try {
      const result = await pool.query(query, [email, estado]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Buscar solicitud por ID
  static async buscarPorId(id) {
    const query = 'SELECT * FROM solicitudes_pendientes WHERE id = $1';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Listar todas las solicitudes pendientes
  static async listarPendientes() {
    const query = `
      SELECT * FROM solicitudes_pendientes 
      WHERE estado = 'pendiente' 
      ORDER BY fecha_solicitud DESC
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Listar todas las solicitudes (cualquier estado)
  static async listarTodas() {
    const query = `
      SELECT * FROM solicitudes_pendientes 
      ORDER BY fecha_solicitud DESC
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar estado de solicitud
  static async actualizarEstado(id, nuevoEstado) {
    const query = 'UPDATE solicitudes_pendientes SET estado = $1 WHERE id = $2 RETURNING *';
    
    try {
      const result = await pool.query(query, [nuevoEstado, id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Aprobar solicitud
  static async aprobar(id) {
    return await this.actualizarEstado(id, 'aprobada');
  }

  // Rechazar solicitud
  static async rechazar(id) {
    return await this.actualizarEstado(id, 'rechazada');
  }

  // Eliminar solicitud
  static async eliminar(id) {
    const query = 'DELETE FROM solicitudes_pendientes WHERE id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Contar solicitudes pendientes
  static async contarPendientes() {
    const query = "SELECT COUNT(*) as total FROM solicitudes_pendientes WHERE estado = 'pendiente'";
    
    try {
      const result = await pool.query(query);
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Solicitud;
