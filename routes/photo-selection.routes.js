const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const photoSelectionController = require('../controllers/photo-selection.controller.js');

// router.use(authMiddleware);

router.post("/createEvent",authMiddleware, photoSelectionController.createEvent);
router.get("/getAllEvents",authMiddleware, photoSelectionController.getAllEvents);
router.get("/getEventById/:event_id",authMiddleware, photoSelectionController.getEventById);
router.put("/updateEvent/:event_id",authMiddleware, photoSelectionController.updateEvent);
router.get("/getFolderByEventId/:event_id",authMiddleware, photoSelectionController.getFolderByEventId);
router.get("/getAiGuestByEventId/:event_id",authMiddleware, photoSelectionController.getAiGuestByEventId);
router.post("/addAiGuest",authMiddleware, photoSelectionController.addAiGuest);
router.get("/getUploadedPhotosByFolderId/:folder_id",authMiddleware, photoSelectionController.getUploadedPhotosByFolderId);
router.post("/createNewFolder",authMiddleware, photoSelectionController.createNewFolder);
router.put("/updateFolder/:id",authMiddleware, photoSelectionController.updateFolder);
router.delete("/deleteFolder/:id",authMiddleware, photoSelectionController.deleteFolder);
router.delete("/deleteEvent/:id",authMiddleware, photoSelectionController.deleteEvent);
router.post("/uploadPhotos",authMiddleware, photoSelectionController.uploadPhotos);
router.post("/deletePhotos",authMiddleware,photoSelectionController.deletePhotos);
router.post("/verifyUniqueCode",photoSelectionController.verifyUniqueCode)
router.post("/getFolderListByCustomerCode",photoSelectionController.getFolderListByCustomerCode)
router.post("/updatePhotoStatus",photoSelectionController.updatePhotoStatus)
router.post("/submitEvent",photoSelectionController.submitEvent);

router.get("/getAllPhotosByEventId/:event_id",authMiddleware,photoSelectionController.getAllPhotosByEventId)



module.exports = router;