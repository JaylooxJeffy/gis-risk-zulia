const pool = require('../config/database');

class Solicitud {
  static async crear(email, nombreUsuario, rolSolicitado) {
    const query = `
      INSERT INTO solicitudes_pendientes (email, nombre_usuario, rol_solicitado, fecha_solicitud, estado)
      VALUES ($1, $2, $3, NOW(), 'pendiente')
      RETURNING *
    `;
    const result = await pool.query(query, [email, nombreUsuario, rolSolicitado]);
    return result.rows[0];
  }

  static async buscarPorEmail(email, estado = 'pendiente') {
    const result = await pool.query(
      'SELECT * FROM solicitudes_pendientes WHERE email = $1 AND estado = $2 ORDER BY fecha_solicitud DESC LIMIT 1',
      [email, estado]
    );
    return result.rows[0];
  }

  static async buscarPorId(id) {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async listarPendientes() {
    const result = await pool.query(
      "SELECT * FROM solicitudes_pendientes WHERE estado = 'pendiente' ORDER BY fecha_solicitud DESC"
    );
    return result.rows;
  }

  static async listarTodas() {
    const result = await pool.query('SELECT * FROM solicitudes_pendientes ORDER BY fecha_solicitud DESC');
    return result.rows;
  }

  static async aprobar(id) {
    const result = await pool.query(
      "UPDATE solicitudes_pendientes SET estado = 'aprobada' WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }

  static async rechazar(id) {
    const result = await pool.query(
      "UPDATE solicitudes_pendientes SET estado = 'rechazada' WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }

  static async contarPendientes() {
    const result = await pool.query("SELECT COUNT(*) as total FROM solicitudes_pendientes WHERE estado = 'pendiente'");
    return parseInt(result.rows[0].total);
  }
}

module.exports = Solicitud;