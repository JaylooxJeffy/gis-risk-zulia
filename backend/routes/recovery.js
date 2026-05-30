const express = require('express');
const router = express.Router();
const RecoveryController = require('../controllers/recoveryController');

// Solicitar recuperación de contraseña
router.post('/solicitar', RecoveryController.solicitarRecuperacion);

// Cambiar contraseña (después de login con temporal)
router.post('/cambiar-password', RecoveryController.cambiarPassword);

module.exports = router;
