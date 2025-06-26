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