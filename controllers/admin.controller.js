const pool = require('../db_config/db.js');
const jwt = require('jsonwebtoken');

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
        const query = `SELECT * FROM users ORDER BY id DESC`
        const [customers] = await pool.execute(query);
        res.send({ message: "users fetched successfully", data: customers, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch users' });
    }
};

exports.createUsers = async (req, res) => {
    try {
        let { studio_name, email, phone_number, role, youtube_url, instagram_url, facebook_url, address, studio_icon } = req.body;
        const [existingUser] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]);
        if (existingUser.length > 0) {
            return res.send({ message: "Email already exists", status: 409 });
        }
        pin = Math.floor(100000 + Math.random() * 900000);

        const [result] = await pool.execute(
            'INSERT INTO users (studio_name, email, phone_number, role, youtube_url , instagram_url, facebook_url, pin,address,studio_icon) VALUES (?, ?, ? ,?, ?, ?, ?, ?, ?, ?)',
            [studio_name, email, phone_number, role, youtube_url, instagram_url, facebook_url, pin, address, studio_icon]
        );

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
        let { studio_name, email, phone_number, youtube_url, instagram_url, facebook_url, address, studio_icon, role, id } = req.body;

        await pool.execute(
            'UPDATE users SET studio_name = ?, email = ?,phone_number = ?, youtube_url = ?, instagram_url = ? , facebook_url =?,address = ? , studio_icon = ?, role = ?  WHERE id = ?',
            [studio_name, email, phone_number, youtube_url, instagram_url, facebook_url, address, studio_icon, role, id]
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
    const {images} = req.body;
    console.log(images);
    
    try {
        const query = 'INSERT INTO dynamic_images (image_url) VALUES ?';

        // Convert array of strings into array of arrays for bulk insert
        const values = images.map((url) => url ? [url] : '');

        const [result] = await pool.query(query, [values]);
        console.log(`Inserted ${result.affectedRows} images successfully.`);
        res.send({ message: 'Images inserted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to insert Image', err: err });
    }
};

exports.createPromocode = async (req, res) => {
    try {
        const { code, discount_type, discount_value, valid_from=null, valid_to=null } = req.body;
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
        const { status,promocode_id } = req.body;
        await pool.execute('UPDATE promocodes SET is_active = ? WHERE id = ?', [status, promocode_id]);
        res.send({ message: 'Promocode status updated successfully', status: 200 });
    } catch (err) {
        res.send({ error: 'Failed to update promocode status',message: err.message , status: 500 });
    }
};