const pool = require('../db_config/db.js');
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');
const path = require('path');
const { loadModels, extractFaceDescriptor, processUploadedPhotosConcurrently } = require('../models/faceapi.js');
const axios = require('axios');
const FormData = require('form-data');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "surajproductions-3f28b.firebasestorage.app"
});

const bucket = admin.storage().bucket();
const multer = require('multer');

const upload = multer();

exports.createEvent = async (req, res) => {
    try {
        const { event_name, customer_id, is_event_submitted, is_ai_upload, quality, razorpay_payment_id = '', browse_all_photo_ai = false, ai_cover_images = JSON.stringify([]), watermark = JSON.stringify({}), youtube_cover_url = '', need_customer_number = false, google_review_url = '', selected_template = '' } = req.body;
        console.log(req.body);

        const value = [event_name, customer_id, is_event_submitted, is_ai_upload, razorpay_payment_id, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, google_review_url, selected_template, req.user.id];
        const [result] = await pool.execute(
            'INSERT INTO events (event_name, customer_id, is_event_submitted, is_ai_upload,payment_id, browse_all_photo_ai, ai_cover_images,watermark,youtube_cover_url,need_customer_number,google_review_url,selected_template, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            value
        );

        if (is_ai_upload) {
            const [row] = await pool.execute(
                'INSERT INTO payments  (user_id,event_id,amount,payment_gateway,payment_status,payment_reference,paid_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
                [req.user.id, result.insertId, req.body.plan_data.price, 'razorpay', 'success', razorpay_payment_id, new Date(), new Date()]
            );
        }
        res.send({ message: 'Event created successfully', status: 200 });
    } catch (err) {
        console.error(err);
        res.send({ error: 'Internal server error', message: "Something went wrong", status: 500 });
    }
};

exports.getAllEvents = async (req, res) => {

    console.log("USER ID ", req.user.id);


    try {

        const query = `SELECT 
    e.id AS event_id,
    e.event_name,
    e.is_ai_upload,
    e.is_event_submitted,
    e.browse_all_photo_ai,
    e.ai_cover_images,
    e.watermark,
    e.youtube_cover_url,
    e.need_customer_number,
    e.google_review_url,
    e.selected_template,
    COUNT(DISTINCT f.id) AS folder_count,
    COUNT(DISTINCT p.id) AS photo_count,
    SUM(CASE WHEN p.is_selected = TRUE THEN 1 ELSE 0 END) AS selected_photo_count,
    cus.id AS customer_id,
    cus.name AS customer_name,
    cus.phone AS customer_phone,
    cus.customer_unique_id AS customer_unique_id
FROM events e
LEFT JOIN folders f ON f.event_id = e.id
LEFT JOIN photos p ON p.folder_id = f.id
LEFT JOIN customers cus ON cus.id = e.customer_id
WHERE e.created_by = ?
GROUP BY e.id
`;

        const [events] = await pool.execute(query, [req.user.id]);
        const [ai_guest] = await pool.execute('SELECT ai.id as ai_guest_id,ai.event_id AS ai_event_id,ai.image_url, ai.guest_name,ai.guest_phone FROM events e LEFT JOIN ai_guests ai ON ai.event_id = e.id');

        const aiGuestMap = {};

        ai_guest.forEach(guest => {
            if (!aiGuestMap[guest.ai_event_id]) {
                aiGuestMap[guest.ai_event_id] = [];
            }

            aiGuestMap[guest.ai_event_id].push({
                ai_guest_id: guest.ai_guest_id,
                guest_name: guest.guest_name,
                guest_phone: guest.guest_phone,
                image_url: guest.image_url
            });
        });

        const mergedEvents = events.map(event => {
            return {
                ...event,
                ai_cover_images: event.ai_cover_images ? JSON.parse(event.ai_cover_images) : [],
                watermark: event.watermark ? JSON.parse(event.watermark) : {},
                is_ai_upload: !!event.is_ai_upload,
                is_event_submitted: !!event.is_event_submitted,
                ai_guests: aiGuestMap[event.event_id] || [],
                need_customer_number: !!event.need_customer_number,
            };
        });
        res.send({ message: 'Events fetched successfully', status: 200, data: mergedEvents?.sort((a, b) => b?.event_id - a?.event_id) });

    } catch (error) {
        res.send({ message: 'Error', error: error, status: 400, data: [] });

    }
}


