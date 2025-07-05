const express = require('express');
const router = express.Router();
const adminController = require('../controllers/customerRequestController');

router.get('/getAllRequests',adminController.getAllRequests);
router.delete('/resolved/:id', adminController.resolved);
router.get('/getRequestById/:id', adminController.getRequestById);
router.put('/updateRequest',  adminController.updateRequest);


module.exports = router;
