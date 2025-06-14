const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// Route to create a new user
router.post('/create', userController.createUser);

module.exports = router;
