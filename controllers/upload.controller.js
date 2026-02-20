const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');
const axios = require('axios');
const FormData = require('form-data');
// const Minio = require('minio');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const http = require("http");  // ← http.Agent here

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://tn3.mieuxcloud.com:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: '8MHul1CuBvoRj8D3dzhS',
    secretAccessKey: 'PEEpS8bo7Wm9RWRUIYiM1qgu5FFeT6a14AQcCsAp'
  },
  requestHandler: new NodeHttpHandler({
    httpAgent: new http.Agent({
      keepAlive: true,
      maxSockets: 200,      // ↑ FROM 10 → 200 (handles 20 API calls)
      maxFreeSockets: 100,
      timeout: 120000       // 2 minutes
    })
  })
});
const bucketName = "akash";

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AI_UPLOAD_ROOT = path.join(__dirname, '..', 'ai-uploads');

const baseImgUrl = process.env.BASE_IMG_URL;
const basePythonUrl = process.env.PYTHON_BASE_URL;

// Ensure base directories exist at startup
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
fs.mkdirSync(AI_UPLOAD_ROOT, { recursive: true });

// ========================
// HELPERS
// ========================
const safe = (v) => String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '');

const toBool = (v) => v === true || v === 'true' || v === '1';

const upload = multer({
  storage: multer.memoryStorage(),  // ← NO TEMP FILES!
  limits: {
    fileSize: 10 * 1024 * 1024,   // Keep 10MB
    files: 100                    // Keep 100 max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG/JPEG allowed"));
  }
});


// ========================
// MAIN UPLOAD HANDLER
// ========================
// ✅ OPTIMIZED: Uses disk storage for faster uploads
// Files are streamed directly to disk as they arrive


// exports.uploadFiles = (req, res) => {
//   const startTime = Date.now();
//   let timeoutId;

//   // Global timeout to prevent stuck processes
//   timeoutId = setTimeout(() => {
//     if (!res.headersSent) {
//       console.error('[Upload] Timeout exceeded');
//       res.status(408).json({ error: 'Upload timeout', status: 408 });
//     }
//   }, UPLOAD_TIMEOUT_MS);

//   upload.array('files', 100)(req, res, async (err) => {
//     try {
//       // ─── VALIDATION ─────────────────────────────────────
//       if (err) {
//         clearTimeout(timeoutId);
//         console.error('[Upload] Multer error:', err.message);
//         return res.status(400).json({ error: err.message, status: 400 });
//       }

//       if (!req.files?.length) {
//         clearTimeout(timeoutId);
//         return res.status(400).json({ error: 'No files uploaded', status: 400 });
//       }

//       const {
//         user_id, folder_id, event_id,
//         is_ai_upload = false,
//         photo_quality = 'basic',
//         is_from_camera = false,
//         studio_name, customer_name, customer_id,
//         event_name, folder_name,
//       } = req.body;

//       // Validate required fields
//       if (!user_id || !studio_name || !event_id || !folder_id) {
//         clearTimeout(timeoutId);
//         return res.status(400).json({
//           error: 'Missing required fields: user_id, studio_name, event_id, folder_id',
//           status: 400
//         });
//       }

//       const isAiUpload = toBool(is_ai_upload);
//       const isFromCamera = toBool(is_from_camera);
//       const publicRoot = isAiUpload ? '/ai-uploads' : '/uploads';

//       console.log(`[Upload] Received ${req.files.length} files: ${Date.now() - startTime}ms`);

//       // ✅ OPTIMIZED: Files already written to disk by multer disk storage
//       // No need for manual file writing - this is the key speed improvement!

//       console.log(`[Upload] Files saved to disk: ${Date.now() - startTime}ms`);

//       // ─── PREPARE DB VALUES ──────────────────────────────
//       const values = req.files.map(f => {
//         // Build relative URL path from the file path
//         const relativePath = f.path
//           .replace(process.cwd(), '')
//           .replace(/\\/g, '/');

//         return [relativePath, f.originalname, folder_id, user_id, null, false];
//       });

//       // ─── DATABASE TRANSACTION ───────────────────────────
//       const connection = await pool.getConnection();

//       try {
//         await connection.beginTransaction();

//         // Bulk insert all photos
//         const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
//         await connection.execute(
//           `INSERT INTO photos 
//            (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
//            VALUES ${placeholders}`,
//           values.flat()
//         );

