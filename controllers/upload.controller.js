const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');
const axios = require('axios');
const FormData = require('form-data');

// ========================
// CONSTANTS
// ========================
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AI_UPLOAD_ROOT = path.join(__dirname, '..', 'ai-uploads');
const MAX_CONCURRENT_WRITES = 10;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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

// Directory cache to avoid redundant mkdir calls
const dirCache = new Set();

const ensureDirectory = async (dirPath) => {
  if (dirCache.has(dirPath)) return;
  await fs.promises.mkdir(dirPath, { recursive: true });
  dirCache.add(dirPath);
  
  // Prevent memory leak - clear cache if too large
  if (dirCache.size > 1000) {
    dirCache.clear();
  }
};

const buildUploadPath = (body) => {
  const { user_id, studio_name, customer_name, customer_id, 
          event_name, event_id, folder_name, folder_id, is_ai_upload } = body;
  
  const root = toBool(is_ai_upload) ? AI_UPLOAD_ROOT : UPLOAD_ROOT;
  
  return path.join(
    root,
    `user_${safe(user_id)}`,
    `studio_${safe(studio_name)}`,
    `customer_${safe(customer_name)}_${safe(customer_id)}`,
    `event_${safe(event_name)}_${safe(event_id)}`,
    `${safe(folder_name)}_${safe(folder_id)}`
  );
};

const getFileUrl = (filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${baseImgUrl}${normalizedPath}`;
};

// ========================
// CONCURRENT FILE WRITER
// ========================
const writeFilesWithConcurrency = async (files, uploadPath, concurrency = MAX_CONCURRENT_WRITES) => {
  const results = [];
  
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (file) => {
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const filename = `${safe(name)}${ext}`;
      const filepath = path.join(uploadPath, filename);
      
      await fs.promises.writeFile(filepath, file.buffer);
      
      return { filepath, filename, originalname: file.originalname };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
};

// ========================
// MULTER CONFIG - MEMORY STORAGE (faster parsing)
// ========================
const upload = multer({
  storage: multer.memoryStorage(), // ✅ Parse to memory first, write to disk with control
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 100 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG/JPEG files allowed'));
    }
  }
});

// ========================
// MAIN UPLOAD HANDLER
// ========================
exports.uploadFiles = (req, res) => {
  const startTime = Date.now();
  let timeoutId;

  // Global timeout to prevent stuck processes
  timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[Upload] Timeout exceeded');
      res.status(408).json({ error: 'Upload timeout', status: 408 });
    }
  }, UPLOAD_TIMEOUT_MS);

  upload.array('files', 100)(req, res, async (err) => {
    try {
      // ─── VALIDATION ─────────────────────────────────────
      if (err) {
        clearTimeout(timeoutId);
        console.error('[Upload] Multer error:', err.message);
        return res.status(400).json({ error: err.message, status: 400 });
      }

      if (!req.files?.length) {
        clearTimeout(timeoutId);
        return res.status(400).json({ error: 'No files uploaded', status: 400 });
      }

      const {
        user_id, folder_id, event_id,
        is_ai_upload = false,
        photo_quality = 'basic',
        is_from_camera = false,
        studio_name, customer_name, customer_id,
        event_name, folder_name,
      } = req.body;

      // Validate required fields
      if (!user_id || !studio_name || !event_id || !folder_id) {
        clearTimeout(timeoutId);
        return res.status(400).json({
          error: 'Missing required fields: user_id, studio_name, event_id, folder_id',
          status: 400
        });
      }

      const isAiUpload = toBool(is_ai_upload);
      const isFromCamera = toBool(is_from_camera);
      const publicRoot = isAiUpload ? '/ai-uploads' : '/uploads';

      console.log(`[Upload] Starting upload of ${req.files.length} files`);

      // ─── STEP 1: CREATE DIRECTORY (ONCE) ────────────────
      const uploadPath = buildUploadPath(req.body);
      await ensureDirectory(uploadPath);
      
      console.log(`[Upload] Directory ready: ${Date.now() - startTime}ms`);

      // ─── STEP 2: WRITE FILES WITH CONTROLLED CONCURRENCY ─
      const writtenFiles = await writeFilesWithConcurrency(req.files, uploadPath);
      
      console.log(`[Upload] ${writtenFiles.length} files written: ${Date.now() - startTime}ms`);

      // ─── STEP 3: PREPARE DB VALUES ──────────────────────
      const values = writtenFiles.map(f => {
        // Build relative URL path
        const relativePath = f.filepath
          .replace(process.cwd(), '')
          .replace(/\\/g, '/');
        
        // Fix: properly construct the public URL
        const urlPath = relativePath.replace(
          isAiUpload ? '/ai-uploads' : '/uploads',
          publicRoot
        );

        return [urlPath, f.originalname, folder_id, user_id, null, false];
      });

      // ─── STEP 4: DATABASE TRANSACTION ───────────────────
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        // Bulk insert all photos
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
        await connection.execute(
          `INSERT INTO photos 
           (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
           VALUES ${placeholders}`,
          values.flat()
        );

        if (isAiUpload) {
          // Batch the status updates
          await Promise.all([
            connection.execute(
              'UPDATE folders SET isFaceDescriptorReady = 0 WHERE id = ?',
              [folder_id]
            ),
            connection.execute(
              'UPDATE events SET isFaceDescriptorReady = 0 WHERE id = ?',
              [event_id]
            )
          ]);

          // Calculate and update photo count
          let inc = req.files.length;
          if (photo_quality === 'high') inc *= 10;
          else if (photo_quality === 'standard') inc *= 3;

          await connection.execute(
            'UPDATE users SET used_photo_count = used_photo_count + ? WHERE id = ?',
            [inc, user_id]
          );
        }

        await connection.commit();
        console.log(`[Upload] DB transaction complete: ${Date.now() - startTime}ms`);
        
      } catch (dbError) {
        await connection.rollback();
        throw dbError;
      } finally {
        connection.release(); // ✅ Always release connection
      }

      // ─── STEP 5: SEND RESPONSE ──────────────────────────
      clearTimeout(timeoutId);
      
      res.status(200).json({
        status: 200,
        message: 'Batch uploaded',
        count: writtenFiles.length,
        isFaceDescriptorReady: false,
        duration: `${Date.now() - startTime}ms`
      });

      // ─── STEP 6: ASYNC POST-PROCESSING ──────────────────
      if (isFromCamera && values.length > 0) {
        // Fire and forget - don't block response
        setImmediate(() => {
          triggerExternalExtraction(folder_id, event_id, [{ url: getFileUrl(values[0][0]) }], '')
            .catch(err => console.error('[Extraction Error]:', err.message));
        });
      }

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[Upload] Critical error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({ error: error.message, status: 500 });
      }
    }
  });
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