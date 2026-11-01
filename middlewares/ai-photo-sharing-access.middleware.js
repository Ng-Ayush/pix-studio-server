const pool = require('../db_config/db.js');

const isAiUpload = value => value === true || value === 1 || value === '1' || value === 'true';

module.exports = async (req, res, next) => {
    try {
        let requiresAiAccess = isAiUpload(req.body?.is_ai_upload);
        const eventId = req.body?.event_id || req.params?.event_id;
        if (eventId) {
            const [events] = await pool.execute(
                'SELECT is_ai_upload FROM events WHERE id = ? AND created_by = ?',
                [eventId, req.user.id]
            );
            requiresAiAccess = requiresAiAccess || isAiUpload(events[0]?.is_ai_upload);
        }

        if (!requiresAiAccess) {
            return next();
        }

        const [rows] = await pool.execute(
            `SELECT 1
             FROM module_payments
             WHERE user_id = ?
               AND module_code IN ('all_features', 'ai_photo_sharing')
               AND payment_status = 'paid'
               AND module_expires_on >= CURDATE()
             LIMIT 1`,
            [req.user.id]
        );

        if (!rows.length) {
            return res.status(403).send({
                status: 403,
                error: 'AI Photo Sharing access is not active.',
                message: 'Purchase an AI Photo Sharing package to use AI uploads.',
            });
        }

        return next();
    } catch (error) {
        console.error('Failed to validate AI Photo Sharing access:', error);
        return res.status(500).send({
            status: 500,
            error: 'Unable to validate module access.',
            message: 'Unable to validate module access.',
        });
    }
};