exports.updateEvent = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { is_event_submitted, event_name, browse_all_photo_ai = false, ai_cover_images = JSON.stringify([]), watermark = JSON.stringify({}), youtube_cover_url = '', need_customer_number = false, google_review_url = '', selected_template = '' } = req.body;

        let query = `UPDATE events SET is_event_submitted = ?, browse_all_photo_ai = ?,ai_cover_images = ?,watermark = ?, youtube_cover_url = ?,need_customer_number = ?,google_review_url = ?,selected_template = ? WHERE id = ?`;
        let value = [is_event_submitted, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, google_review_url, selected_template, +event_id];

        if (event_name) {
            query = `UPDATE events SET is_event_submitted = ?, event_name = ?, browse_all_photo_ai = ?, ai_cover_images = ?,watermark = ?,youtube_cover_url = ?,need_customer_number = ?,google_review_url = ?,selected_template = ? WHERE id = ?`;
            value = [is_event_submitted, event_name, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, google_review_url, selected_template, +event_id];
        }

        const [result] = await pool.execute(query, value);
        res.send({ message: 'Event updated successfully', status: 200 });

    } catch (error) {
        res.send({ message: 'Something went wrong', status: 400, error });
    }
}


exports.getFolderByEventId = async (req, res) => {
    try {
        const { event_id } = req.params;
        const [result] = await pool.execute(`SELECT 
    f.*,
    ev.event_name,
    cus.name AS customer_name,
    p.id AS photo_id,
    p.photo_url
FROM folders f
JOIN events ev 
    ON f.event_id = ev.id
LEFT JOIN customers cus 
    ON ev.customer_id = cus.id
LEFT JOIN (
    SELECT ph.id, ph.folder_id, ph.photo_url
    FROM photos ph
    INNER JOIN (
        SELECT folder_id, MIN(id) AS min_id
        FROM photos
        GROUP BY folder_id
    ) x 
    ON ph.folder_id = x.folder_id AND ph.id = x.min_id
) p 
    ON p.folder_id = f.id
WHERE f.event_id = ?; `, [event_id]);
        res.send({ message: "Folder Fetched", data: result, status: 200 })

    } catch (error) {
        res.send({ message: "Something went wrong", error: error, status: 400 })
    }
}

exports.createNewFolder = async (req, res) => {
    try {
        const { event_id, folder_name } = req.body;
        const [result] = await pool.execute(`INSERT INTO folders (folder_name, event_id) VALUES (?,?)`, [folder_name, event_id]);
        res.send({ message: "Folder Fetched", status: 200 })

    } catch (error) {
        res.send({ message: "Folder Fetched", data: result, status: 200 })
    }
}

exports.updateFolder = async (req, res) => {
    try {

        const { id } = req.params;
        const { folder_name } = req.body;
        const [result] = await pool.execute('UPDATE folders SET folder_name = ? WHERE id = ?', [folder_name, id]);
        res.send({ message: 'Folder name updated successfully', status: 200 });

    }
    catch (error) {
        res.send({ message: 'Something went wrong', status: 400 });
    }
}

exports.deleteFolder = async (req, res) => {
    try {

        const { id } = req.params;
        const [result] = await pool.execute('DELETE FROM folders WHERE id = ?', [id]);
        res.send({ message: 'Delete successfully', status: 200 });

    }
    catch (error) {
        res.send({ message: 'Something went wrong', status: 400 });
    }
}

exports.deleteEvent = async (req, res) => {
    try {

        const { id } = req.params;
        const [paymentDel] = await pool.execute("DELETE FROM payments WHERE event_id = ?", [id]);
        const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [id]);
        res.send({ message: 'Delete successfully', status: 200 });

    }
    catch (error) {
        res.send({ message: 'Something went wrong', status: 400, error });
    }
}

exports.getAiGuestByEventId = async (req, res) => {
    try {
        const { event_id } = req.params;
        const [result] = await pool.execute(`SELECT * FROM ai_guests WHERE event_id = ?`, [event_id]);
        res.send({ message: "Guest Fetched", data: result, status: 200 })

    } catch (error) {
        res.send({ message: 'Something went wrong', status: 400 });
    }
}

exports.getEventById = async (req, res) => {
    try {
        const { event_id } = req.params;
        const [result] = await pool.execute(`SELECT ev.*,user.* FROM events ev JOIN users user ON ev.created_by = user.id WHERE ev.id = ?`, [event_id]);
        res.send({ message: "Event Fetched", data: result[0], status: 200 })

    } catch (error) {
        res.send({ message: 'Something went wrong', error: error, status: 400 });
    }
}

exports.addAiGuest = async (req, res) => {
    try {
        const { event_id, guest_name, guest_phone, created_by, customer_unique_id = '', image_url = '' } = req.body;
        console.log(req.body);
        const [result] = await pool.execute(`INSERT INTO ai_guests (event_id,guest_name,guest_phone,created_by,customer_unique_id,image_url) VALUES (?,?,?,?,?,?)`, [event_id, guest_name, guest_phone, created_by, customer_unique_id, image_url]);
        res.send({ message: "AI Guest Added", data: result, status: 200 })

    } catch (error) {
        res.send({ message: 'Something went wrong', err: error, status: 400 });
    }
}


