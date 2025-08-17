const pool = require('../db_config/db.js');
const Razorpay = require('razorpay');
const dotenv = require("dotenv");
dotenv.config();
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const crypto = require('crypto');

exports.getAllFeatures = async (req, res) => {
    try {
        const query = `SELECT fea.*,fea.category AS category_id, cat.category_name,cat.category_icon FROM manage_features fea LEFT JOIN categories cat ON fea.category = cat.category_id ORDER BY id DESC`;
        const [features] = await pool.execute(query);
        res.send({ message: "features fetched successfully", data: features, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch features' });
    }
};

exports.createFeatures = async (req, res) => {
    try {
        let { category, drive_url, price, title, youtube_url,description ,is_new_arrival=false,youtube_thumbnail } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO manage_features (category, drive_url, price, title, youtube_url,description,is_new_arrival,youtube_thumbnail) VALUES (?, ?, ? ,?, ?, ?, ?, ?)',
            [category, drive_url, price, title, youtube_url,description, is_new_arrival,youtube_thumbnail]
        );

        res.status(201).send({ message: "Feature created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.send({ error: 'Internal server error', message: "Internal server error", status: 500 });
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
        res.status(500).send({ error: 'Failed to get feature', err: err });
    }
};

exports.updateFeature = async (req, res) => {
    try {
        let { category, drive_url, price, title, youtube_url,description, is_new_arrival,youtube_thumbnail } = req.body;
        const id = req.body.id;

        await pool.execute(
            'UPDATE manage_features SET category = ?, drive_url = ?, price = ?, title = ?, youtube_url = ?,description = ?, is_new_arrival = ?, youtube_thumbnail = ?  WHERE id = ?',
            [category, drive_url, price, title, youtube_url,description ,is_new_arrival,youtube_thumbnail, id]
        );

        res.send({ message: 'Feature updated successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update Feature', err: err });
    }
};

exports.deleteFeatures = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM manage_features WHERE id = ?', [id]);
        res.send({ message: 'Feature deleted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete Feature', erro: err });
    }
};
exports.onImgUpload = async (req, res) => {
    try {
        let { files } = req.body;
        res.send({ message: "file uploaded Successfully", status: 200, data: files });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message, status: 500 });
    }
};


exports.createOrder = async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;

        const options = {
            amount: amount * 100, // in paise
            currency: currency || 'INR',
            receipt: receipt || `receipt_${Date.now()}`,
        };

        console.log(options);

        const order = await razorpay.orders.create(options);
        res.send({ message: 'Order created successfully', status: 200, data: order });
    } catch (err) {
        console.error(err);
        res.send({ error: 'Internal server error', message: err.message, status: 500 });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        console.log("expecee", expectedSignature)
        console.log("razorpay_signature", razorpay_signature);


        if (expectedSignature === razorpay_signature) {

            res.send({ status: 200, message: 'Payment verified successfully' });
        } else {
            res.send({ status: 400, message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.send({ status: 500, message: 'Internal server error', error: 'Failed to verify payment' });
    }

}

exports.createCategory = async (req, res) => {
    try {
        let { category_name, category_icon } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO categories (category_name, category_icon) VALUES (?, ?)',
            [category_name, category_icon]
        );

        res.status(201).send({ message: "Category created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message });
    }
};
exports.getAllCategories = async (req, res) => {
    try {
        const query = `SELECT * FROM categories`;
        const [features] = await pool.execute(query);
        res.send({ message: "categories fetched successfully", data: features, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch features' });
    }
};


exports.getFeaturesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const query = `SELECT * FROM manage_features WHERE category = ?`;
        const [features] = await pool.execute(query, [category]);
        res.send({ message: "features fetched successfully", data: features, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch features' });
    }
};

exports.getFeaturesByNewArrival = async (req, res) => {
    try {
        const query = `SELECT * FROM manage_features WHERE is_new_arrival = 1`;
        const [features] = await pool.execute(query);
        res.send({ message: "features fetched successfully", data: features, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch features' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        let { category_name, category_icon } = req.body;
        const {id} = req.params;
        await pool.execute(
            'UPDATE categories SET category_name = ?, category_icon = ? WHERE category_id = ?',
            [category_name, category_icon, id]
        );
        res.send({ message: "Category updated successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error', message: err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM categories WHERE category_id = ?', [id]);
        res.send({ message: 'Category deleted successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete Category', erro: err });
    }
};