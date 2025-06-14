const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Protect all routes with auth middleware
router.use(authMiddleware);

// Routes
router.post('/createCustomer', authMiddleware, customerController.createCustomer);
router.put('/updateCustomer',authMiddleware,  customerController.updateCustomer);
router.get('/getAllCustomers',authMiddleware, customerController.getAllCustomers);
router.delete('/deleteCustomer/:id', customerController.deleteCustomer);
router.get('/searchCustomer/:name', customerController.searchCustomer);
router.get('/fetchCustomerFilesById/:id', customerController.getCustomerById);

module.exports = router;

