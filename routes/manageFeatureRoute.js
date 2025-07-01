const express = require('express');
const router = express.Router();
const adminController = require('../controllers/manageFeatureController');

// router.post('/login', adminController.login);
router.get('/getAllFeatures',adminController.getAllFeatures);
router.post('/createFeatures', adminController.createFeatures);
router.get('/getFeatureById/:id',adminController.getFeatureById);
router.put('/updateFeature',  adminController.updateFeature);
router.delete('/deleteFeatures/:id', adminController.deleteFeatures);






module.exports = router;
