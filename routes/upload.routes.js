const express = require('express');
const router = express.Router();

const {
  uploadFiles,
  getFiles
} = require('../controllers/upload.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ========================
// ROUTES
// ========================
router.post('/uploads', authMiddleware, uploadFiles);
router.get('/files', getFiles);

module.exports = router;
