const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

router.use(verificarToken);
router.use(verificarAdmin);

router.get('/solicitudes/pendientes', AdminController.listarSolicitudesPendientes);
router.get('/solicitudes', AdminController.listarTodasSolicitudes);
router.post('/solicitudes/:id/aprobar', AdminController.aprobarSolicitud);
router.post('/solicitudes/:id/rechazar', AdminController.rechazarSolicitud);
router.post('/solicitudes/:id/regenerar-codigo', AdminController.regenerarCodigo);
router.get('/solicitudes/contar', AdminController.contarPendientes);
router.get('/usuarios', AdminController.listarUsuarios);
router.patch('/usuarios/:id/desactivar', AdminController.desactivarUsuario);
router.patch('/usuarios/:id/activar', AdminController.activarUsuario);
router.patch('/usuarios/:id/delegar', AdminController.delegarAdmin);
router.patch('/usuarios/:id/quitar-delegacion', AdminController.quitarDelegacionAdmin);
router.get('/mis-permisos', AdminController.obtenerMisPermisos);

module.exports = router;
