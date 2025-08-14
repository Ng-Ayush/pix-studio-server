const express = require('express');
const router = express.Router();
const estimatesController = require('../controllers/estimates.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/createEstimate',authMiddleware, estimatesController.createEstimate);
router.put('/updateEstimate/:invoice_id',authMiddleware, estimatesController.updateEstimate);
router.get('/getEstimateById/:invoice_id',authMiddleware, estimatesController.getEstimateByInvoiceId);
router.put('/convertToSales/:invoice_id',authMiddleware, estimatesController.convertToSales);
router.get('/getEstimateList',authMiddleware, estimatesController.getAllEstimates); // optional

module.exports = router;
