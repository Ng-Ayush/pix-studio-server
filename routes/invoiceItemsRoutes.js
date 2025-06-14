const express = require('express');
const router = express.Router();
const invoiceItemsController = require('../controllers/invoiceItemsController.js');

router.post('/addInvoiceItem', invoiceItemsController.addInvoiceItem);
router.get('/getAllInvoiceItems', invoiceItemsController.getAllInvoiceItems);
router.get('/getInvoiceItemById/:id', invoiceItemsController.getInvoiceItemById);
router.put('/updateInvoiceItem/:id', invoiceItemsController.updateInvoiceItem);
router.delete('/deleteInvoiceItem/:id', invoiceItemsController.deleteInvoiceItem);

module.exports = router;
