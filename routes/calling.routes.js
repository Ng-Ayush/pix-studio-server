const express = require('express');
const router = express.Router();
const callingController = require('../controllers/calling.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

// Route to create a new user
router.post('/addAgent', callingController.addAgent);
router.get('/getAgents', callingController.getAgents);

module.exports = router;
