const uploadQueue = require('../utils/uploadQueue.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');
const { log } = require('console');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AI_UPLOAD_ROOT = path.join(__dirname, '..', 'ai-uploads'); // ✅ changed

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
fs.mkdirSync(AI_UPLOAD_ROOT, { recursive: true }); 


// ========================
// HELPERS
// ========================
const safe = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '');

// ========================
// MULTER STORAGE
// ========================
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
        const {
            user_id,
            studio_name,
            customer_name,
            customer_id,
            event_name,
            event_id,
            folder_name,
            folder_id,
            is_ai_upload
        } = req.body;

        if (
            !user_id ||
            !studio_name ||
            !event_id
        ) {
            return cb(new Error('Missing required fields'));
        }

        const basePath = path.join(
            UPLOAD_ROOT,
            `user_${safe(user_id)}`,
            `studio_${safe(studio_name)}`,
            `customer_${safe(customer_name)}_${safe(customer_id)}`,
            `event_${safe(event_name)}_${safe(event_id)}`
        );

        const root = !!req.body.is_ai_upload ? AI_UPLOAD_ROOT : UPLOAD_ROOT;

        const uploadPath = path.join(
            root,
            `user_${safe(user_id)}`,
            `studio_${safe(studio_name)}`,
            `customer_${safe(customer_name)}_${safe(customer_id)}`,
            `event_${safe(event_name)}_${safe(event_id)}`,
            `${safe(folder_name)}_${safe(folder_id)}`
        );
        ;

        await fs.promises.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);

    } catch (e) {
        cb(e);
    }
},


    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${Date.now()}_${safe(name)}${ext}`);
    }
});

// ========================
// MULTER CONFIG
// ========================
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024,files: 50 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'image/jpeg' ||
            file.mimetype === 'image/jpg'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG/JPEG files allowed'));
        }
    }
});

exports.uploadFiles = (req, res) => {

  console.log(req.body);
  uploadQueue.add(() => new Promise((resolve, reject) => {
    upload.array('files', 50)(req, res, async (err) => {
  
      // 🔴 FIX 1: multer error pe response bhi bhejo
      if (err) {
        res.status(400).send({ error: err.message });
        return reject(err);
      }
  
      // 🔴 FIX 2: no files case pe bhi response bhejo
      if (!req.files?.length) {
        res.status(400).send({ error: 'No files uploaded' });
        return reject(new Error('No files uploaded'));
      }
  
      try {
        const {
          user_id,
          folder_id,
          event_id,
          is_ai_upload = false,
          photo_quality = 'basic'
        } = req.body;
  
        const publicRoot = is_ai_upload ? '/ai-uploads' : '/uploads';
  
        const values = req.files.map(f => [
          f.path
            .replace(process.cwd(), '')
            .replace(/\\/g, '/')
            .replace(
              publicRoot === '/ai-uploads' ? '/ai-uploads' : '/uploads',
              publicRoot
            ),
          f.originalname,
          folder_id,
          user_id,
          null,
          false
        ]);
  
        // chunked insert
        const chunk = 50;
        for (let i = 0; i < values.length; i += chunk) {
          const slice = values.slice(i, i + chunk);
          const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
          await pool.execute(
            `INSERT INTO photos (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
             VALUES ${placeholders}`,
            slice.flat()
          );
        }
  
        if (is_ai_upload) {
          await pool.execute(
            'UPDATE folders SET isFaceDescriptorReady = 0 WHERE id = ?',
            [folder_id]
          );
          await pool.execute(
            'UPDATE events SET isFaceDescriptorReady = 0 WHERE id = ?',
            [event_id]
          );
  
          let inc = req.files.length;
          if (photo_quality === 'high') inc *= 10;
          else if (photo_quality === 'standard') inc *= 3;
  
          await pool.execute(
            'UPDATE users SET used_photo_count = used_photo_count + ? WHERE id = ?',
            [inc, user_id]
          );
        }
  
        // ✅ success response
        res.send({
          status: 200,
          message: 'Batch uploaded',
          isFaceDescriptorReady: false
        });
  
        resolve();
  
      } catch (e) {
        // 🔴 FIX 3: catch me bhi response
        res.status(500).send({ error: e.message });
        reject(e);
      }
    });
  }));
  
};

exports.getFiles = async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM uploaded_files ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
};