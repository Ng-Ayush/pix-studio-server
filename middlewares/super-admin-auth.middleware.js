const authMiddleware = require('./auth.middleware');

module.exports = (req, res, next) => {
    authMiddleware(req, res, () => {
        const role = String(req.user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
            return res.status(403).send({
                status: 403,
                error: 'Super Admin access required.',
                message: 'Super Admin access required.',
            });
        }

        return next();
    });
};
