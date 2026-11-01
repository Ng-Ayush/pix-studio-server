const express = require('express');
const router = express.Router();
const controller = require('../controllers/modulePayment.controller');
const authMiddleware = require('../middlewares/module-payment-auth.middleware');
const superAdminAuth = require('../middlewares/super-admin-auth.middleware');

router.get('/plans', authMiddleware, controller.getPlans);
router.get('/admin/plans', superAdminAuth, controller.getAdminPlans);
router.post('/admin/plans', superAdminAuth, controller.createPlan);
router.put('/admin/plans/:id', superAdminAuth, controller.updatePlan);
router.patch('/admin/plans/:id/status', superAdminAuth, controller.togglePlan);
router.delete('/admin/plans/:id', superAdminAuth, controller.deletePlan);
router.post('/create-order', authMiddleware, controller.createOrder);
router.post('/verify-payment', authMiddleware, controller.verifyPayment);
router.get('/summary', authMiddleware, controller.getPaymentSummary);

module.exports = router;
