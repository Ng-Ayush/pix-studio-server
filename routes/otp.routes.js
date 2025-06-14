const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otp.controller.js');

router.post('/sendOTP', otpController.sendOtp);
router.post('/verifyOTPForPinUser', otpController.verifyOTPForPinUser);

module.exports = router;
