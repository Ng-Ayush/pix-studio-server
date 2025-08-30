const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
router.post('/login', adminController.login);
router.get('/getAllUsers',authMiddleware,adminController.getAllUsers);
router.post('/createUsers',authMiddleware, adminController.createUsers);
router.get('/getUsersById/:id',authMiddleware,adminController.getUsersById);
router.put('/updateUsers',authMiddleware,  adminController.updateUsers);
router.put('/toggleAdminStatus/:id',authMiddleware,  adminController.toggleAdminStatus);
router.delete('/deleteUsers/:id',authMiddleware, adminController.deleteUsers);
router.get('/getDynamicImageUrl',authMiddleware,adminController.getDynamicImageUrl);
router.post('/insertImages',authMiddleware, adminController.insertImages);
router.post("/createPromocode",authMiddleware, adminController.createPromocode);
router.get("/getAllPromocodes",authMiddleware, adminController.getAllPromocodes);
// router.get("/getPromocodeById/:id",authMiddleware, adminController.getPromocodeById);
router.put("/updatePromocode/:id",authMiddleware, adminController.updatePromocode);
router.delete("/deletePromocode/:id",authMiddleware, adminController.deletePromocode);
router.put("/togglePromocodeStatus",authMiddleware, adminController.togglePromocodeStatus);








module.exports = router;
