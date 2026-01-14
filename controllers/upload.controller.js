const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db_config/db.js');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// ========================
// HELPERS
// ========================
const safe = (v) => String(v).replace(/[^a-zA-Z0-9_-]/g, '');

// ========================
// MULTER STORAGE
// ========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
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

        if (
            !user_id ||
            !studio_name ||
            !event_id ||
            !folder_name ||
            !folder_id
        ) {
            return cb(new Error('Missing required fields'));
        }

        const uploadPath = path.join(
            UPLOAD_ROOT,
            `user_${safe(user_id)}`,
            `studio_${safe(studio_name)}`,
            `customer_${safe(customer_name)}_${safe(customer_id)}`,
            `event_${safe(event_name)}_${safe(event_id)}`,
            `${safe(folder_name)}_${safe(folder_id)}`
        );

        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        cb(null, file.originalname + path.extname(file.originalname));
    }
});

// ========================
// MULTER CONFIG
// ========================
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
    upload.array('files', 5000)(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.files || !req.files.length) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const { user_id, folder_id, event_id, uploadedUrls, is_ai_upload = false, wedding_folder_id = null, photo_quality = 'basic' } = req.body;    //wedding_folder_id is the isFaceDescriptor value , previous it was true or false but now a string 


        console.log(req.body);


        try {
            const values = req.files.map(file => [
                file.path.replace(process.cwd(), ''),
                file.originalname,
                folder_id,
                user_id,
                null,
                false
            ]
            );


            const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
            const flatValues = values.flat();

            const insertQuery = `INSERT INTO photos (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready) VALUES ${placeholders}`;
            await pool.execute(insertQuery, flatValues);

            if (is_ai_upload) {
                await pool.execute('UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?', [false, folder_id]);
                await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [false, event_id]);

                let incrementCount = req.files.length;
                if (photo_quality == 'high') {
                    incrementCount = req.files.length * 10;
                } else if (photo_quality == 'standard') {
                    incrementCount = req.files.length * 3;
                }
                await pool.execute(
                    `UPDATE users 
             SET used_photo_count = used_photo_count + ? 
             WHERE id = ?`,
                    [incrementCount, user_id]
                );
            }

            res.send({ message: "Batch uploaded, descriptor extraction started", status: 200, isFaceDescriptorReady: false });

            if (is_ai_upload) {
                // triggerExternalExtraction(folder_id, event_id, uploadedUrls, wedding_folder_id)
            }

            // await db.query(query, [values]);

            // res.json({
            //     message: 'Upload successful',
            //     files: values
            // });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Database error' });
        }
    });
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