const express = require('express');
const router = express.Router();
const customerController = require('../controllers/billingCustomerController.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/createParty', customerController.createCustomer);
router.get('/getAllParty', authMiddleware, customerController.getAllCustomers);
router.get('/getPartyById/:id', customerController.getCustomerById);
router.put('/updateParty/:id', customerController.updateCustomer);
router.delete('/deleteParty/:id', customerController.deleteCustomer);
router.get('/getInvoiceByPartyId/:id', customerController.getInvoiceByPartyId);

module.exports = router;
