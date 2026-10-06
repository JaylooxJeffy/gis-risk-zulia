// Crea el usuario administrador inicial de GIS Risk Zulia.
//
// Uso (desde la carpeta backend):
//   node scripts/crear_admin.js correo@dominio.com "ClaveDeAlMenos8Caracteres"
//
// - El correo debe ser el mismo que pusiste en ADMIN_EMAIL dentro de backend/.env,
//   porque el sistema reconoce a ese correo como administrador principal.
// - El nombre de usuario resultante es la parte del correo antes de la @ + "-Admin"
//   (por ejemplo, ana@correo.com -> ana-Admin).
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const [email, password] = process.argv.slice(2);

if (!email || !email.includes('@') || !password || password.length < 8) {
  console.error('Uso: node scripts/crear_admin.js correo@dominio.com "ClaveDeAlMenos8Caracteres"');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    const correo = email.trim().toLowerCase();
    const username = correo.split('@')[0] + '-Admin';
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO usuarios (username, email, password_hash, rol)
       VALUES ($1, $2, $3, 'administrador')
       RETURNING id`,
      [username, correo, hash]
    );

    console.log(`Administrador creado (id ${rows[0].id}).`);
    console.log(`Inicia sesion con el usuario "${username}" o con el correo ${correo}.`);

    if ((process.env.ADMIN_EMAIL || '').trim().toLowerCase() !== correo) {
      console.warn('AVISO: ADMIN_EMAIL en backend/.env no coincide con este correo.');
      console.warn('Sin esa coincidencia, esta cuenta no tendra los permisos del administrador principal.');
    }
  } catch (err) {
    if (err.code === '23505') {
      console.error('Ya existe un usuario con ese correo y rol, o con ese nombre de usuario.');
    } else {
      console.error('No se pudo crear el administrador:', err.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
