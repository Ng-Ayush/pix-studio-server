const express = require('express');
const router = express.Router();
const adminController = require('../controllers/manageProfileController');

router.get('/getUsersByCurrentId/:id',adminController.getUsersByCurrentId);
router.put('/updateProfile',  adminController.updateProfile);


module.exports = router;
