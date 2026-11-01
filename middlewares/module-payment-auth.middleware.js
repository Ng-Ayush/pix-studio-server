const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({
                status: 401,
                error: 'Authorization token missing.',
                message: 'Authorization token missing.',
            });
        }

        const token = authHeader.slice('Bearer '.length);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [decoded._id]
        );
        const user = rows[0];

        if (!user || !user.status) {
            return res.status(401).send({
                status: 401,
                error: 'User not found or account is suspended.',
                message: 'User not found or account is suspended.',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).send({
            status: 401,
            error: 'Please authenticate.',
            message: 'Please authenticate.',
        });
    }
};
