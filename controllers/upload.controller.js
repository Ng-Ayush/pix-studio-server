const uploadQueue = require('../utils/uploadQueue.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');

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
  uploadQueue.add(() => new Promise((resolve, reject) => {
    upload.array('files', 50)(req, res, async (err) => {
  
      if (err) {
        res.send({ error: err.message,status:400 });
        return reject(err);
      }
  
      if (!req.files?.length) {
        res.send({ error: 'No files uploaded', status: 400 });
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
  
        res.send({
          status: 200,
          message: 'Batch uploaded',
          isFaceDescriptorReady: false
        });
  
        resolve();
  
      } catch (e) {
        res.send({ error: e.message, status: 500 });
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

// exports.migrate = async (req, res) => {

//     try {
//         const [rows] = await pool.execute(`
//       SELECT
//         p.id AS photo_id,
//         p.photo_url,
//         p.photo_name,
//         p.folder_id,
//         e.id AS event_id,
//         e.event_name,
//         e.created_by AS user_id,
//         u.studio_name,
//         c.id AS customer_id,
//         c.name AS customer_name,
//         f.folder_name
//       FROM photos p
//       JOIN folders f ON f.id = p.folder_id
//       JOIN events e ON e.id = f.event_id
//       JOIN users u ON u.id = e.created_by
//       JOIN customers c ON c.id = e.customer_id
//       WHERE p.photo_url LIKE '%firebasestorage.googleapis.com%'
//       AND e.is_ai_upload = 0
//     `);

//         let ok = 0, fail = 0;

//         console.log("Starting migration...",rows);
        

//         for (const r of rows) {
//             try {
//                 const localPath = path.join(
//                     UPLOAD_ROOT,
//                     `user_${safe(r.user_id)}`,
//                     `studio_${safe(r.studio_name)}`,
//                     `customer_${safe(r.customer_name)}_${safe(r.customer_id)}`,
//                     `event_${safe(r.event_name)}_${safe(r.event_id)}`,
//                     `${safe(r.folder_name)}_${safe(r.folder_id)}`
//                 );

//                 await fs.promises.mkdir(localPath, { recursive: true });

//                 const filename = `${Date.now()}_${safe(r.photo_name)}`;
//                 const filepath = path.join(localPath, filename);

//                 await downloadImage(r.photo_url, filepath);

//                 await new Promise((res, rej) => {
//                     writer.on("finish", res);
//                     writer.on("error", rej);
//                 });

//                 const newUrl = `/uploads/user_${safe(r.user_id)}/studio_${safe(r.studio_name)}/customer_${safe(r.customer_name)}_${safe(r.customer_id)}/event_${safe(r.event_name)}_${safe(r.event_id)}/${safe(r.folder_name)}_${safe(r.folder_id)}/${filename}`;

//                 await pool.query(
//                     `UPDATE photos SET photo_url = ? WHERE id = ?`,
//                     [newUrl, r.photo_id]
//                 );

//                 ok++;
//             } catch (err) {
//                 console.error("Fail:", r.photo_url);
//                 fail++;
//             }
//         }

//         res.json({
//             message: "🔥 GLOBAL FIREBASE MIGRATION COMPLETE",
//             total: rows.length,
//             ok,
//             fail
//         });

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: err.message });
//     } finally {
//         await pool.end();
//     }
// };

// async function downloadImage(url, filePath) {
//     const stream = got.stream(url, {
//         followRedirect: true,
//         timeout: { request: 60000 },
//         headers: {
//             "user-agent":
//                 "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
//             accept: "image/*,*/*;q=0.8",
//             referer: "https://firebase.google.com"
//         }
//     });


//     await new Promise((resolve, reject) => {
//         const file = fs.createWriteStream(filePath);
//         stream.pipe(file);
//         stream.on("error", reject);
//         file.on("finish", resolve);
//         file.on("error", reject);
//     });
// }