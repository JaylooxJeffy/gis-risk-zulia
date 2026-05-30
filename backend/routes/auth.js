const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');

router.post('/registro/consultor', AuthController.registroConsultor);
router.post('/solicitud', AuthController.solicitarRegistro);
router.post('/completar-registro', AuthController.completarRegistro);
router.post('/login', AuthController.login);
router.post('/login-cuenta', AuthController.loginConCuenta);
router.get('/solicitud/:email', AuthController.verificarSolicitud);

router.get('/perfil', verificarToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

module.exports = router;
