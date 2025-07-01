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
        res.send({ user: { id: users[0].id, email: users[0].email, name: users[0].name, role: users[0].role }, token });
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
        let { name, email, phone_number, role, password, pin } = req.body;
        const [existingUser] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]);
        if (existingUser.length > 0) {
            return res.send({ message: "Email already exists", status: 409 });
        }
        pin = Math.floor(100000 + Math.random() * 900000);

        const [result] = await pool.execute(
            'INSERT INTO users (name, email , phone_number, role ,password , pin) VALUES (?, ?, ? ,?, ?, ?)',
            [name, email, phone_number, role, password, pin]
        );

        res.status(201).send({ message: "User created successfully", status: 200 });
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
        let { name, email, phone_number, role, password, pin} = req.body;
        const id = req.body.id;
        pin = Math.floor(100000 + Math.random() * 900000);

        await pool.execute(
            'UPDATE users SET name = ?, email = ?,phone_number = ?, role = ?, password = ?, pin = ?  WHERE id = ?',
            [name, email, phone_number, role, password, pin, id]
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