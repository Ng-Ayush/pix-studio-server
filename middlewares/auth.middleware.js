const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');

module.exports = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [user] = await pool.execute('SELECT * FROM users WHERE id = ?', [decoded._id]);
        if (!user[0]) throw new Error();
        req.user = user[0];
        next();
    } catch (err) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};