exports.getUploadedPhotosByFolderId = async (req, res) => {
    try {
        const { folder_id } = req.params;
        // const user_id = req.user.id;
        const query = `SELECT 
    c.name,
    c.customer_unique_id,
    e.event_name,
    e.id AS event_id,
    e.is_event_submitted,
    e.watermark,
    e.youtube_cover_url,
    e.need_customer_number,
    e.google_review_url,
    e.selected_template,
    e.isFaceDescriptorReady,
    f.folder_name,
    f.id AS folder_id,
    p.id AS photo_id,
    p.photo_url,
    p.uploaded_by,
    p.photo_name,
    p.is_selected,
    p.is_favourite,
    p.face_descriptor
FROM folders f
JOIN events e ON f.event_id = e.id
JOIN customers c ON e.customer_id = c.id
LEFT JOIN photos p ON p.folder_id = f.id
WHERE f.id = ?;`
        const [result] = await pool.execute(query, [folder_id]);

        const response = {
            customer_name: result[0]?.name,
            customer_unique_id: result[0]?.customer_unique_id,
            event_name: result[0]?.event_name,
            event_id: result[0]?.event_id,
            folder_name: result[0]?.folder_name,
            folder_id: result[0]?.folder_id,
            is_event_submitted: !!result[0]?.is_event_submitted,
            selectedPhotosCount: result.filter(row => row.is_selected).length,
            watermark: result[0]?.watermark,
            youtube_cover_url: result[0]?.youtube_cover_url,
            google_review_url: result[0]?.google_review_url,
            selected_template: result[0]?.selected_template,
            need_customer_number: !!result[0]?.need_customer_number,
            isFaceDescriptorReady: result[0]?.isFaceDescriptorReady,
            photos: result
                .filter(row => row.photo_id !== null)
                .map(row => ({
                    photo_id: row.photo_id,
                    photo_url: row.photo_url,
                    uploaded_by: row.uploaded_by,
                    photo_name: row.photo_name,
                    is_selected: !!row.is_selected,
                    is_favourite: !!row.is_favourite,
                    face_descriptor: row.face_descriptor || ''
                }))
        };

        res.send({ message: "Photos fetched", data: response, status: 200 })

    } catch (error) {
        console.log(error);

        res.send({ message: 'Something went wrong', status: 400 });
    }
}

// exports.uploadPhotos = async (req, res) => {
//     try {
//         const { uploaded_by, folder_id, uploadedUrls } = req.body;

//         const values = uploadedUrls.map(photo => [
//             photo.url,
//             photo.name,
//             folder_id,
//             uploaded_by
//         ]);

//         const flatValues = values.flat(); // flatten for query placeholders

//         const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');

//         const query = `INSERT INTO photos (photo_url, photo_name, folder_id,uploaded_by) VALUES ${placeholders}`;

//         const [result] = await pool.execute(query, flatValues);
//         res.send({ message: "Photos uploaded", data: result, status: 200 })

//     } catch (error) {
//         res.send({ message: "Something went wrong", data: null, error: error, status: 400 })
//     }
// }


