const express = require('express');
const router = express.Router();
const RecoveryController = require('../controllers/recoveryController');

router.post('/solicitar', RecoveryController.solicitarRecuperacion);
router.post('/cambiar-password', RecoveryController.cambiarPassword);

module.exports = router;
