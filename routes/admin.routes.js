const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

router.post('/login', adminController.login);
router.get('/getAllUsers',adminController.getAllUsers);
router.post('/createUsers', adminController.createUsers);
router.get('/getUsersById/:id',adminController.getUsersById);
router.put('/updateUsers',  adminController.updateUsers);
router.put('/toggleAdminStatus/:id',  adminController.toggleAdminStatus);
router.delete('/deleteUsers/:id', adminController.deleteUsers);







module.exports = router;
