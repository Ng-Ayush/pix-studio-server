const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');

exports.register = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 8);
        const [result] = await pool.execute(
            'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
            [email, hashedPassword, name]
        );
        res.status(201).send({ id: result.insertId, email, name });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (!users[0]) throw new Error('Invalid login credentials');

        const isMatch = await bcrypt.compare(password, users[0].password);
        if (!isMatch) throw new Error('Invalid login credentials');

        const token = jwt.sign({ _id: users[0].id }, process.env.JWT_SECRET);
        res.send({ user: { id: users[0].id, email: users[0].email, name: users[0].name }, token });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
};

exports.verifyOTPForPinUser = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!pin || isNaN(pin)) {
            return res.status(400).send({ error: 'Invalid pin' });
        }

        const user = await verifyPin(pin);
        if (user) {
                res.send({ phone_number: user.phone_number, name: user.name, user:user, status: 200, message: 'Pin verification successful' });
        } else {
            res.send({ error: 'Invalid pin', status: 400, message: 'Invalid pin' });
        }
    } catch (error) {
        console.error('Error verifying pin:', error);
        res.status(500).send({ error: 'Failed to verify pin' });
    }
};