function extractFirebasePath(url) {
    try {
        const decodedUrl = decodeURIComponent(url);
        const match = decodedUrl.match(/\/o\/(.*?)\?/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

exports.deletePhotos = async (req, res) => {
    const photos = req.body.photos;
    const { folder_id } = req.body;
    if (!Array.isArray(photos) || photos.length === 0) {
        return res.status(400).json({ message: 'Invalid photo data' });
    }

    const fileDeletePromises = [];
    const photoIds = [];

    for (const photo of photos) {
        const { id, url } = photo;
        const filePath = extractFirebasePath(url);

        if (!filePath || !id) continue;

        photoIds.push(id);
        fileDeletePromises.push(bucket.file(filePath).delete().catch(err => {
            console.error(`Failed to delete ${filePath}`, err.message);
        }));
    }

    try {
        await Promise.all(fileDeletePromises);

        if (photoIds.length > 0) {
            const placeholders = photoIds.map(() => '?').join(',');
            const deleteQuery = `DELETE FROM photos WHERE folder_id = ${folder_id} AND id IN (${placeholders})`;
            await pool.execute(deleteQuery, photoIds);
        }

        return res.send({ message: 'Photos deleted successfully', status: 200 });
    } catch (err) {
        console.error('Bulk deletion failed:', err);
        return res.send({ message: 'Server error during deletion', status: 500 });
    }
};

exports.verifyUniqueCode = async (req, res) => {
    try {
        const { code } = req.body;

        const query = `SELECT 
        ev.is_event_submitted,
         c.id 
         FROM customers c 
         JOIN events ev ON ev.customer_id = c.id
        WHERE c.customer_unique_id = ?`

        const [codeQuery] = await pool.execute(query, [code]);

        if (codeQuery[0]?.id) {
            res.send({ message: "Code Verified", is_event_submitted: !!codeQuery[0]?.is_event_submitted, status: 200 })
        } else {
            res.send({ message: "Invalid Code", status: 400 })
        }
    } catch (error) {
        res.send({ message: "Something went wrong", data: null, error: error, status: 400 })
    }
};


exports.getFolderListByCustomerCode = async (req, res) => {
    try {
        const { code } = req.body;
        const query = `
       SELECT f.id AS folder_id,
        f.folder_name,
        e.event_name,
        e.id AS event_id,
        c.name AS customer_name,
        c.customer_unique_id,
        COUNT(p.id) AS photo_count,
         SUM(CASE WHEN p.is_selected = TRUE THEN 1 ELSE 0 END) AS selected_photo_count
        FROM folders f
        JOIN events e ON f.event_id = e.id
        JOIN customers c ON e.customer_id = c.id
       LEFT JOIN 
    photos p ON p.folder_id = f.id
        WHERE c.customer_unique_id = ?
        GROUP BY 
    f.id, f.folder_name, e.event_name, e.id, c.name, c.customer_unique_id`;

        const [result] = await pool.execute(query, [code]);

        const response = {
            customer_name: result[0]?.customer_name,
            customer_unique_id: result[0]?.customer_unique_id,
            event_name: result[0]?.event_name,
            event_id: result[0]?.event_id,
            photo_count: result.reduce((total, row) => total + row.photo_count, 0),
            selectedPhotosCount: result.reduce((total, row) => total + +row.selected_photo_count, 0),
            folders: result.map(row => ({
                folder_name: row.folder_name,
                folder_id: row.folder_id
            }))
        };

        res.send({ message: "Folders fetched", data: response, status: 200 })
    }
    catch (error) {
        res.send({ message: "Something went wrong", data: null, error: error, status: 400 })
    }
};

exports.updatePhotoStatus = async (req, res) => {
    try {
        const { is_selected, is_favourite, folder_id, photo_id } = req.body;
        const [result] = await pool.execute('UPDATE photos SET is_selected = ?, is_favourite = ? WHERE id = ? AND folder_id = ?', [is_selected, is_favourite, photo_id, folder_id]);
        res.send({ message: 'Photo status updated successfully', status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};

exports.submitEvent = async (req, res) => {
    try {
        const { event_id } = req.body;
        const [result] = await pool.execute('UPDATE events SET is_event_submitted = 1 WHERE id = ?', [event_id]);
        res.send({ message: 'Event submitted successfully', status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};


// exports.getAllPhotosByEventId = async (req, res) => {
//     try {
//         const { event_id } = req.params;
//         const { user } = req.query;

//         const [result] = await pool.execute('SELECT p.*,f.folder_name FROM photos p JOIN folders f ON p.folder_id = f.id WHERE folder_id IN (SELECT id FROM folders WHERE event_id = ?) AND uploaded_by = ?', [event_id, user]);
//         res.send({ message: 'Photos fetched successfully', data: result, status: 200 });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Internal server error' });
//     }
// };

// exports.getAllPhotosByEventId = async (req, res) => {
//     try {
//         let { event_id } = req.params;
//         let { user, page = 1, limit = 50 } = req.query;

//         let offset = (page - 1) * limit;

//         event_id = Number(event_id);
//         user = Number(user);
//         page = Number(page);
//         limit = Number(limit);


//         // Get total count
//         const [countResult] = await pool.query(
//             `SELECT COUNT(DISTINCT p.id) as total 
//              FROM photos p 
//              JOIN folders f ON p.folder_id = f.id 
//              WHERE f.event_id = ? AND p.uploaded_by = ?`,
//             [event_id, user]
//         );

//         const total = countResult[0].total;

//         const query = `
//     SELECT DISTINCT p.id, p.photo_url, p.uploaded_by, p.folder_id,
//                     p.photo_name, p.face_descriptor, p.descriptor_ready,
//                     p.is_selected, p.is_favourite, f.folder_name
//      FROM photos p
//      JOIN folders f ON p.folder_id = f.id
//      WHERE f.event_id = ${event_id} AND p.uploaded_by = ${user}
//      ORDER BY f.folder_name, p.id ASC
//      LIMIT ${limit} OFFSET ${offset}
// `;



//         // Fetch paginated data - DISTINCT to avoid duplicates
//         const [result] = await pool.query(
//             `SELECT DISTINCT p.id, p.photo_url, p.uploaded_by, p.folder_id, 
//                     p.photo_name, p.face_descriptor, p.descriptor_ready, 
//                     p.is_selected, p.is_favourite, f.folder_name
//              FROM photos p 
//              JOIN folders f ON p.folder_id = f.id 
//              WHERE f.event_id = ? AND p.uploaded_by = ?
//              ORDER BY f.folder_name, p.id ASC
//              LIMIT ? OFFSET ?`,
//             [event_id, user, limit, offset]
//         );

//         res.send({
//             message: 'Photos fetched successfully',
//             data: result,
//             pagination: {
//                 total,
//                 page: parseInt(page),
//                 limit: parseInt(limit),
//                 totalPages: Math.ceil(total / limit),
//                 currentCount: result.length
//             },
//             status: 200
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Internal server error' });
//     }
// };



exports.getAllPhotosByEventId = async (req, res) => {
    try {
        let { event_id } = req.params;
        let { user, page = 1, limit = 50, folder_id } = req.query;

        let offset = (page - 1) * limit;

        event_id = Number(event_id);
        user = Number(user);
        page = Number(page);
        limit = Number(limit);
        folder_id = folder_id ? Number(folder_id) : null;

        // Count query
        let countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM photos p
            JOIN folders f ON p.folder_id = f.id
            WHERE f.event_id = ? AND p.uploaded_by = ?
        `;

        let countParams = [event_id, user];
        if (folder_id) {
            countQuery += ` AND f.id = ?`;
            countParams.push(folder_id);
        }

        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        // Data query
        let dataQuery = `
            SELECT DISTINCT p.id, p.photo_url, p.uploaded_by, p.folder_id,
                            p.photo_name, p.face_descriptor, p.descriptor_ready,
                            p.is_selected, p.is_favourite, f.folder_name
            FROM photos p
            JOIN folders f ON p.folder_id = f.id
            WHERE f.event_id = ? AND p.uploaded_by = ?
        `;
        let dataParams = [event_id, user];

        if (folder_id) {
            dataQuery += ` AND f.id = ?`;
            dataParams.push(folder_id);
        }

        dataQuery += ` ORDER BY f.folder_name, p.id ASC LIMIT ? OFFSET ?`;
        dataParams.push(limit, offset);

        const [result] = await pool.query(dataQuery, dataParams);

        res.send({
            message: 'Photos fetched successfully',
            data: result,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                currentCount: result.length
            },
            status: 200
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};


exports.getFoldersByEventId = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { user } = req.query;

        const eventId = parseInt(event_id, 10);
        const userId = parseInt(user, 10);

        if (isNaN(eventId) || isNaN(userId)) {
            return res.status(400).send({ error: 'Invalid parameters' });
        }

        const query = `
            SELECT 
                f.id as folder_id,
                f.folder_name,
                COUNT(p.id) as photo_count
            FROM folders f
            LEFT JOIN photos p ON f.id = p.folder_id AND p.uploaded_by = ${userId}
            WHERE f.event_id = ${eventId}
            GROUP BY f.id, f.folder_name
            HAVING photo_count > 0
            ORDER BY f.folder_name ASC
        `;

        const [folders] = await pool.query(query);

        res.send({
            message: 'Folders fetched successfully',
            data: folders,
            status: 200
        });
    } catch (err) {
        console.error('ERROR:', err);
        res.status(500).send({
            error: 'Internal server error',
            message: err.message
        });
    }
};

// exports.getAllPhotosByEventId = async (req, res) => {
//     try {
//         const { event_id } = req.params;
//         const { user, page = 1, limit = 10 } = req.query; // Default 50 photos per request

//         console.log(event_id, user , page, limit);


//         const offset = (page - 1) * limit;

//         // Get total count for pagination info
//         const [countResult] = await pool.execute(
//             'SELECT COUNT(*) as total FROM photos p WHERE folder_id IN (SELECT id FROM folders WHERE event_id = ?) AND uploaded_by = ?', 
//             [event_id, user]
//         );

//         const total = countResult[0].total;

//         // Fetch paginated data with proper indexing
//         const [result] = await pool.execute(
//             `SELECT p.*, f.folder_name 
//              FROM photos p 
//              JOIN folders f ON p.folder_id = f.id 
//              WHERE f.event_id = ? AND p.uploaded_by = ?
//              ORDER BY p.id DESC
//              LIMIT ? OFFSET ?`,
//             [event_id, user, parseInt(limit), offset]
//         );

//         res.send({ 
//             message: 'Photos fetched successfully', 
//             data: result, 
//             pagination: {
//                 total,
//                 page: parseInt(page),
//                 limit: parseInt(limit),
//                 totalPages: Math.ceil(total / limit)
//             },
//             status: 200 
//         });
//     } catch (err) {
//         console.error(err);
//         res.status(500).send({ error: 'Internal server error' });
//     }
// };


let modelsLoaded = false;
const processingFolders = new Map();
const eventProcessingMap = new Map();
let index = 0;

exports.uploadPhotos = async (req, res) => {
    try {
        const { uploaded_by, folder_id, event_id, uploadedUrls, is_ai_upload = false, wedding_folder_id = null } = req.body;    //wedding_folder_id is the isFaceDescriptor value , previous it was true or false but now a string 

        if (!uploadedUrls || uploadedUrls.length === 0) {
            return res.status(400).send({ message: "No photos uploaded", status: 400 });
        }

        const values = uploadedUrls.map(photo => [
            photo.url,
            photo.name,
            folder_id,
            uploaded_by,
            null,
            false
        ]);

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
        const flatValues = values.flat();

        const insertQuery = `INSERT INTO photos (photo_url, photo_name, folder_id, uploaded_by, face_descriptor, descriptor_ready) VALUES ${placeholders}`;
        await pool.execute(insertQuery, flatValues);

        if (is_ai_upload) {
            await pool.execute('UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?', [false, folder_id]);
            await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [false, event_id]);
        }

        res.status(200).send({ message: "Batch uploaded, descriptor extraction started", status: 200, isFaceDescriptorReady: false });

        if (is_ai_upload) {
            // triggerExternalExtraction(folder_id, event_id, uploadedUrls, wedding_folder_id)
        }
    } catch (error) {
        res.status(500).send({ message: "Upload failed", error: error.message, status: 500 });
    }
};
// exports.checkEventReady = async (req, res) => {
//     try {
//         const { event_id } = req.params;

//         const [[event]] = await pool.execute(
//             'SELECT isFaceDescriptorReady FROM events WHERE id = ?',
//             [event_id]
//         );

//         if (!event) {
//             return res.status(404).json({ message: "Event not found" });
//         }

//         const isStillProcessing = eventProcessingMap.has(Number(event_id));
//         res.json({ isFaceDescriptorReady: !!event.isFaceDescriptorReady && !isStillProcessing });
//     } catch (error) {
//         res.status(500).json({ message: "Server error", error: error.message });
//     }
// };



exports.checkEventReady = async (req, res) => {
    try {
        const { wedding_folder_id } = req.params;

        // const params = {
        //     "input": {
        //         "method": "GET",
        //         "path": `/check_status/${wedding_folder_id}`,
        //     }
        // }

        // const url = `https://api.runpod.ai/v2/u9d9u5olceg3dd/runsync`;

        // const headers = {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`

        // };
        // http://157.173.221.163:8003

        const url = `http://157.173.221.163:8888/check_status/${wedding_folder_id}`;


        const response = await axios.get(url);
        res.send({ data: response.data })

        // const eId = Number(req.params.event_id);
        // const [[event]] = await pool.execute(
        //     'SELECT isFaceDescriptorReady FROM events WHERE id = ?',
        //     [eId]
        // );

        // const m = eventProcessingMap.get(eId);
        // let stillProcessing = false;
        // if (m) for (const { pending } of m.values()) { if (pending > 0) { stillProcessing = true; break; } }

        // res.json({ isFaceDescriptorReady: !!event.isFaceDescriptorReady && !stillProcessing });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message,error });
    }
};


exports.checkIsBrowseAllFolderStatus = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { user_id } = req.query;

        const [[event]] = await pool.execute(
            'SELECT browse_all_photo_ai FROM events WHERE id = ? AND created_by = ?',
            [event_id, user_id]
        );

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.send({ status: 200, data: !!event.browse_all_photo_ai });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

// async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
//     try {

//         console.log(uploadedUrls.length, "photos to be uploaded", index);
//         index++;

//         if (!eventProcessingMap.has(event_id)) {
//             eventProcessingMap.set(event_id, new Set());
//         }
//         eventProcessingMap.get(event_id).add(folder_id);

//         const [[row]] = await pool.execute('SELECT event_name FROM events WHERE id = ?', [event_id]);


//         const formData = new FormData();
//         formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url))); // array of URLs
//         formData.append('wedding_name', row.event_name); // you can make this dynamic
//         if (upload_folder_id) formData.append('wedding_folder_id', upload_folder_id);
//         // https://81ca5f69-cc38-48e6-8359-5a575ac4d036-00-16uzz8s2qqhet.worf.replit.dev

//         //https://fp4xi6xrzdflsh-8888.proxy.runpod.net/?token=eg8b93bwxzw4wbjqeqyk

//         //http://157.173.221.163:8003


//         axios.post('https://fp4xi6xrzdflsh-8888.proxy.runpod.net/upload_urls', formData, {
//             headers: formData.getHeaders(),
//             maxBodyLength: Infinity, // handle large payloads
//         })
//             .then(async (response) => {
//                 const { wedding_folder_id } = response.data;

//                 // await pool.execute(
//                 //     'UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?',
//                 //     [true, folder_id]
//                 // );
//                 // await pool.execute(
//                 //     'UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?',
//                 //     [true, event_id]
//                 // );

//                 console.log("EENT PROCESS HERE", eventProcessingMap);



//                 await pool.execute('UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?', [true, folder_id]);

//                 eventProcessingMap.get(event_id).delete(folder_id);

//                 if (eventProcessingMap.get(event_id).size == 0) {
//                     await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [true, event_id]);
//                     eventProcessingMap.delete(event_id);  // Clean up map
//                 }

//                 console.log("✅ Extraction completed:", wedding_folder_id);
//             })
//             .catch(err => {
//                 console.error("⚠️ External API failed:", err);
//             });

//     } catch (error) {
//         console.error("⚠️ triggerExternalExtraction error:", error.message);
//     }
// };

// async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
//     const eId = Number(event_id);
//     const fId = Number(folder_id);
//     let failed = false;

//     try {
//         console.log(uploadedUrls.length, "photos to be uploaded", index);
//         index++;

//         incPending(eId, fId);

//         const [[row]] = await pool.execute('SELECT event_name FROM events WHERE id = ?', [eId]);

//         const formData = new FormData();
//         formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url)));
//         formData.append('wedding_name', row?.event_name || `event_${eId}`);
//         if (upload_folder_id) formData.append('wedding_folder_id', upload_folder_id);

//         // RUN POD OLD : https://fp4xi6xrzdflsh-8888.proxy.runpod.net

//         const response = await axios.post(
//             'https://fvu6bziok1xwyc-8888.proxy.runpod.net/upload_urls',
//             formData,
//             { headers: formData.getHeaders(), maxBodyLength: Infinity }
//         );

//         console.log("✅ Extraction completed:", response.data?.wedding_folder_id);
//     } catch (err) {
//         failed = true;
//         console.error("⚠️ External API failed:", err?.message || err);
//     } finally {
//         const { folderDone, eventDone, folderFailures } = decPending(eId, fId, failed);

//         // Mark folder ready only when ALL its batches finished and none failed
//         if (folderDone && folderFailures === 0) {
//             await pool.execute(
//                 'UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?',
//                 [true, fId]
//             );
//         }

//         // When event’s all folders are done, flip event flag iff no folder had failures
//         if (eventDone) {
//             const folderMap = eventProcessingMap.get(eId);
//             let anyFailures = false;
//             if (folderMap) {
//                 for (const v of folderMap.values()) { if (v.failures > 0) { anyFailures = true; break; } }
//             }
//             if (!anyFailures) {
//                 await pool.execute(
//                     'UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?',
//                     [true, eId]
//                 );
//             }
//             // cleanup
//             eventProcessingMap.delete(eId);
//         }
//     }
// }



async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
    try {
        //no use of upload folder_id
        // if (!eventProcessingMap.has(event_id)) {
        //     eventProcessingMap.set(event_id, new Set());
        // }
        // eventProcessingMap.get(event_id).add(folder_id);

        const [[row]] = await pool.execute('SELECT event_name FROM events WHERE id = ?', [event_id]);


        const formData = new FormData();
        formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url))); // array of URLs
        formData.append('wedding_name', row.event_name); // you can make this dynamic

        let ai_folder_id = `${row.event_name?.split(" ")?.join("_")}_${event_id}`;

        console.log("WEDDING FOLDE IDE", ai_folder_id);


        if (ai_folder_id) formData.append('wedding_folder_id', ai_folder_id);

        //hostinger server ; http://157.173.221.163:8003

        const params = {
            "input": {
                "method": "POST",
                "path": `/upload_urls`,
                "body": {
                    "image_urls": JSON.stringify(uploadedUrls.map(u => u.url)),
                    "wedding_name": row.event_name,
                    "wedding_folder_id": ai_folder_id,
                    "bulk_mode": true,
                    "async_mode": true,
                }

            }
        }

        const url = `https://api.runpod.ai/v2/u9d9u5olceg3dd/runsync`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
        };


        axios.post(url, params, { headers }, {
            maxBodyLength: Infinity, // handle large payloads
        })
            .then(async (response) => {
                const { wedding_folder_id } = response.data;

                // eventProcessingMap.get(event_id).delete(folder_id);

                // if (eventProcessingMap.get(event_id).size == 0) {
                //     eventProcessingMap.delete(event_id);  // Clean up map
                // }

                console.log("✅ Extraction completed:", response.data);
            })
            .catch(err => {
                console.error("⚠️ External API failed:", err);
            });

    } catch (error) {
        console.error("⚠️ triggerExternalExtraction error:", error.message);
    }
};




exports.findPerson = async (req, res) => {
    try {
        console.log('Request Body:', req.body.wedding_folder_id);
        console.log('Request File:', req.file);

        const { wedding_folder_id } = req.body;
        const input_img = req.file;

        // Ensure input_img and wedding_folder_id are provided
        if (!input_img || !wedding_folder_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: input_img and wedding_folder_id are required"
            });
        }

        // Convert image buffer to base64 (without MIME prefix - just the raw base64 string)
        // const base64Image = input_img.buffer.toString("base64");

        // // Prepare request for RunPod API
        // const params = {
        //     "input": {
        //         "method": "POST",
        //         "path": "/find_person",
        //         "body": {
        //             "input_img": base64Image,  // Handler will convert this to input_img_base64
        //             "wedding_folder_id": wedding_folder_id
        //         }
        //     }
        // };

        // const url = "https://api.runpod.ai/v2/u9d9u5olceg3dd/runsync";
        // const headers = {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`
        // };

        // console.log('📤 Sending request to RunPod...');

        const formData = new FormData();
        formData.append('input_img', input_img.buffer, { filename: 'captured_image.jpeg' }); // input_img should be a buffer from the uploaded file
        formData.append('wedding_folder_id', wedding_folder_id);


        const response = await axios.post(`http://157.173.221.163:8888/find_person`, formData, { ...formData.getHeaders(), maxBodyLength: Infinity });


        // RunPod response structure:
        // {
        //   "id": "...",
        //   "status": "COMPLETED",
        //   "output": {
        //     "body": {
        //       "status": true/false,
        //       "message": "...",
        //       "match_count": 3,
        //       "matches": [...]
        //     },
        //     "statusCode": 200
        //   }
        // }

        // Extract the actual response body
        const responseBody = response.data;
        const statusCode = response.data?.status;

        console.log("GOT FIND PEROSN RESPONE",response.data);
        return res.json({
            success: statusCode,
                    status:200,
            message: responseBody.message || 'Face matched successfully!',
            match_count: responseBody.match_count || responseBody.matches?.length || 0,
            matches: responseBody.matches || [],
            data: responseBody
        });

    } catch (error) {
        console.error('❌ Error during face match process:', error);
        // Handle axios errors
        if (error.response) {
            // API responded with error status
            const errorBody = error.response.data?.output?.body || error.response.data;
            return res.status(error.response.status || 500).json({
                success: false,
                message: 'API request failed',
                error: errorBody?.message || error.message,
                data: errorBody
            });
        } else if (error.request) {
            // Request was made but no response received
            return res.status(500).json({
                success: false,
                message: 'No response from API',
                error: 'Network error or timeout'
            });
        } else {
            // Error setting up the request
            return res.status(500).json({
                success: false,
                message: 'Failed to process face match',
                error: error.message
            });
        }
    }
};


exports.checkHasUserAlreadyReviewed = async (req, res) => {
    try {
        const { phone, user_id } = req.body;

        const [[row]] = await pool.execute(
            'SELECT COUNT(*) AS count FROM ai_guests WHERE guest_phone = ? AND created_by = ?',
            [phone, user_id]
        );
        res.send({ status: 200, data: row.count > 1 });

    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

exports.getTotalUploadedAiPhotosCount = async (req, res) => {
    try {
        const userId = req.user.id;  // Get the user ID from the request

        // Query to count AI-uploaded photos across all events, folders, and photos for the given user
        const [[{ total_count }]] = await pool.execute(
            `SELECT COUNT(*) AS total_count
            FROM photos p
            JOIN folders f ON p.folder_id = f.id
            JOIN events e ON f.event_id = e.id
            WHERE e.created_by = ?
              AND e.is_ai_upload = 1`,  // Ensure we only count photos from AI-uploaded events
            [userId]  // Bind the userId to the query
        );

        // Return the count
        res.send({ status: 200, data: total_count });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


exports.updateFaceDescriptorEvent = async (req, res) => {
    try {
        const { event_id } = req.params;

        await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [true, event_id]);
        // await pool.execute(`
        //     UPDATE photos 
        //     SET descriptor_ready = 1 
        //     WHERE folder_id IN (
        //         SELECT id FROM folders WHERE event_id = ?
        //     )
        // `, [event_id]);

        res.send({ message: 'Folder and event updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update folder and event' });
    }
}

exports.reUploadFaceDescriptor = async (req, res) => {
    const { event_id } = req.params;
    try {
        const [rows] = await pool.query(`
      SELECT 
          e.created_by AS uploaded_by,
          e.is_ai_upload,
          e.event_name,
          e.id AS event_id,
          f.id AS folder_id,
          p.photo_url AS url,
          p.photo_name AS name
      FROM events e
      JOIN folders f ON f.event_id = e.id
      JOIN photos p ON p.folder_id = f.id
      WHERE e.id = ?;
    `, [event_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Event not found or no photos.' });
        }

        const response = {
            uploadedUrls: rows.map(row => ({
                folder_id: row.folder_id,
                url: row.url,
                name: row.name
            })),
            uploaded_by: rows[0].uploaded_by,
            event_id: rows[0].event_id,
            is_ai_upload: !!rows[0].is_ai_upload,
            wedding_folder_id: rows[0].wedding_folder_id
        };

        await triggerExternalExtraction('', event_id, response.uploadedUrls, '');

        res.send({ status: 200, message: 'Photos re-uploaded for face process successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error', message: "Something went wrong" });
    }
}