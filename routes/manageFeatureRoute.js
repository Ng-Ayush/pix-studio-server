const express = require('express');
const router = express.Router();
const adminController = require('../controllers/manageFeatureController');
const authMiddleware = require('../middlewares/auth.middleware.js');
// router.post('/login', adminController.login);
router.get('/getAllFeatures',adminController.getAllFeatures);
router.post('/createFeatures', adminController.createFeatures);
router.post('/onImgUpload', adminController.onImgUpload);
router.get('/getFeatureById/:id',adminController.getFeatureById);
router.get('/getFeaturesByCategory/:category',authMiddleware,adminController.getFeaturesByCategory);
router.put('/updateFeature',  adminController.updateFeature);
router.delete('/deleteFeatures/:id', adminController.deleteFeatures);
router.post("/create-order",adminController.createOrder);
router.post("/verify-payment", authMiddleware, adminController.verifyPayment);
router.post("/createCategory",adminController.createCategory);
router.put('/updateCategory/:id',  adminController.updateCategory);
router.delete('/deleteCategory/:id', adminController.deleteCategory);
router.get('/getAllCategories',adminController.getAllCategories);
router.get('/getFeaturesByNewArrival',authMiddleware,adminController.getFeaturesByNewArrival);
router.post("/verifyAndApplyPromoCode",adminController.verifyAndApplyPromoCode);
router.get("/getFeatureListByUserId",authMiddleware,adminController.getFeatureListByUserId);


module.exports = router;
