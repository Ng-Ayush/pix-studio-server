const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const userController = require('../controllers/user.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.post("/getOTPForPinUser",userController.verifyPinUser);

module.exports = router;
