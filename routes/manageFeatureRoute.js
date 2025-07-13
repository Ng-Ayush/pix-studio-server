const express = require('express');
const router = express.Router();
const adminController = require('../controllers/manageFeatureController');

// router.post('/login', adminController.login);
router.get('/getAllFeatures',adminController.getAllFeatures);
router.post('/createFeatures', adminController.createFeatures);
router.post('/onImgUpload', adminController.onImgUpload);
router.get('/getFeatureById/:id',adminController.getFeatureById);
router.put('/updateFeature',  adminController.updateFeature);
router.delete('/deleteFeatures/:id', adminController.deleteFeatures);
router.post("/create-order",adminController.createOrder);
router.post("/verify-payment",adminController.verifyPayment);


module.exports = router;
