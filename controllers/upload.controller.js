const uploadQueue = require('../utils/uploadQueue.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');
const axios = require('axios');
const FormData = require('form-data');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const AI_UPLOAD_ROOT = path.join(__dirname, '..', 'ai-uploads'); // ✅ changed

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
fs.mkdirSync(AI_UPLOAD_ROOT, { recursive: true });

const baseImgUrl = process.env.BASE_IMG_URL;
const basePythonUrl = process.env.PYTHON_BASE_URL;
// ========================
// HELPERS
// ========================
const safe = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '');
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
  }
  return false;
};

const buildUploadPath = (req) => {
  const {
    user_id,
    studio_name,
    customer_name,
    customer_id,
    event_name,
    event_id,
    folder_name,
    folder_id
  } = req.body;

  if (!user_id || !studio_name || !event_id) {
    throw new Error('Missing required fields');
  }

  const isAiUpload = parseBoolean(req.body.is_ai_upload);
  const root = isAiUpload ? AI_UPLOAD_ROOT : UPLOAD_ROOT;

  const uploadPath = path.join(
    root,
    `user_${safe(user_id)}`,
    `studio_${safe(studio_name)}`,
    `customer_${safe(customer_name)}_${safe(customer_id)}`,
    `event_${safe(event_name)}_${safe(event_id)}`,
    `${safe(folder_name)}_${safe(folder_id)}`
  );

  return { uploadPath, isAiUpload };
};

// ========================
// MULTER STORAGE
// ========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!req.mkdirPromise) {
        const { uploadPath, isAiUpload } = buildUploadPath(req);
        req.isAiUpload = isAiUpload;
        req.cachedUploadPath = uploadPath;
        req.mkdirPromise = fs.promises.mkdir(uploadPath, { recursive: true });
      }

      req.mkdirPromise
        .then(() => cb(null, req.cachedUploadPath))
        .catch(cb);
    } catch (e) {
      cb(e);
    }
  },


  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${safe(name)}${ext}`);
  }
});

// ========================
// MULTER CONFIG
// ========================
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 100 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
      cb(null, true);
    } else {
      cb(new Error('Only JPG/JPEG files allowed'));
    }
  }
});

exports.uploadFiles = (req, res) => {

  console.time("uploadTime");

  upload.array('files', 100)(req, res, async (err) => {

    if (err) {
      return res.send({ error: err.message, status: 400 });
    }

    if (!req.files?.length) {
      return res.send({ error: 'No files uploaded', status: 400 });
    }

    try {
      const {
        user_id,
        folder_id,
        event_id,
        is_ai_upload = false,
        photo_quality = 'basic',
        is_from_camera = false,
        studio_name,
        customer_name,
        customer_id,
        event_name,
        folder_name,
      } = req.body;

      const isAiUpload = parseBoolean(is_ai_upload);
      const isFromCamera = parseBoolean(is_from_camera);
      const publicRoot = isAiUpload ? '/ai-uploads' : '/uploads';

      // const uploadPath = path.join(
      //   root,
      //   `user_${safe(user_id)}`,
      //   `studio_${safe(studio_name)}`,
      //   `customer_${safe(customer_name)}_${safe(customer_id)}`,
      //   `event_${safe(event_name)}_${safe(event_id)}`,
      //   `${safe(folder_name)}_${safe(folder_id)}`
      // );

      // create folder
      // await fs.promises.mkdir(uploadPath, { recursive: true });

      console.timeLog("uploadTime");

      // // write files to disk
      // await Promise.all(
      //   req.files.map(f =>
      //     fs.promises.writeFile(
      //       path.join(uploadPath, f.originalname),
      //       f.buffer
      //     )
      //   )
      // );

      // build DB values (FIXED)
      const values = req.files.map(f => {
        return [
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
        ];
      });

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      console.timeLog("uploadTime");
      await pool.execute(
        `INSERT INTO photos 
         (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready)
         VALUES ${placeholders}`,
        values.flat()
      );

       console.timeLog("uploadTime");

      if (isAiUpload) {
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

      res.status(200).send({
        status: 200,
        message: 'Batch uploaded',
        isFaceDescriptorReady: false
      });

      if (isFromCamera) {
        triggerExternalExtraction(
          folder_id,
          event_id,
          [{ url: getFileUrl(values[0][0]) }],
          ''
        );
      }

    } catch (e) {
      res.status(500).send({ error: e.message, status: 500 });
    }
  });
};


exports.getFiles = async (req, res) => {
  try {
    const [rows] = await pool.execute(
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
      ...formData.getHeaders(),
      maxBodyLength: Infinity,
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

function getFileUrl(path) {
  const normalizedPath = path.replace(/\\/g, '/');
  return `${baseImgUrl}${normalizedPath}`;
}
