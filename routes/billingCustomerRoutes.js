const express = require('express');
const router = express.Router();
const customerController = require('../controllers/billingCustomerController.js');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/createParty',authMiddleware, customerController.createCustomer);
router.get('/getAllParty', authMiddleware, customerController.getAllCustomers);
router.get('/getPartyById/:id',authMiddleware, customerController.getCustomerById);
router.put('/updateParty/:id',authMiddleware, customerController.updateCustomer);
router.delete('/deleteParty/:id', authMiddleware,customerController.deleteCustomer);
router.get('/getInvoiceByPartyId/:id',authMiddleware, customerController.getInvoiceByPartyId);

module.exports = router;
