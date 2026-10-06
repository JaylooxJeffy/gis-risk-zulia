const express = require('express');
const router = express.Router();
const FirmsController = require('../controllers/firmsController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/incendios', FirmsController.consultarIncendios);

module.exports = router;
