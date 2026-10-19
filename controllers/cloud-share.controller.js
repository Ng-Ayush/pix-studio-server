const crypto = require('crypto');
const pool = require('../db_config/db.js');

const MAX_SHARE_BYTES = 50 * 1024 ** 4;
const MAX_SHARES_PER_USER = 7;

function validShareId(value) {
    return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function handleError(res, message, error) {
    console.error(`[CloudShare] ${message}`, error);
    return res.status(500).send({ error: message, status: 500 });
}

exports.getUserShares = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT share_id AS shareId, info_hash AS infoHash, file_name AS name,
                    size_bytes AS sizeBytes, download_count AS downloadCount,
                    status, created_at AS createdAt
             FROM cloud_shares
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.send({ data: rows, status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to fetch CloudShare history', error);
    }
};

exports.createShare = async (req, res) => {
    const { name, sizeBytes } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const size = Number(sizeBytes);

    if (!normalizedName || normalizedName.length > 255) {
        return res.status(400).send({ error: 'A file or folder name of at most 255 characters is required', status: 400 });
    }
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SHARE_BYTES) {
        return res.status(400).send({ error: 'CloudShare supports shares up to 50 TB', status: 400 });
    }

    try {
        const [countRows] = await pool.execute(
            "SELECT COUNT(*) AS shareCount FROM cloud_shares WHERE user_id = ? AND status <> 'failed'",
            [req.user.id]
        );
        if (Number(countRows[0].shareCount) >= MAX_SHARES_PER_USER) {
            return res.status(400).send({
                error: `You can have up to ${MAX_SHARES_PER_USER} CloudShare links. Delete an old share to create another.`,
                status: 400
            });
        }

        const shareId = crypto.randomBytes(32).toString('hex');
        await pool.execute(
            `INSERT INTO cloud_shares (share_id, user_id, file_name, size_bytes, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [shareId, req.user.id, normalizedName, size]
        );

        const [rows] = await pool.execute(
            `SELECT share_id AS shareId, info_hash AS infoHash, file_name AS name,
                    size_bytes AS sizeBytes, download_count AS downloadCount,
                    status, created_at AS createdAt
             FROM cloud_shares
             WHERE share_id = ? AND user_id = ?`,
            [shareId, req.user.id]
        );
        return res.status(201).send({ data: rows[0], status: 201 });
    } catch (error) {
        return handleError(res, 'Failed to save CloudShare link', error);
    }
};

exports.completeShare = async (req, res) => {
    const { shareId } = req.params;
    const infoHash = typeof req.body.infoHash === 'string' ? req.body.infoHash.toLowerCase() : '';
    if (!validShareId(shareId) || !/^[a-f0-9]{40}$/.test(infoHash)) {
        return res.status(400).send({ error: 'A valid CloudShare link and info hash are required', status: 400 });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE cloud_shares
             SET info_hash = ?, status = 'ready'
             WHERE share_id = ? AND user_id = ? AND status = 'pending'`,
            [infoHash, shareId, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Pending CloudShare link not found', status: 404 });
        }

        const [rows] = await pool.execute(
            `SELECT share_id AS shareId, info_hash AS infoHash, file_name AS name,
                    size_bytes AS sizeBytes, download_count AS downloadCount,
                    status, created_at AS createdAt
             FROM cloud_shares WHERE share_id = ? AND user_id = ?`,
            [shareId, req.user.id]
        );
        return res.send({ data: rows[0], status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to activate CloudShare link', error);
    }
};

exports.failShare = async (req, res) => {
    const { shareId } = req.params;
    if (!validShareId(shareId)) {
        return res.status(400).send({ error: 'A valid CloudShare link is required', status: 400 });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE cloud_shares SET status = 'failed'
             WHERE share_id = ? AND user_id = ? AND status = 'pending'`,
            [shareId, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'Pending CloudShare link not found', status: 404 });
        }
        return res.send({ success: true, status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to mark CloudShare link as failed', error);
    }
};

exports.deleteShare = async (req, res) => {
    const { shareId } = req.params;
    if (!validShareId(shareId)) {
        return res.status(400).send({ error: 'A valid CloudShare link is required', status: 400 });
    }

    try {
        const [result] = await pool.execute(
            'DELETE FROM cloud_shares WHERE share_id = ? AND user_id = ?',
            [shareId, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'CloudShare link not found', status: 404 });
        }
        return res.send({ success: true, status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to delete CloudShare link', error);
    }
};

exports.getPublicShare = async (req, res) => {
    const { shareId } = req.params;
    if (!validShareId(shareId)) {
        return res.status(404).send({ error: 'CloudShare link not found', status: 404 });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT share_id AS shareId, info_hash AS infoHash, file_name AS name,
                    size_bytes AS sizeBytes, download_count AS downloadCount,
                    status, created_at AS createdAt
             FROM cloud_shares
             WHERE share_id = ?`,
            [shareId]
        );
        if (rows.length === 0) {
            return res.status(404).send({ error: 'CloudShare link not found or has expired', status: 404 });
        }
        if (rows[0].status === 'failed') {
            return res.status(410).send({ error: 'The sender could not prepare this CloudShare link', status: 410 });
        }
        return res.send({ data: rows[0], status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to fetch CloudShare link', error);
    }
};

exports.markShareStarted = async (req, res) => {
    const { shareId } = req.params;
    if (!validShareId(shareId)) {
        return res.status(404).send({ error: 'CloudShare link not found', status: 404 });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE cloud_shares SET status = 'in_progress'
             WHERE share_id = ? AND status IN ('ready', 'in_progress')`,
            [shareId]
        );
        if (result.affectedRows === 0) {
            const [rows] = await pool.execute(
                'SELECT status FROM cloud_shares WHERE share_id = ?',
                [shareId]
            );
            if (rows.length === 0 || rows[0].status !== 'in_progress') {
                return res.status(404).send({ error: 'Ready CloudShare link not found', status: 404 });
            }
        }
        return res.send({ success: true, status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to mark CloudShare as in progress', error);
    }
};

exports.recordDownload = async (req, res) => {
    const { shareId } = req.params;
    if (!validShareId(shareId)) {
        return res.status(404).send({ error: 'CloudShare link not found', status: 404 });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE cloud_shares SET download_count = download_count + 1 WHERE share_id = ? AND status IN ('ready', 'in_progress')",
            [shareId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).send({ error: 'CloudShare link not found', status: 404 });
        }
        return res.send({ success: true, status: 200 });
    } catch (error) {
        return handleError(res, 'Failed to record CloudShare download', error);
    }
};
