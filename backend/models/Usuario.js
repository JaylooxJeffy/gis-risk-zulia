const pool = require('../config/database');
const bcrypt = require('bcrypt');

class Usuario {
  static async crear(username, email, passwordHash, rol) {
    const query = `
      INSERT INTO usuarios (username, email, password_hash, rol, fecha_creacion, activo)
      VALUES ($1, $2, $3, $4, NOW(), true)
      RETURNING id, username, email, rol, fecha_creacion, activo
    `;
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

  static async buscarPorId(id) {
    const result = await pool.query('SELECT id, username, email, rol, fecha_creacion, activo FROM usuarios WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async verificarPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
  }

  static async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  static async listarTodos() {
    const result = await pool.query('SELECT id, username, email, rol, fecha_creacion, activo FROM usuarios ORDER BY fecha_creacion DESC');
    return result.rows;
  }

  static async desactivar(id) {
    const result = await pool.query('UPDATE usuarios SET activo = false WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async activar(id) {
    const result = await pool.query('UPDATE usuarios SET activo = true WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Usuario;