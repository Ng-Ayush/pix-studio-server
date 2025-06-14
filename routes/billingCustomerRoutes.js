const express = require('express');
const router = express.Router();
const customerController = require('../controllers/billingCustomerController.js');

router.post('/createParty', customerController.createCustomer);
router.get('/getAllParty', customerController.getAllCustomers);
router.get('/getPartyById/:id', customerController.getCustomerById);
router.put('/updateParty/:id', customerController.updateCustomer);
router.delete('/deleteParty/:id', customerController.deleteCustomer);
router.get('/getInvoiceByPartyId/:id', customerController.getInvoiceByPartyId);

module.exports = router;
