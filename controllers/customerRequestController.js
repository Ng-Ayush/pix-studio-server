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
