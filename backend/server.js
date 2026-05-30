const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const recoveryRoutes = require('./routes/recovery');

app.get('/', (req, res) => {
  res.json({
    mensaje: '🗺️ API GIS Risk Zulia',
    version: '1.0.0',
    estado: 'Activo',
    endpoints: {
      autenticacion: '/api/auth',
      administracion: '/api/admin',
      recuperacion: '/api/recovery'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recovery', recoveryRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    mensaje: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});


app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║        🗺️  GIS RISK ZULIA - BACKEND SERVER                  ║
║  🚀 Servidor corriendo en: http://localhost:${PORT}           ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
