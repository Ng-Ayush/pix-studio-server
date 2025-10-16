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
        const { event_name, customer_id, is_event_submitted, is_ai_upload, quality, razorpay_payment_id = '', browse_all_photo_ai = false, ai_cover_images = JSON.stringify([]), watermark = JSON.stringify({}), youtube_cover_url = '', need_customer_number = false } = req.body;
        console.log(req.body);

        const value = [event_name, customer_id, is_event_submitted, is_ai_upload, razorpay_payment_id, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, req.user.id];
        const [result] = await pool.execute(
            'INSERT INTO events (event_name, customer_id, is_event_submitted, is_ai_upload,payment_id, browse_all_photo_ai, ai_cover_images,watermark,youtube_cover_url,need_customer_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        res.send({ message: 'Events fetched successfully', status: 200, data: mergedEvents });

    } catch (error) {
        res.send({ message: 'Error', error: error, status: 400, data: [] });

    }
}


exports.updateEvent = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { is_event_submitted, event_name, browse_all_photo_ai = false, ai_cover_images = JSON.stringify([]), watermark = JSON.stringify({}), youtube_cover_url = '', need_customer_number = false } = req.body;

        let query = `UPDATE events SET is_event_submitted = ?, browse_all_photo_ai = ?,ai_cover_images = ?,watermark = ?, youtube_cover_url = ?,need_customer_number = ? WHERE id = ?`;
        let value = [is_event_submitted, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, +event_id];

        if (event_name) {
            query = `UPDATE events SET is_event_submitted = ?, event_name = ?, browse_all_photo_ai = ?, ai_cover_images = ?,watermark = ?,youtube_cover_url = ?,need_customer_number = ? WHERE id = ?`;
            value = [is_event_submitted, event_name, browse_all_photo_ai, ai_cover_images, watermark, youtube_cover_url, need_customer_number, +event_id];
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
            watermark: result[0]?.watermark,
            youtube_cover_url: result[0]?.youtube_cover_url,
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


exports.getAllPhotosByEventId = async (req, res) => {
    try {
        const { event_id } = req.params;
        const { user } = req.query;

        const [result] = await pool.execute('SELECT p.*,f.folder_name FROM photos p JOIN folders f ON p.folder_id = f.id WHERE folder_id IN (SELECT id FROM folders WHERE event_id = ?) AND uploaded_by = ?', [event_id, user]);
        res.send({ message: 'Photos fetched successfully', data: result, status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};

let modelsLoaded = false;
const processingFolders = new Map();
const eventProcessingMap = new Map();

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
            triggerExternalExtraction(folder_id, event_id, uploadedUrls, wedding_folder_id)
        }
    } catch (error) {
        res.status(500).send({ message: "Upload failed", error: error.message, status: 500 });
    }
};

function enqueueFolderBatch(folder_id, event_id, batchPhotos) {
    if (!processingFolders.has(folder_id)) {
        processingFolders.set(folder_id, { busy: false, queue: [] });
    }
    const folderData = processingFolders.get(folder_id);
    folderData.queue.push({ event_id, batchPhotos });

    if (!folderData.busy) {
        processFolderQueue(folder_id);
    }
}

async function processFolderQueue(folder_id) {
    const folderData = processingFolders.get(folder_id);
    if (!folderData || folderData.busy) return;
    folderData.busy = true;

    const [[{ event_id }]] = await pool.execute('SELECT event_id FROM folders WHERE id = ?', [folder_id]);

    if (!modelsLoaded) {
        await loadModels();
        modelsLoaded = true;
    }

    try {
        while (folderData.queue.length > 0) {
            const { batchPhotos } = folderData.queue.shift();

            for (const photo of batchPhotos) {
                try {
                    const descriptor = await extractFaceDescriptor(photo.url);
                    if (descriptor && descriptor.length > 0) {
                        await pool.execute(
                            'UPDATE photos SET face_descriptor = ?, descriptor_ready = true WHERE folder_id = ? AND photo_url = ?',
                            [JSON.stringify(descriptor), folder_id, photo.url]
                        );
                    } else {
                        await pool.execute(
                            'UPDATE photos SET face_descriptor = NULL, descriptor_ready = false WHERE folder_id = ? AND photo_url = ?',
                            [folder_id, photo.url]
                        );
                    }
                } catch (err) {
                    console.error('Descriptor extraction failed for', photo.url, err);
                }
            }
            console.log(`Processed batch for folder ${folder_id}`);
        }

        // All batches processed; now update folder and event flags once
        await pool.execute('UPDATE folders SET isFaceDescriptorReady = true WHERE id = ?', [folder_id]);

        // This checks if all folders in the event are ready
        const [[{ not_ready }]] = await pool.execute(
            'SELECT COUNT(*) as not_ready FROM folders WHERE event_id = ? AND isFaceDescriptorReady = false',
            [event_id]
        );

        if (not_ready === 0) {
            await pool.execute('UPDATE events SET isFaceDescriptorReady = true WHERE id = ?', [event_id]);
        }

        folderData.busy = false;
        processingFolders.delete(folder_id);
    } catch (error) {
        folderData.busy = false;
        console.log("GOT INITIAL ERROR ", error);
    }
}

exports.checkEventReady = async (req, res) => {
    try {
        const { event_id } = req.params;

        const [[event]] = await pool.execute(
            'SELECT isFaceDescriptorReady FROM events WHERE id = ?',
            [event_id]
        );

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const isStillProcessing = eventProcessingMap.has(Number(event_id));
        res.json({ isFaceDescriptorReady: !!event.isFaceDescriptorReady && !isStillProcessing });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
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

async function triggerExternalExtraction(folder_id, event_id, uploadedUrls, upload_folder_id) {
    try {

        if (!eventProcessingMap.has(event_id)) {
            eventProcessingMap.set(event_id, new Set());
        }
        eventProcessingMap.get(event_id).add(folder_id);

        const [[row]] = await pool.execute('SELECT event_name FROM events WHERE id = ?', [event_id]);


        const formData = new FormData();
        formData.append('image_urls', JSON.stringify(uploadedUrls.map(u => u.url))); // array of URLs
        formData.append('wedding_name', row.event_name); // you can make this dynamic
        if (upload_folder_id) formData.append('wedding_folder_id', upload_folder_id);
        // https://81ca5f69-cc38-48e6-8359-5a575ac4d036-00-16uzz8s2qqhet.worf.replit.dev


        axios.post('http://157.173.221.163:8003/upload_urls', formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity, // handle large payloads
        })
            .then(async (response) => {
                const { wedding_folder_id } = response.data;

                // await pool.execute(
                //     'UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?',
                //     [true, folder_id]
                // );
                // await pool.execute(
                //     'UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?',
                //     [true, event_id]
                // );

                console.log("EENT PROCESS HERE", eventProcessingMap);



                await pool.execute('UPDATE folders SET isFaceDescriptorReady = ? WHERE id = ?', [true, folder_id]);

                eventProcessingMap.get(event_id).delete(folder_id);

                if (eventProcessingMap.get(event_id).size == 0) {
                    await pool.execute('UPDATE events SET isFaceDescriptorReady = ? WHERE id = ?', [true, event_id]);
                    eventProcessingMap.delete(event_id);  // Clean up map
                }

                console.log("✅ Extraction completed:", wedding_folder_id);
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
        console.log('Request Body:', req.body.wedding_folder_id); // This should contain wedding_folder_id
        console.log('Request File:', req.file);  // This should contain the file input_img

        const { wedding_folder_id } = req.body;  // Extract wedding_folder_id from req.body
        const input_img = req.file; //

        // Ensure input_img and wedding_folder_id are provided
        if (!input_img || !wedding_folder_id) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Create FormData for the external API call
        const formData = new FormData();
        formData.append('input_img', input_img.buffer, { filename: 'captured_image.jpeg' }); // input_img should be a buffer from the uploaded file
        formData.append('wedding_folder_id', wedding_folder_id);

        // Forward the request to the external API using axios

        //GPU url : https://9s2vp2mren4e22-8003.proxy.runpod.net/find_person

        //CPU URL HOSTED: http://157.173.221.163:8003/
        // https://81ca5f69-cc38-48e6-8359-5a575ac4d036-00-16uzz8s2qqhet.worf.replit.dev


        const response = await axios.post('http://157.173.221.163:8003/find_person', formData, {
            headers: {
                ...formData.getHeaders(), // Make sure to include proper headers for FormData
            },
        });

        // Handle success
        if (response.data) {
            console.log('✅ Face match response:', response.data);
            return res.json({
                success: true,
                message: 'Face matched successfully!',
                match_list: response.data.match_list || [],
            });
        }

    } catch (error) {
        console.error('❌ Error during face match process:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process face match',
            error: error.message,
        });
    }
}