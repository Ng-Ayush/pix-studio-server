const Busboy = require('busboy');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');
const axios = require('axios');
const FormData = require('form-data');

/* ========================
   CONSTANTS
======================== */

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AI_UPLOAD_ROOT = path.join(__dirname, '..', 'ai-uploads'); // ✅ changed

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
fs.mkdirSync(AI_UPLOAD_ROOT, { recursive: true });

const baseImgUrl = process.env.BASE_IMG_URL;
const basePythonUrl = process.env.PYTHON_BASE_URL;
// ========================
// HELPERS
// ========================
const safe = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]/g, '');

function ensureUploadPath(fields) {
  const root = fields.is_ai_upload == 1 ? AI_UPLOAD_ROOT : UPLOAD_ROOT;

  const uploadPath = path.join(
    root,
    `user_${safe(fields.user_id)}`,
    `studio_${safe(fields.studio_name)}`,
    `customer_${safe(fields.customer_name)}_${safe(fields.customer_id)}`,
    `event_${safe(fields.event_name)}_${safe(fields.event_id)}`,
    `${safe(fields.folder_name)}_${safe(fields.folder_id)}`
  );

  fs.mkdirSync(uploadPath, { recursive: true });
  return uploadPath;
}

// ========================
//   UPLOAD CONTROLLER
// ========================

exports.uploadFiles = (req, res) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Invalid content-type' });
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      files: 10,
      fileSize: 10 * 1024 * 1024 // 10MB per file
    }
  });

  const fields = {};
  const files = [];
  const writePromises = [];
  let uploadPath = null;

  /* -------- fields -------- */
  busboy.on('field', (name, value) => {
    fields[name] = value;
  });

  /* -------- files -------- */
  busboy.on('file', (name, file, info) => {
    const { filename, mimeType } = info;

    if (!/^image\/jpe?g$/.test(mimeType)) {
      file.resume();
      return;
    }

    if (!uploadPath && fields.user_id) {
      uploadPath = ensureUploadPath(fields);
    }

    if (!uploadPath) {
      file.resume();
      return;
    }

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const finalName = `${Date.now()}_${safe(base)}${ext}`;
    const finalPath = path.join(uploadPath, finalName);

    const writeStream = fs.createWriteStream(finalPath);

    const writePromise = new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    file.pipe(writeStream);
    writePromises.push(writePromise);

    files.push({
      path: finalPath.replace(process.cwd(), '').replace(/\\/g, '/'),
      originalname: filename
    });
  });

  /* -------- finish -------- */
  busboy.on('finish', async () => {
    try {
      if (!files.length) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      await Promise.all(writePromises);

      const values = files.map(f => [
        f.path,
        f.originalname,
        fields.folder_id,
        fields.user_id,
        null,
        false
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');

      await pool.execute(
        `INSERT INTO photos
         (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
         VALUES ${placeholders}`,
        values.flat()
      );

      res.json({
        status: 200,
        message: 'Upload successful',
        files: files.length
      });

    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  req.pipe(busboy);
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

async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
  try {

    const [[row]] = await pool.execute('SELECT event_name FROM events WHERE id = ?', [event_id]);


    const formData = new FormData();
    formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url))); // array of URLs
    formData.append('wedding_name', row.event_name); // you can make this dynamic

    let ai_folder_id = `${row.event_name?.split(" ")?.join("_")}_${event_id}`;

    console.log("WEDDING FOLDE IDE", ai_folder_id);


    if (ai_folder_id) formData.append('wedding_folder_id', ai_folder_id);

    const localurl = `${basePythonUrl}/upload_urls`;

    axios.post(localurl, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity
    })
      .then(async (response) => {
        await updateFaceDescriptorStatus(event_id);
        console.log("✅ Extraction completed:", response.data);
      })
      .catch(err => {
        console.error("⚠️ External API failed:", err);
      });

  } catch (error) {
    console.error("⚠️ triggerExternalExtraction error:", error.message);
  }
};

function updateFaceDescriptorStatus(event_id) {
  return new Promise(async (resolve, reject) => {
    try {
      await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [true, event_id]);
      await pool.execute(`
            UPDATE photos 
            SET descriptor_ready = 1 
            WHERE folder_id IN (
                SELECT id FROM folders WHERE event_id = ?
            )
        `, [event_id]);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

exports.migrate = async (req, res) => {

  const {is_ai_upload } = req.body;
    try {
        const [rows] = await pool.execute(`
      SELECT
        p.id AS photo_id,
        p.photo_url,
        p.photo_name,
        p.folder_id,
        e.id AS event_id,
        e.event_name,
        e.created_by AS user_id,
        u.studio_name,
        c.id AS customer_id,
        c.name AS customer_name,
        f.folder_name
      FROM photos p
      JOIN folders f ON f.id = p.folder_id
      JOIN events e ON e.id = f.event_id
      JOIN users u ON u.id = e.created_by
      JOIN customers c ON c.id = e.customer_id
      WHERE p.photo_url LIKE '%firebasestorage.googleapis.com%'
      AND e.is_ai_upload = ?
    `, [is_ai_upload ? 1 : 0]
    );

        let ok = 0, fail = 0;

        console.log("Starting migration...",rows);


        for (const r of rows) {
            try {
                const localPath = path.join(
                    is_ai_upload ? AI_UPLOAD_ROOT : UPLOAD_ROOT,
                    `user_${safe(r.user_id)}`,
                    `studio_${safe(r.studio_name)}`,
                    `customer_${safe(r.customer_name)}_${safe(r.customer_id)}`,
                    `event_${safe(r.event_name)}_${safe(r.event_id)}`,
                    `${safe(r.folder_name)}_${safe(r.folder_id)}`
                );

                await fs.promises.mkdir(localPath, { recursive: true });
                 const ext = path.extname(r.photo_name);
                const name = path.basename(r.photo_name, ext);

                const filename = `${name}${ext}`;
                const filepath = path.join(localPath, filename);

                await downloadImage(r.photo_url, filepath);

                const newUrl = `/${is_ai_upload ? 'ai-uploads' : 'uploads'}/user_${safe(r.user_id)}/studio_${safe(r.studio_name)}/customer_${safe(r.customer_name)}_${safe(r.customer_id)}/event_${safe(r.event_name)}_${safe(r.event_id)}/${safe(r.folder_name)}_${safe(r.folder_id)}/${filename}`;

                await pool.query(
                    `UPDATE photos SET photo_url = ? WHERE id = ?`,
                    [newUrl, r.photo_id]
                );

                ok++;
            } catch (err) {
                console.error("Fail:", r.photo_url);
                fail++;
            }
        }

        res.json({
            message: "🔥 GLOBAL FIREBASE MIGRATION COMPLETE",
            total: rows.length,
            ok,
            fail
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

async function downloadImage(url, filePath) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
}

// function getFileUrl(path) {
//   const normalizedPath = path.replace(/\\/g, '/');
//   return `${baseImgUrl}${normalizedPath}`;
// }