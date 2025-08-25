const pool = require('../db_config/db.js'); // your MySQL connection

exports.createEstimate = async (req, res) => {
    try {
        const { invoice_id, terms_and_conditions } = req.body;
        if (!terms_and_conditions) {
            return res.send({ error: 'Terms and conditions is required', message:"Terms and conditions is required",status:400 });
        }else if(!invoice_id){
            return res.send({ error: 'Invoice id is required',message:"Invoice id is required",status:400 });
        }

        const [check] = await pool.execute(`SELECT id FROM estimates WHERE invoice_id = ?`, [invoice_id]);
        if (check.length > 0) {
            return res.status(400).json({ error: 'Estimate already exists for this invoice' });
        }

       const [row] = await pool.execute(
            `INSERT INTO estimates (invoice_id, terms_and_conditions,created_by) VALUES (?, ?, ?)`,
            [invoice_id, terms_and_conditions, req.user.id]
        );

        res.send({ message: 'Estimate created successfully',estimate_id:row.insertId , status:200 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateEstimate = async (req, res) => {
    try {
        const { invoice_id } = req.params;
        const { terms_and_conditions } = req.body;
        if (!terms_and_conditions) {
            return res.send({ error: 'terms_and_conditions required',message: 'Terms and Condition required', status: 400 });
        }
        await pool.execute(
            `UPDATE estimates SET terms_and_conditions = ? WHERE invoice_id = ? AND created_by = ?`,
            [terms_and_conditions, invoice_id, req.user.id]
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
      WHERE est.created_by = ?
      ORDER BY est.created_at DESC

    `, [req.user.id]);
        res.send({message:'Estimates fetched successfully', data:rows, status:200});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
