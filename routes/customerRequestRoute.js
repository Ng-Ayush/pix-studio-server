const express = require('express');
const router = express.Router();
const adminController = require('../controllers/customerRequestController');

router.get('/getAllRequests',adminController.getAllRequests);
router.delete('/resolved/:id', adminController.resolved);

module.exports = router;
