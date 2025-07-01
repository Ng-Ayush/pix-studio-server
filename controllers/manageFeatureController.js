const pool = require('../db_config/db.js');

exports.getAllFeatures = async (req, res) => {
    try {
        const query = `SELECT * FROM manage_features ORDER BY id DESC`;
        const [features] = await pool.execute(query);
        res.send({ message: "features fetched successfully", data: features, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch features' });
    }
};

exports.createFeatures = async (req, res) => {
    try {
        let { category, category_icon, drive_url, price, title, youtube_url ,name } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO manage_features (category, category_icon, drive_url, price, title, youtube_url, name) VALUES (?, ?, ? ,?, ?, ?, ?)',
            [category, category_icon, drive_url, price, title, youtube_url, name]
        );

        res.status(201).send({ message: "Feature created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message, status: 500 });
    }
};

exports.getFeatureById = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute('SELECT * FROM manage_features WHERE id = ?', [id]);

        if (!users.length) {
            return res.status(404).send({ message: 'feature not found' });
        }
        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get feature' });
    }
};

exports.updateFeature = async (req, res) => {
    try {
        let { category, category_icon, drive_url, price, title, youtube_url, name} = req.body;
        const id = req.body.id;

        await pool.execute(
            'UPDATE manage_features SET category = ?, category_icon = ?,drive_url = ?, price = ?, title = ?, youtube_url = ? , name =?  WHERE id = ?',
            [category, category_icon, drive_url, price, title, youtube_url, name, id]
        );

        res.send({ message: 'Feature updated successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update Feature', err:err });
    }
};

exports.deleteFeatures = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM manage_features WHERE id = ?', [id]);
        res.send({ message: 'Feature deleted successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete Feature' , erro:err});
    }
};