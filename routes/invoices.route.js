const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoices.controller.js');

router.post('/generateInvoice', invoiceController.generateInvoice);
router.get('/getAllInvoices', invoiceController.getAllInvoices);
router.get('/getInvoiceById/:id', invoiceController.getInvoiceById);
router.put('/updateInvoice/:id', invoiceController.updateInvoice);
router.delete('/deleteInvoice/:id', invoiceController.deleteInvoice);
router.get('/getInvoiceDetailByInvoiceNumber/:id', invoiceController.getInvoiceDetailByInvoiceNumber);

module.exports = router;
