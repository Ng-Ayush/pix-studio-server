const express = require('express');
const router = express.Router();
const adminController = require('../controllers/manageProfileController');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.get('/getUsersByCurrentId/:id',adminController.getUsersByCurrentId);
router.put('/updateProfile',  adminController.updateProfile);
router.post('/connectToWhatsApp/:userId', authMiddleware,  adminController.connectToWhatsApp);
router.post('/disconnectWhatsApp/:userId', authMiddleware,  adminController.disconnectWhatsApp);
router.post('/resetDeleteAiPhotoCount', authMiddleware,  adminController.resetDeleteAiPhotoCount);


module.exports = router;
