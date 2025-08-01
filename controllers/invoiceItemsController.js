const pool = require('../db_config/db.js');
// CREATE
exports.addInvoiceItem = async (req, res) => {
  let { item_name, description='', item_code='', sale_price } = req.body;
  try {
    
    const [result] = await pool.execute(
      `INSERT INTO invoice_items (item_name, description, item_code, sale_price,created_by) 
       VALUES (?,?,?,?,?)`,
      [item_name, description, item_code, sale_price, req.user.id]
    );
    res.send({ message: 'Invoice Items created', status:200, id:result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllInvoiceItems = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invoice_items WHERE created_by = ?', [req.user.id]);
    res.json({message:"Invoice items fetched successfully", data:rows ,status:200});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ BY ID
exports.getInvoiceItemById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM invoice_items WHERE id = ? AND created_by = ?', [id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item found', data: rows[0], status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateInvoiceItem = async (req, res) => {
  const { id } = req.params;
  const { item_name, description, item_code, sale_price } = req.body;
  try {
    const [result] = await pool.execute(
      `UPDATE invoice_items SET 
        item_name = ?, description =?, item_code =?, sale_price =?
       WHERE id = ? AND created_by = ?`,
      [item_name, item_category, description, item_code, sale_price, id, req.user.id]
    );
    res.json({ message: 'Invoice item updated',status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteInvoiceItem = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM invoice_items WHERE id = ? AND created_by = ?', [id, req.user.id]);
    res.json({ message: 'Item deleted',status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
