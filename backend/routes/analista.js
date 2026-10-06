const express = require('express');
const router = express.Router();
const AnalistaController = require('../controllers/analistaController');
const { verificarToken } = require('../middleware/auth');

// Cualquier usuario autenticado puede usar estas rutas, no solo analistas.
// El frontend controla qué roles ven el botón de guardar y el panel.
router.use(verificarToken);

router.get('/ubicaciones', AnalistaController.listarUbicaciones);
router.post('/ubicaciones', AnalistaController.guardarUbicacion);
router.patch('/ubicaciones/:id/notas', AnalistaController.actualizarNotas);
router.delete('/ubicaciones/:id', AnalistaController.eliminarUbicacion);

module.exports = router;
