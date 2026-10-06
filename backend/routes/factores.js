const express = require('express');
const router = express.Router();
const FactoresController = require('../controllers/factoresController');
const { verificarToken } = require('../middleware/auth');

// Solo requiere token válido (consultor, analista, administrador).
// El CRUD de factores (crear, editar, desactivar) sigue en /api/admin/factores
// porque esas operaciones sí requieren verificarAdmin.
router.use(verificarToken);

router.get('/', FactoresController.listarFactores);

module.exports = router;
