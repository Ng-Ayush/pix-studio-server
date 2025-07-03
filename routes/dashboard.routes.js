const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');  // Ensure the user is authenticated

// Use auth middleware to ensure the user is authenticated
router.use(authMiddleware);

// Get the dashboard stats for the authenticated user
router.get('/fetchSalesAndPendingGraphData', dashboardController.fetchSalesAndPendingGraphData);

module.exports = router;
