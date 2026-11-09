// @ts-nocheck
const pool = require('../db_config/db.js');

const editableFields = ['listing_type','phone_number','city', 'title', 'price', 'duration', 'cover_image_url', 'description', 'image_urls', 'video_urls'];

function getErrorMessage(err) {
    return err instanceof Error ? err.message : String(err);
}

function isValidPrice(price) {
    return price === null || (Number.isFinite(Number(price)) && Number(price) >= 0);
}

function serializeMediaUrls(value, fieldName) {
    if (value == null) return JSON.stringify([]);
    if (!Array.isArray(value) || value.length > 30 || value.some(url => typeof url !== 'string')) {
        throw new Error(`${fieldName} must be an array of up to 30 URLs`);
    }
    const urls = value.map(url => url.trim()).filter(Boolean);
    if (urls.some(url => url.length > 2048)) {
        throw new Error(`${fieldName} URLs must not exceed 2048 characters`);
    }
    return JSON.stringify(urls);
}

function parseMediaUrls(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseListingMedia(rows) {
    return rows.map(row => ({
        ...row,
        image_urls: parseMediaUrls(row.image_urls),
        video_urls: parseMediaUrls(row.video_urls)
    }));
}

exports.getAllListing = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM marketplace_listings WHERE is_active = 1 AND deleted_at IS NULL ORDER BY created_at DESC'
        );
        return res.send({ message: 'Marketplace listings fetched successfully', data: parseListingMedia(rows), status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to fetch marketplace listings', message: getErrorMessage(err), status: 500 });
    }
};

exports.create = async (req, res) => {
    try {
        const { listing_type, phone_number = null, city = null, title, price = null, duration = null, cover_image_url = null, description } = req.body;
        if (typeof listing_type !== 'string' || !listing_type.trim() || typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
            return res.status(400).send({ error: 'listing_type, title, and description are required', status: 400 });
        }
        if (!isValidPrice(price)) {
            return res.status(400).send({ error: 'price must be a non-negative number or null', status: 400 });
        }

        let imageUrls;
        let videoUrls;
        try {
            imageUrls = serializeMediaUrls(req.body.image_urls, 'image_urls');
            videoUrls = serializeMediaUrls(req.body.video_urls, 'video_urls');
        } catch (validationError) {
            return res.status(400).send({ error: validationError.message, status: 400 });
        }

        const [result] = await pool.execute(
            `INSERT INTO marketplace_listings
                (user_id, listing_type, phone_number, city, title, price, duration, cover_image_url, description, image_urls, video_urls)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, listing_type.trim(), phone_number, city, title.trim(), price, duration, cover_image_url, description.trim(), imageUrls, videoUrls]
        );
        const [rows] = await pool.execute(
            'SELECT * FROM marketplace_listings WHERE id = ? AND user_id = ?',
            [result.insertId, req.user.id]
        );
        return res.status(201).send({ message: 'Marketplace listing created successfully', data: parseListingMedia(rows)[0], status: 201 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to create marketplace listing', message: getErrorMessage(err), status: 500 });
    }
};

exports.getAllListingCountByUserId = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const query = 'SELECT COUNT(*) AS count FROM marketplace_listings WHERE user_id = ? AND deleted_at IS NULL';
        const [rows] = await pool.execute(query, [userId]);
        return res.send({ message: 'User marketplace listings count fetched successfully', data: rows[0], status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to fetch user marketplace listings count', message: getErrorMessage(err), status: 500 });
    }
};

exports.getListingByUserId = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).send({ error: 'A valid userId is required', status: 400 });
        }
        if (userId !== Number(req.user.id)) {
            return res.status(403).send({ error: 'You can only view your own listings', status: 403 });
        }

        const [rows] = await pool.execute(
            'SELECT * FROM marketplace_listings WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
            [userId]
        );
        return res.send({ message: 'User marketplace listings fetched successfully', data: parseListingMedia(rows), status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to fetch user marketplace listings', message: getErrorMessage(err), status: 500 });
    }
};

exports.editListingByUserId = async (req, res) => {
    try {
        const listingId = Number(req.params.listingId);
        if (!Number.isSafeInteger(listingId) || listingId <= 0) {
            return res.status(400).send({ error: 'A valid listingId is required', status: 400 });
        }

        let updates = Object.entries(req.body).filter(([field]) => editableFields.includes(field));
        if (!updates.length) {
            return res.status(400).send({ error: 'At least one editable listing field is required', status: 400 });
        }
        const price = updates.find(([field]) => field === 'price');
        if (price && !isValidPrice(price[1])) {
            return res.status(400).send({ error: 'price must be a non-negative number or null', status: 400 });
        }

        try {
            updates = updates.map(([field, value]) => [
                field,
                field === 'image_urls' || field === 'video_urls' ? serializeMediaUrls(value, field) : value
            ]);
        } catch (validationError) {
            return res.status(400).send({ error: validationError.message, status: 400 });
        }

        const setClause = updates.map(([field]) => `\`${field}\` = ?`).join(', ');
        const [result] = await pool.execute(
            `UPDATE marketplace_listings SET ${setClause} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [...updates.map(([, value]) => value), listingId, req.user.id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ error: 'Marketplace listing not found', status: 404 });
        }

        const [rows] = await pool.execute(
            'SELECT * FROM marketplace_listings WHERE id = ? AND user_id = ?',
            [listingId, req.user.id]
        );
        return res.send({ message: 'Marketplace listing updated successfully', data: parseListingMedia(rows)[0], status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to update marketplace listing', message: getErrorMessage(err), status: 500 });
    }
};

exports.toggleListingByUserId = async (req, res) => {
    try {
        const listingId = Number(req.params.listingId);
        if (!Number.isSafeInteger(listingId) || listingId <= 0) {
            return res.status(400).send({ error: 'A valid listingId is required', status: 400 });
        }

        const [result] = await pool.execute(
            'UPDATE marketplace_listings SET is_active = IF(is_active = 1, 0, 1) WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [listingId, req.user.id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ error: 'Marketplace listing not found', status: 404 });
        }

        const [rows] = await pool.execute(
            'SELECT is_active FROM marketplace_listings WHERE id = ? AND user_id = ?',
            [listingId, req.user.id]
        );
        return res.send({ message: 'Marketplace listing status updated successfully', data: rows[0], status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to toggle marketplace listing', message: getErrorMessage(err), status: 500 });
    }
};

exports.deleteListingById = async (req, res) => {
    try {
        const listingId = Number(req.params.listingId);
        if (!Number.isSafeInteger(listingId) || listingId <= 0) {
            return res.status(400).send({ error: 'A valid listingId is required', status: 400 });
        }

        const [result] = await pool.execute(
            'DELETE FROM marketplace_listings WHERE id = ? AND user_id = ?',
            [listingId, req.user.id]
        );
        if (!result.affectedRows) {
            return res.status(404).send({ error: 'Marketplace listing not found', status: 404 });
        }
        return res.send({ message: 'Marketplace listing deleted successfully', status: 200 });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: 'Failed to delete marketplace listing', message: getErrorMessage(err), status: 500 });
    }
};