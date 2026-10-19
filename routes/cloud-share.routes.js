const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware.js');
const cloudShareController = require('../controllers/cloud-share.controller.js');

const router = express.Router();

router.get('/public/:shareId', cloudShareController.getPublicShare);
router.post('/public/:shareId/started', cloudShareController.markShareStarted);
router.post('/public/:shareId/downloaded', cloudShareController.recordDownload);

router.use(authMiddleware);
router.get('/', cloudShareController.getUserShares);
router.post('/', cloudShareController.createShare);
router.patch('/:shareId/ready', cloudShareController.completeShare);
router.patch('/:shareId/failed', cloudShareController.failShare);
router.delete('/:shareId', cloudShareController.deleteShare);

module.exports = router;