//         if (isAiUpload) {
//           // Batch the status updates
//           await Promise.all([
//             connection.execute(
//               'UPDATE folders SET isFaceDescriptorReady = 0 WHERE id = ?',
//               [folder_id]
//             ),
//             connection.execute(
//               'UPDATE events SET isFaceDescriptorReady = 0 WHERE id = ?',
//               [event_id]
//             )
//           ]);

//           // Calculate and update photo count
//           let inc = req.files.length;
//           if (photo_quality === 'high') inc *= 10;
//           else if (photo_quality === 'standard') inc *= 3;

//           await connection.execute(
//             'UPDATE users SET used_photo_count = used_photo_count + ? WHERE id = ?',
//             [inc, user_id]
//           );
//         }

//         await connection.commit();
//         console.log(`[Upload] DB transaction complete: ${Date.now() - startTime}ms`);

//       } catch (dbError) {
//         await connection.rollback();
//         throw dbError;
//       } finally {
//         connection.release(); // ✅ Always release connection
//       }

//       // ─── SEND RESPONSE ──────────────────────────────────
//       clearTimeout(timeoutId);

//       res.status(200).json({
//         status: 200,
//         message: 'Batch uploaded',
//         count: req.files.length,
//         isFaceDescriptorReady: false,
//         duration: `${Date.now() - startTime}ms`
//       });

//       // ─── ASYNC POST-PROCESSING ──────────────────────────
//       if (isFromCamera && values.length > 0) {
//         // Fire and forget - don't block response
//         setImmediate(() => {
//           triggerExternalExtraction(folder_id, event_id, [{ url: getFileUrl(values[0][0]) }], '')
//             .catch(err => console.error('[Extraction Error]:', err.message));
//         });
//       }

//     } catch (error) {
//       clearTimeout(timeoutId);
//       console.error('[Upload] Critical error:', error);

//       if (!res.headersSent) {
//         res.status(500).json({ error: error.message, status: 500 });
//       }
//     }
//   });
// };






exports.uploadFiles = (req, res) => {

  upload.array("files", 100)(req, res, async (err) => {

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files?.length) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const {
      user_id,
      studio_name,
      customer_name,
      customer_id,
      event_name,
      event_id,
      folder_name,
      folder_id,
      is_ai_upload = false,
      is_from_camera=false,
      photo_quality = 'basic'
    } = req.body;

    const prefix =
      `user_${safe(user_id)}/` +
      `studio_${safe(studio_name)}/` +
      `customer_${safe(customer_name)}_${safe(customer_id)}/` +
      `event_${safe(event_name)}_${safe(event_id)}/` +
      `${safe(folder_name)}_${safe(folder_id)}/`;

    const uploadResults = [];
    const MAX_CONCURRENT = 5;
    let index = 0;

    async function worker() {
      while (true) {
        const currentIndex = index++;
        if (currentIndex >= req.files.length) break;

        const file = req.files[currentIndex];

        const objectName =
          prefix + Date.now() + "_" + file.originalname;

        const contentType = file.mimetype || "image/jpeg";

        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: objectName,
            Body: file.buffer,
            ContentType: contentType
          })
        );

        uploadResults.push({
          objectName,
          originalName: file.originalname
        });
      }
    }

    try {

      // 1️⃣ Upload to MinIO in parallel
      const workers = Array.from(
        { length: MAX_CONCURRENT },
        () => worker()
      );

      await Promise.all(workers);


      // 2️⃣ Prepare DB values
      const values = uploadResults.map(file => ([
        file.objectName,
        file.originalName,
        folder_id,
        user_id,
        null,
        false
      ]));

      const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(",");

      await pool.execute(
        `INSERT INTO photos
         (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
         VALUES ${placeholders}`,
        values.flat()
      );

       if (is_ai_upload) {
            await pool.execute('UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?', [false, folder_id]);
            await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [false, event_id]);

             let inc = req.files.length;
          if (photo_quality === 'high') inc *= 10;
          else if (photo_quality === 'standard') inc *= 3;

          await pool.execute(
            'UPDATE users SET used_photo_count = used_photo_count + ? WHERE id = ?',
            [inc, user_id]
          );
       }

      res.status(200).json({
        success: true,
        uploaded: uploadResults.length,
        files: uploadResults
      });

      if (is_from_camera && values.length > 0) {
        console.log('[Upload] Triggering external extraction for folder:', values);
        
          triggerExternalExtraction(folder_id, event_id, [{ url: getFileUrl(values[0][0]) }], '')
      }

    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });
};

