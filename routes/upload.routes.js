const express = require('express');
const router = express.Router();

const {
  uploadFiles,
  getFiles,
  migrate
} = require('../controllers/upload.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ========================
// ROUTES
// ========================
router.post('/uploads', uploadFiles);
router.get('/files', getFiles);
router.post('/migrate', migrate);

module.exports = router;
