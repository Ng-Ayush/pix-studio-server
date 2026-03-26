const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');

module.exports = async (req, res, next) => {
    try {
        // 1. Get token safely
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'Authorization token missing.' });
        }

        const token = authHeader.replace('Bearer ', '');

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Fetch user
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE id = ?',
            [decoded._id]
        );

        const user = rows[0];
        if (!user) {
            return res.status(401).send({ error: 'User not found.' });
        }
        console.log("user.status",user.status);
        
         if (!user.status) {
            return res.status(403).send({
                error: 'Account has been suspended. Please contact admin.'
            });
        }

        // 4. Check access expiry
        if (user.access_expires_on) {
            const now = new Date();
            const expiryDate = new Date(user.access_expires_on);

            if (now > expiryDate) {
                return res.status(403).send({
                    error: 'Your access has expired. Please renew your subscription.'
                });
            }
        }

        // 5. Attach user and continue
        req.user = user;
        next();

    } catch (err) {
        return res.status(401).send({ error: 'Please authenticate.' });
    }
};