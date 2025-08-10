const pool = require('../db_config/db.js');
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "surajproductions-3f28b.firebasestorage.app"
});

const bucket = admin.storage().bucket();

exports.createEvent = async (req, res) => {
    try {
        const { event_name, customer_id, is_event_submitted, is_ai_upload, quality,razorpay_payment_id='' } = req.body;
        const value = [event_name, customer_id, is_event_submitted, is_ai_upload,razorpay_payment_id, req.user.id];
        const [result] = await pool.execute(
            'INSERT INTO events (event_name, customer_id, is_event_submitted, is_ai_upload,payment_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            value
        );

        if(is_ai_upload){
            const [row] = await pool.execute(
                'INSERT INTO payments  (user_id,event_id,amount,payment_gateway,payment_status,payment_reference,paid_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
                [req.user.id, result.insertId, req.body.plan_data.price, 'razorpay', 'success', razorpay_payment_id, new Date(), new Date()]
            );
        }
        res.send({ message: 'Event created successfully', status: 200 });
    } catch (err) {
        console.error(err);
        res.send({ error: 'Internal server error',message: "Something went wrong", status: 500 });
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
    COUNT(DISTINCT f.id) AS folder_count,
    COUNT(DISTINCT p.id) AS photo_count,
    COUNT(DISTINCT ps.id) AS selected_photo_count,
    cus.id AS customer_id,
    cus.name AS customer_name,
    cus.phone AS customer_phone,
    cus.customer_unique_id AS customer_unique_id
FROM events e
LEFT JOIN folders f ON f.event_id = e.id
LEFT JOIN photos p ON p.folder_id = f.id
LEFT JOIN photo_selections ps ON ps.photo_id = p.id
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
                is_ai_upload: !!event.is_ai_upload,
                is_event_submitted: !!event.is_event_submitted,
                ai_guests: aiGuestMap[event.event_id] || []
            };
        });
        res.send({ message: 'Events fetched successfully', status: 200, data: mergedEvents });

    } catch (error) {
        res.send({ message: 'Error', error: error, status: 400, data: [] });

    }
}


exports.updateEvent = async (req, res) => {
    try {

        const { event_id } = req.params;
        const { is_event_submitted, event_name } = req.body;
        let query = `UPDATE events SET is_event_submitted = ? WHERE id = ?`;
        let value = [is_event_submitted, +event_id];
        if (event_name) {
            query = `UPDATE events SET is_event_submitted = ?, event_name = ? WHERE id = ?`;
            value = [is_event_submitted, event_name, +event_id];
        }

        const [result] = await pool.execute(query, value);
        res.send({ message: 'Event updated successfully', status: 200 });

    }
    catch (error) {
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
          res.send({ message: "Something went wrong", error:error,status: 400 })
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
        const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [id]);
        res.send({ message: 'Delete successfully', status: 200 });

    }
    catch (error) {
        res.send({ message: 'Something went wrong', status: 400 });
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
        const { event_id, guest_name, guest_phone, image_url } = req.body;
        const [result] = await pool.execute(`INSERT INTO ai_guests (event_id,guest_name,guest_phone,image_url,created_by) VALUES (?,?,?,?,?)`, [event_id, guest_name, guest_phone, image_url, req.user.id]);
        res.send({ message: "AI Guest Added", data: result, status: 200 })

    } catch (error) {
        res.send({ message: 'Something went wrong', status: 400 });
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
    f.folder_name,
    f.id AS folder_id,
    p.id AS photo_id,
    p.photo_url,
    p.uploaded_by,
    p.photo_name,
    p.is_selected,
    p.is_favourite
FROM folders f
JOIN events e ON f.event_id = e.id
JOIN customers c ON e.customer_id = c.id
LEFT JOIN photos p ON p.folder_id = f.id
WHERE f.id = ?;

        `
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
            photos: result
                .filter(row => row.photo_id !== null)
                .map(row => ({
                    photo_id: row.photo_id,
                    photo_url: row.photo_url,
                    uploaded_by: row.uploaded_by,
                    photo_name: row.photo_name,
                    is_selected: !!row.is_selected,
                    is_favourite: !!row.is_favourite
                }))
        };

        res.send({ message: "Photos fetched", data: response, status: 200 })

    } catch (error) {
        console.log(error);

        res.send({ message: 'Something went wrong', status: 400 });
    }
}

exports.uploadPhotos = async (req, res) => {
    try {
        const { uploaded_by, folder_id, uploadedUrls } = req.body;

        const values = uploadedUrls.map(photo => [
            photo.url,
            photo.name.name,
            folder_id,
            uploaded_by
        ]);

        const flatValues = values.flat(); // flatten for query placeholders

        const placeholders = values.map(() => '(?, ?, ?, ?)').join(',');

        const query = `INSERT INTO photos (photo_url, photo_name, folder_id,uploaded_by) VALUES ${placeholders}`;

        const [result] = await pool.execute(query, flatValues);
        res.send({ message: "Photos uploaded", data: result, status: 200 })

    } catch (error) {
        res.send({ message: "Something went wrong", data: null, error: error, status: 400 })
    }
}


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


exports.getAllPhotosByEventId = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { user } = req.query;

        const [result] = await pool.execute('SELECT * FROM photos WHERE folder_id IN (SELECT id FROM folders WHERE event_id = ?) AND uploaded_by = ?', [event_id, user]);
        res.send({ message: 'Photos fetched successfully', data: result, status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};