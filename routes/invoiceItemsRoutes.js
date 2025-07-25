const express = require('express');
const router = express.Router();
const invoiceItemsController = require('../controllers/invoiceItemsController.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/addInvoiceItem', authMiddleware,invoiceItemsController.addInvoiceItem);
router.get('/getAllInvoiceItems', authMiddleware,invoiceItemsController.getAllInvoiceItems);
router.get('/getInvoiceItemById/:id',authMiddleware, invoiceItemsController.getInvoiceItemById);
router.put('/updateInvoiceItem/:id',authMiddleware, invoiceItemsController.updateInvoiceItem);
router.delete('/deleteInvoiceItem/:id',authMiddleware, invoiceItemsController.deleteInvoiceItem);

module.exports = router;