const getFileUrl = (filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${baseImgUrl}${normalizedPath}`;
};










// ========================
// EXTERNAL EXTRACTION (FIXED AXIOS CONFIG)
// ========================
async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
  try {
    const [[row]] = await pool.execute(
      'SELECT event_name FROM events WHERE id = ?',
      [event_id]
    );

    if (!row) {
      console.warn('[Extraction] Event not found:', event_id);
      return;
    }

    const formData = new FormData();
    formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url)));
    formData.append('wedding_name', row.event_name);

    const ai_folder_id = `${row.event_name?.split(' ')?.join('_')}_${event_id}`;
    if (ai_folder_id) {
      formData.append('wedding_folder_id', ai_folder_id);
    }

    console.log('[Extraction] Triggering for folder:', ai_folder_id);

    // ✅ FIXED: Correct axios config
    const response = await axios.post(
      `${basePythonUrl}/upload_urls`,
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000 // 60 second timeout
      }
    );

    await updateFaceDescriptorStatus(event_id);
    console.log('[Extraction] Completed:', response.data);

  } catch (error) {
    console.error('[Extraction] Failed:', error.message);
    throw error;
  }
}

// ========================
// UPDATE FACE DESCRIPTOR STATUS
// ========================
async function updateFaceDescriptorStatus(event_id) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?',
      [true, event_id]
    );

    await connection.execute(
      `UPDATE photos 
       SET descriptor_ready = 1 
       WHERE folder_id IN (SELECT id FROM folders WHERE event_id = ?)`,
      [event_id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ========================
// GET FILES
// ========================
exports.getFiles = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM uploaded_files ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[GetFiles] Error:', err);
    res.status(500).json({ message: 'Database error' });
  }
};

// ========================
// MIGRATION (OPTIMIZED)
// ========================
exports.migrate = async (req, res) => {
  const { is_ai_upload } = req.body;
  const isAiUpload = toBool(is_ai_upload);

  try {
    const [rows] = await pool.execute(`
      SELECT
        p.id AS photo_id, p.photo_url, p.photo_name, p.folder_id,
        e.id AS event_id, e.event_name, e.created_by AS user_id,
        u.studio_name,
        c.id AS customer_id, c.name AS customer_name,
        f.folder_name
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN events e ON e.id = f.event_id
      JOIN users u ON u.id = e.created_by
      JOIN customers c ON c.id = e.customer_id
      WHERE p.photo_url LIKE '%firebasestorage.googleapis.com%'
      AND e.is_ai_upload = ?
    `, [isAiUpload ? 1 : 0]);

    console.log(`[Migration] Starting migration of ${rows.length} files...`);

    let ok = 0, fail = 0;
    const BATCH_SIZE = 10;

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(r => migrateFile(r, isAiUpload))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') ok++;
        else fail++;
      });

      console.log(`[Migration] Progress: ${i + batch.length}/${rows.length}`);
    }

    res.json({
      message: '🔥 GLOBAL FIREBASE MIGRATION COMPLETE',
      total: rows.length,
      ok,
      fail
    });

  } catch (err) {
    console.error('[Migration] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

async function migrateFile(r, isAiUpload) {
  const localPath = path.join(
    isAiUpload ? AI_UPLOAD_ROOT : UPLOAD_ROOT,
    `user_${safe(r.user_id)}`,
    `studio_${safe(r.studio_name)}`,
    `customer_${safe(r.customer_name)}_${safe(r.customer_id)}`,
    `event_${safe(r.event_name)}_${safe(r.event_id)}`,
    `${safe(r.folder_name)}_${safe(r.folder_id)}`
  );

  await ensureDirectory(localPath);

  const ext = path.extname(r.photo_name);
  const name = path.basename(r.photo_name, ext);
  const filename = `${name}${ext}`;
  const filepath = path.join(localPath, filename);

  await downloadImage(r.photo_url, filepath);

  const newUrl = `/${isAiUpload ? 'ai-uploads' : 'uploads'}/user_${safe(r.user_id)}/studio_${safe(r.studio_name)}/customer_${safe(r.customer_name)}_${safe(r.customer_id)}/event_${safe(r.event_name)}_${safe(r.event_id)}/${safe(r.folder_name)}_${safe(r.folder_id)}/${filename}`;

  await pool.execute('UPDATE photos SET photo_url = ? WHERE id = ?', [newUrl, r.photo_id]);
}

async function downloadImage(url, filePath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
  } finally {
    clearTimeout(timeout);
  }
}