const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplace.controller.ts');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.get('/getAllListing', authMiddleware, marketplaceController.getAllListing);
router.post('/create', authMiddleware, marketplaceController.create);
router.get('/getListingByUserId/:userId', authMiddleware, marketplaceController.getListingByUserId);
router.put('/editListingByUserId/:listingId', authMiddleware, marketplaceController.editListingByUserId);
router.patch('/toggleListingByUserId/:listingId', authMiddleware, marketplaceController.toggleListingByUserId);
router.delete('/deleteListingById/:listingId', authMiddleware, marketplaceController.deleteListingById);

module.exports = router;