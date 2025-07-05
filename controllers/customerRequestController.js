const pool = require('../db_config/db.js');

exports.getAllRequests = async (req, res) => {
    try {
        const query = `SELECT * FROM customer_request ORDER BY ticket_id DESC`
        const [customers] = await pool.execute(query);
        res.send({ message: "users fetched successfully", data: customers, status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch users' });
    }
};

exports.resolved = async (req, res) => {
    try {
        const ticket_id = req.params.id;
        console.log(ticket_id);

        await pool.execute('UPDATE customer_request SET status = 1 WHERE ticket_id = ?', [ticket_id]);
        
        res.send({ message: 'Marked as resolved successfully', status: 200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to resolve', err: err });
    }
};

exports.getRequestById = async (req, res) => {
    try {
        const ticket_id = req.params.id;
        const [users] = await pool.execute('SELECT * FROM customer_request WHERE ticket_id = ?', [ticket_id]);

        if (!users.length) {
            return res.status(404).send({ message: 'request not found' });
        }

        res.send(users[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get request', err:err });
    }
};

exports.updateRequest = async (req, res) => {
    try {
        let { customer_name, priority} = req.body;
        const ticket_id = req.body.id;

        await pool.execute(
            'UPDATE customer_request SET customer_name = ?, priority = ?  WHERE ticket_id = ?',
            [customer_name, priority, ticket_id]
        );

        res.send({ message: 'Request updated successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update Request', err:err });
    }
};
