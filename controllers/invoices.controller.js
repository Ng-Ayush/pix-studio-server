const pool = require('../db_config/db.js');
// CREATE
exports.generateInvoice = async (req, res) => {
  let { invoice_number, invoice_date, due_date, party_id, status, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number } = req.body;


  try {

    const value = [invoice_number, invoice_date, due_date, party_id, 1, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number];

    console.log(value);


    const [result] = await pool.execute(
      `INSERT INTO invoices (invoice_number,invoice_date,due_date,party_id,status,total,balance_left,invoice_type,payment_type,payment_type_description,invoice_items,time,phone_number) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, value
    );
    res.send({ message: 'Invoice created', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message, err: err });
  }
};

// READ ALL
exports.getAllInvoices = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices');
    res.json({ message: "Customers fetched successfully", data: rows, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ BY ID
exports.getInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer found', data: rows[0], status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInvoiceDetailByInvoiceNumber = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT inv.*,invci.* FROM invoices inv JOIN invoice_items invci ON JSON_CONTAINS(inv.invoice_items, invci.id)  WHERE invoice_number = ?`
    const [rows] = await pool.execute(query, [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Invoices not found' });
    const groupedInvoice = {
      invoice_number: rows[0].invoice_number,
      invoice_date: formatDate(rows[0].invoice_date),
      due_date: formatDate(rows[0].due_date),
      party_id: rows[0].party_id,
      status: rows[0].status,
      total: rows[0].total,
      balance_left: rows[0].balance_left,
      invoice_type: rows[0].invoice_type,
      payment_type: rows[0].payment_type,
      payment_type_description: rows[0].payment_type_description,
      phone_number: rows[0].phone_number,
      description: rows[0].description,
      time: rows[0].time,
      invoice_items: rows.map(row => ({
        id: row.item_id,
        item_name: row.item_name,
        description: row.description,
        quantity: row.quantity,
        sale_price: row.sale_price,
        purchase_price: row.purchase_price,
        item_code: row.item_code,
        item_category: row.item_category,
        item_stock: row.item_stock
      }))
    };
    res.json({ message: 'Invoice found', data: groupedInvoice, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { item_name, item_category, description, item_code, sale_price, purchase_price, item_stock } = req.body;
  try {
    const [result] = await pool.execute(
      `UPDATE invoices SET 
        item_name = ?, item_category = ?, description =?, item_code =?, sale_price =?, purchase_price =?, item_stock =? 
       WHERE id = ?`,
      [item_name, item_category, description, item_code, sale_price, purchase_price, item_stock, id]
    );
    res.json({ message: 'Customer updated', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);
    res.json({ message: 'Customer deleted', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function formatDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2)
    month = '0' + month;
  if (day.length < 2)
    day = '0' + day;

  return [year, month, day].join('-');
}
