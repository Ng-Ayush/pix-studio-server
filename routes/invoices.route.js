const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoices.controller.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/generateInvoice',authMiddleware, invoiceController.generateInvoice);
router.get('/getAllInvoices', authMiddleware,invoiceController.getAllInvoices);
router.get('/getInvoiceById/:id', authMiddleware,invoiceController.getInvoiceById);
router.put('/updateInvoice/:id',authMiddleware, invoiceController.updateInvoice);
router.delete('/deleteInvoice/:id', authMiddleware,invoiceController.deleteInvoice);
router.get('/getInvoiceDetailByInvoiceNumber/:id',authMiddleware, invoiceController.getInvoiceDetailByInvoiceNumber);
router.post('/saveAdvancePayment', authMiddleware,invoiceController.saveAdvancePayment);
router.get('/getPastPayments/:id', authMiddleware,invoiceController.getPastPayments);
router.get('/getLastInvoiceNumber',authMiddleware,invoiceController.getLastInvoiceNumber);

module.exports = router;
