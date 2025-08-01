const pool = require('../db_config/db.js'); // your MySQL connection

exports.createEstimate = async (req, res) => {
    try {
        const { invoice_id, terms_and_conditions } = req.body;
        if (!invoice_id || !terms_and_conditions) {
            return res.status(400).json({ error: 'invoice_id and terms_and_conditions required' });
        }

        const [check] = await pool.execute(`SELECT id FROM estimates WHERE invoice_id = ?`, [invoice_id]);
        if (check.length > 0) {
            return res.status(400).json({ error: 'Estimate already exists for this invoice' });
        }

        await pool.execute(
            `INSERT INTO estimates (invoice_id, terms_and_conditions) VALUES (?, ?)`,
            [invoice_id, terms_and_conditions]
        );

        res.send({ message: 'Estimate created successfully',status:200 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateEstimate = async (req, res) => {
    try {
        const { id } = req.params;
        const { terms_and_conditions } = req.body;
        if (!terms_and_conditions) {
            return res.send({ error: 'terms_and_conditions required',message: 'Terms and Condition required', status: 400 });
        }
        await pool.execute(
            `UPDATE estimates SET terms_and_conditions = ? WHERE id = ?`,
            [terms_and_conditions, id]
        );
        res.send({ message: 'Estimate updated successfully',status:200});
    } catch (err) {
        console.error(err);
        res.send({ error: 'Internal server error',message: err.message, status: 500 });
    }
}

exports.getEstimateByInvoiceId = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const [rows] = await pool.execute(`
      SELECT inv.*, est.terms_and_conditions, est.status 
      FROM invoices inv
      JOIN estimates est ON inv.id = est.invoice_id
      WHERE inv.id = ?
    `, [invoice_id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        res.send({message:'Estimate found', data:rows[0], status:200});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.convertToSales = async (req, res) => {
    try {
        const { invoice_id } = req.params;

        const [check] = await pool.execute(`SELECT id FROM estimates WHERE invoice_id = ?`, [invoice_id]);
        if (check.length === 0) {
            return res.status(404).json({ error: 'Estimate not found' });
        }

        await pool.execute(
            `UPDATE estimates SET status = 'converted' WHERE invoice_id = ?`,
            [invoice_id]
        );

        // Optional: Update invoice status
        await pool.execute(
            `UPDATE invoices SET invoice_type = 'sale' WHERE id = ?`,
            [invoice_id]
        );

        res.send({ message: 'Estimate converted to sales successfully',status:200});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllEstimates = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT est.id, est.status, inv.invoice_number, inv.total,inv.balance_left,inv.id AS invoice_id,     est.created_at
      FROM estimates est
      JOIN invoices inv ON inv.id = est.invoice_id
      ORDER BY est.created_at DESC
    `);
        res.send({message:'Estimates fetched successfully', data:rows, status:200});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
