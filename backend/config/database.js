const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Conexión exitosa a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en PostgreSQL:', err);
  process.exit(-1);
});

const checkPostGIS = async () => {
  try {
    const result = await pool.query("SELECT PostGIS_Version();");
    console.log('✅ PostGIS habilitado:', result.rows[0].postgis_version);
  } catch (error) {
    console.log('⚠️  PostGIS no habilitado');
  }
};

checkPostGIS();

module.exports = pool;