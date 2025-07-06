const pool = require('../db_config/db.js');


exports.getUsersByCurrentId = async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);

        if (!users.length) {
            return res.status(404).send({ message: 'users not found' });
        }

        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get users' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        let { name, email, phone_number, address, terms_and_condition,studio_icon} = req.body;
        const id = req.body.id;
        await pool.execute(
            'UPDATE users SET name = ?, email = ?,phone_number = ?, address = ?, terms_and_condition = ?, studio_icon = ?  WHERE id = ?',
            [name, email, phone_number, address, terms_and_condition,studio_icon, id]
        );

        res.send({ message: 'Profile updated successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update profile', err:err });
    }
};