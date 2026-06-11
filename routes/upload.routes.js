const express = require('express');
const router = express.Router();

const {
  uploadFiles,
  getFiles,
  migrate,
  deletePhotos,
  deleteFolder,
  deleteEvent
} = require('../controllers/upload.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// ========================
// ROUTES
// ========================
router.post('/uploads', uploadFiles);
router.get('/files', getFiles);
router.post('/migrate', migrate);
router.post("/deletePhotos",authMiddleware,deletePhotos);
router.delete("/deleteFolder/:id",authMiddleware, deleteFolder);
router.delete("/deleteEvent/:id",authMiddleware, deleteEvent);

module.exports = router;
