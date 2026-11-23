const pool = require('../db_config/db.js');
const jwt = require('jsonwebtoken');
const { globalInvoiceItems } = require('../utils/helper.js');


exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (!users[0]) throw new Error('Invalid login credentials');

        const isMatch = await password == users[0].password;
        if (!isMatch) throw new Error('Invalid login credentials');

        const token = jwt.sign({ _id: users[0].id }, process.env.JWT_SECRET);
        res.send({ user: { id: users[0].id, email: users[0].email, studio_name: users[0].studio_name, role: users[0].role }, token });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
};


exports.getAllUsers = async (req, res) => {
    try {
        const { status } = req.query; // true / false

        let query = `SELECT * FROM users`;
        const conditions = [];
        const params = [];

        if (req.header('brand') === 'ph') {
            conditions.push('brand = ?');
            params.push('ph');
        }

        if (status !== undefined) {
            conditions.push('status = ?');
            params.push(status === 'true' ? 1 : 0);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY id DESC`;

        const [customers] = await pool.execute(query, params);

        res.send({
            message: "users fetched successfully",
            data: customers,
            status: 200
        });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch users' });
    }
};

exports.createUsers = async (req, res) => {
    try {
        let { studio_name, email, phone_number, role, youtube_url, instagram_url, facebook_url, address, studio_icon, access_expires_on = null,allowed_photos_quantity=0 } = req.body;
        const [existingUser] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]);
        if (existingUser.length > 0) {
            return res.send({ message: "Email already exists", status: 409 });
        }
        pin = Math.floor(100000 + Math.random() * 900000);

        const [result] = await pool.execute(
            'INSERT INTO users (studio_name, email, phone_number, role, youtube_url , instagram_url, facebook_url, pin,address,studio_icon,access_expires_on,allowed_photos_quantity) VALUES (?, ? , ?, ? ,?, ?, ?, ?, ?, ?, ?, ?)',
            [studio_name, email, phone_number, role, youtube_url, instagram_url, facebook_url, pin, address, studio_icon, access_expires_on,allowed_photos_quantity]
        );

        await insertGlobalInvoiceItems(result.insertId);  //add global invoice Items

        res.send({ message: "Admin created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message, status: 500 });
    }
};

exports.getUsersById = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);

        if (!users.length) {
            return res.status(404).send({ message: 'users not found' });
        }

        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get users' });
    }
};

exports.updateUsers = async (req, res) => {
    try {
        let { studio_name, email, phone_number, youtube_url, instagram_url, facebook_url, address, studio_icon, role, access_expires_on = null,allowed_photos_quantity = 0 , id } = req.body;

        await pool.execute(
            'UPDATE users SET studio_name = ?, email = ?,phone_number = ?, youtube_url = ?, instagram_url = ? , facebook_url =?,address = ? , studio_icon = ?, role = ?, access_expires_on = ?, allowed_photos_quantity = ?   WHERE id = ?',
            [studio_name, email, phone_number, youtube_url, instagram_url, facebook_url, address, studio_icon, role, access_expires_on,allowed_photos_quantity, id]
        );

        res.send({ message: 'User updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update User', err: err });
    }
};

exports.deleteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.send({ message: 'users deleted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete users' });
    }
};

exports.toggleAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
        res.send({ message: 'Admin status updated successfully', status: 200 });

    } catch (error) {
        res.status(500).send({ error: 'Failed to update admin status' });
    }

}
exports.getDynamicImageUrl = async (req, res) => {
    try {
        const [images] = await pool.execute(`SELECT image_url FROM dynamic_images ORDER BY created_at DESC LIMIT 3`);
        if (!images.length) {
            return res.status(404).send({ message: 'Images not found' });
        }
        res.send({ status: 200, data: images.map(image => image.image_url), message: 'Images fetched successfully' });
    } catch (err) {
        res.status(500).send({ error: 'Failed to get Images' });
    }
}

exports.insertImages = async (req, res) => {
    const { images } = req.body;

    try {
        const query = 'INSERT INTO dynamic_images (image_url) VALUES ?';

        // Convert array of strings into array of arrays for bulk insert
        const values = images.map((url) => url ? [url] : '');

        const [result] = await pool.query(query, [values]);
        res.send({ message: 'Images inserted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to insert Image', err: err });
    }
};

exports.createPromocode = async (req, res) => {
    try {
        const { code, discount_type, discount_value, valid_from = null, valid_to = null } = req.body;
        const [existingPromocode] = await pool.execute(
            'SELECT * FROM promocodes WHERE code = ?',
            [code]);
        if (existingPromocode.length > 0) {
            return res.send({ message: "Promocode already exists", status: 409 });
        }
        const [result] = await pool.execute(
            'INSERT INTO promocodes (code, discount_type,discount_value,valid_from,valid_to) VALUES (?, ?, ? , ? ,? )',
            [code, discount_type, discount_value, valid_from, valid_to]
        );
        res.send({ message: "Promocode created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message, status: 500 });
    }
};

exports.getAllPromocodes = async (req, res) => {
    try {
        const query = `SELECT * FROM promocodes ORDER BY id DESC`
        const [promocodes] = await pool.execute(query);
        res.send({ message: "promocodes fetched successfully", data: promocodes, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch promocodes' });
    }
};

exports.deletePromocode = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM promocodes WHERE id = ?', [id]);
        res.send({ message: 'Promocode deleted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete promocode' });
    }
};

exports.getHelpVideos = async (req, res) => {
    try {
        const [videos] = await pool.execute(
            'SELECT id, title, video_url, created_at FROM help_videos ORDER BY id DESC'
        );
        return res.send({ message: 'Help videos fetched successfully', data: videos, status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to fetch help videos', message: err.message, status: 500 });
    }
};

exports.createHelpVideo = async (req, res) => {
    try {
        const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
        const videoUrl = typeof req.body.video_url === 'string' ? req.body.video_url.trim() : '';
        if (!title || title.length > 255 || !videoUrl || videoUrl.length > 2048) {
            return res.status(400).send({ error: 'A title and valid video URL are required', status: 400 });
        }

        let parsedVideoUrl;
        try {
            parsedVideoUrl = new URL(videoUrl);
        } catch {
            return res.status(400).send({ error: 'A valid video URL is required', status: 400 });
        }
        if (!['http:', 'https:'].includes(parsedVideoUrl.protocol)) {
            return res.status(400).send({ error: 'Video URL must use HTTP or HTTPS', status: 400 });
        }

        const [result] = await pool.execute(
            'INSERT INTO help_videos (title, video_url) VALUES (?, ?)',
            [title, videoUrl]
        );
        return res.status(201).send({
            message: 'Help video added successfully',
            data: { id: result.insertId, title, video_url: videoUrl },
            status: 201
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to add help video', message: err.message, status: 500 });
    }
};

exports.deleteHelpVideo = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).send({ error: 'A valid help video ID is required', status: 400 });
        }

        const [result] = await pool.execute('DELETE FROM help_videos WHERE id = ?', [id]);
        if (!result.affectedRows) {
            return res.status(404).send({ error: 'Help video not found', status: 404 });
        }
        return res.send({ message: 'Help video deleted successfully', status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to delete help video', message: err.message, status: 500 });
    }
};

// **** in future use ****
exports.updatePromocode = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discount } = req.body;
        await pool.execute('UPDATE promocodes SET code = ?, discount = ? WHERE id = ?', [code, discount, id]);
        res.send({ message: 'Promocode updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update promocode' });
    }
};

exports.togglePromocodeStatus = async (req, res) => {
    try {
        const { status, promocode_id } = req.body;
        await pool.execute('UPDATE promocodes SET is_active = ? WHERE id = ?', [status, promocode_id]);
        res.send({ message: 'Promocode status updated successfully', status: 200 });
    } catch (err) {
        res.send({ error: 'Failed to update promocode status', message: err.message, status: 500 });
    }
};

exports.toggleGlobalInsta = async (req, res) => {
    try {
        const { value } = req.body;
        await pool.execute('UPDATE app_settings SET value = ? WHERE config_key = ?', [value, 'follow_admin_insta']);
        res.send({ message: 'Global Instagram status updated successfully', status: 200 });
    } catch (err) {
        res.send({ error: 'Failed to update Instagram status', message: err.message, status: 500 });
    }
};

async function insertGlobalInvoiceItems(userId) {
    return new Promise(async (resolve, reject) => {

        const items = globalInvoiceItems();

        const values = items.map(item => [
            item.item_name,
            null, // invoice_id
            item.description || '',
            item.sale_price,
            1,    // quantity
            '',   // location
            '',   // booking_date
            '',   // status, should be '' or a default value
            userId
        ]);
        try {
            const query = `
                INSERT INTO invoice_items 
                    (item_name, invoice_id, description, sale_price, quantity, location, booking_date, status, created_by)
                VALUES ?`;

            // Use pool.query for bulk inserts with VALUES ?
            const [result] = await pool.query(query, [values]);
            resolve({ message: "Global invoice items added successfully", status: 200 });
        } catch (err) {
            reject({ error: err });
            console.log("Error ", err);
        }
    });
}

exports.insertGlobalInvoiceItems = insertGlobalInvoiceItems;
