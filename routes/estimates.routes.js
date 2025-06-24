const express = require('express');
const router = express.Router();
const estimatesController = require('../controllers/estimates.controller.js');

router.post('/createEstimate', estimatesController.createEstimate);
router.put('/updateEstimate/:id', estimatesController.updateEstimate);
router.get('/getEstimateById/:invoice_id', estimatesController.getEstimateByInvoiceId);
router.put('/convertToSales/:invoice_id', estimatesController.convertToSales);
router.get('/getEstimateList', estimatesController.getAllEstimates); // optional

module.exports = router;
