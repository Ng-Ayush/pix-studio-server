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
        let {  studio_name, email, phone_number, role, youtube_url , instagram_url, facebook_url,address,studio_icon } = req.body;
        const [existingUser] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]);
        if (existingUser.length > 0) {
            return res.send({ message: "Email already exists", status: 409 });
        }
        pin = Math.floor(100000 + Math.random() * 900000);

        const [result] = await pool.execute(
            'INSERT INTO users (studio_name, email, phone_number, role, youtube_url , instagram_url, facebook_url, pin,address,studio_icon) VALUES (?, ?, ? ,?, ?, ?, ?, ?, ?, ?)',
            [studio_name, email, phone_number, role, youtube_url , instagram_url, facebook_url, pin,address,studio_icon]
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
        let { studio_name, email, phone_number, youtube_url , instagram_url, facebook_url,address,studio_icon,role,id} = req.body;

        await pool.execute(
            'UPDATE users SET studio_name = ?, email = ?,phone_number = ?, youtube_url = ?, instagram_url = ? , facebook_url =?,address = ? , studio_icon = ?, role = ?  WHERE id = ?',
            [studio_name, email, phone_number, youtube_url , instagram_url, facebook_url,address,studio_icon,role, id]
        );

        res.send({ message: 'User updated successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update User', err:err });
    }
};

exports.deleteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.send({ message: 'users deleted successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete users' });
    }
};

exports.toggleAdminStatus = async (req,res)=>{
    try {
            const {id} = req.params;
            const{status} =  req.body;
            await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
            res.send({ message: 'Admin status updated successfully', status:200 });

    } catch (error) {
        res.status(500).send({ error: 'Failed to update admin status' });
    }
}