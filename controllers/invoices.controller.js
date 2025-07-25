const pool = require('../db_config/db.js');
// CREATE
exports.generateInvoice = async (req, res) => {
  let { invoice_number, invoice_date, due_date, party_id, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number,discount_value,discount_type } = req.body;


  try {

    const value = [invoice_number, invoice_date, due_date, party_id,'Estimate Order', total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number,discount_value,discount_type, req.user.id];
    const [result] = await pool.execute(
      `INSERT INTO invoices (invoice_number,invoice_date,due_date,party_id,status,total,balance_left,invoice_type,payment_type,payment_type_description,invoice_items,time,phone_number,discount_value,discount_type,created_by) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, value
    );

    for (const item of JSON.parse(invoice_items)) {
      const { id: id, booking_date, location } = item;

      const updateFields = [];
      const values = [];

      if (booking_date) {
        updateFields.push(`booking_date = ?`);
        values.push(booking_date);
      }

      if (location) {
        updateFields.push(`location = ?`);
        values.push(location);
      }

      if (updateFields.length > 0) {
        values.push(id); // WHERE id = ?
        const query = `UPDATE invoice_items SET ${updateFields.join(', ')} WHERE id = ?`;
        await pool.execute(query, values);
      }
    }

    res.send({ message: 'Invoice created', status: 200,id:result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message, err: err });
  }
};

// READ ALL
exports.getAllInvoices = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE created_by = ?', [req.user.id]);
    res.json({ message: "Invoices fetched successfully", data: rows, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getPastPayments = async (req, res) => {
  try {
    const {id} = req.params;
    const [rows] = await pool.execute('SELECT * FROM invoice_payments WHERE invoice_id = ?', [id]);
    res.json({ message: "Invoices Payment fetched successfully", data: rows, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ BY ID
exports.getInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT inv.*, invci.*,inv.id AS invoice_id, bc.party_name,est.id AS estimate_id, est.terms_and_conditions, est.status as estimate_status
FROM invoices inv 
JOIN invoice_items invci  
  ON JSON_CONTAINS(inv.invoice_items, JSON_OBJECT('id', invci.id)) 
  LEFT JOIN billing_customer bc
  ON inv.party_id = bc.id
  LEFT JOIN estimates est
  ON inv.id = est.invoice_id
WHERE inv.id = ? AND inv.created_by = ?`;
    const [rows] = await pool.execute(query, [id, req.user.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Invoices not found' });
    const groupedInvoice = {
      invoice_number: rows[0].invoice_number,
      invoice_date: formatDate(rows[0].invoice_date),
      invoice_id: rows[0].invoice_id, 
      due_date: formatDate(rows[0].due_date),
      party_id: rows[0].party_id,
      status: rows[0].status,
      total: rows[0].total,
      balance_left: rows[0].balance_left,
      invoice_type: rows[0].invoice_type,
      payment_type: rows[0].payment_type,
      payment_type_description: rows[0].payment_type_description,
      phone_number: rows[0].phone_number,
      time: rows[0].time,
      terms_and_conditions: rows[0].terms_and_conditions,
      estimate_status: rows[0].estimate_status,
      estimate_id: rows[0].estimate_id,
      party_name: rows[0].party_name,
      discount_type: rows[0].discount_type,
      discount_value: rows[0].discount_value,
      invoice_items: rows.map(row => ({
        id: row.id,
        item_name: row.item_name,
        description: row.description,
        quantity: row.quantity,
        sale_price: row.sale_price,
        purchase_price: row.purchase_price,
        item_code: row.item_code,
        item_category: row.item_category,
        item_stock: row.item_stock,
        location: row.location,
        booking_date: row.booking_date
      }))
    };
    res.json({ message: 'Invoice found', data: groupedInvoice, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInvoiceDetailByInvoiceNumber = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `SELECT inv.*, invci.*,inv.id AS invoice_id 
FROM invoices inv 
JOIN invoice_items invci 
  ON JSON_CONTAINS(inv.invoice_items, JSON_OBJECT('id', invci.id)) 
WHERE invoice_number = ?`
    const [rows] = await pool.execute(query, [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Invoices not found' });
    const groupedInvoice = {
      invoice_number: rows[0].invoice_number,
      invoice_date: formatDate(rows[0].invoice_date),
      invoice_id: rows[0].invoice_id,
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
      discount_type: rows[0].discount_type,
      discount_value: rows[0].discount_value,
      invoice_items: rows.map(row => ({
        id: row.id,
        item_name: row.item_name,
        description: row.description,
        quantity: row.quantity,
        sale_price: row.sale_price,
        purchase_price: row.purchase_price,
        item_code: row.item_code,
        item_category: row.item_category,
        item_stock: row.item_stock,
        location: row.location,
        booking_date: row.booking_date
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
  const { invoice_number, invoice_date, due_date, party_id, status, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number,discount_value,discount_type } = req.body;
  console.log("DSDSD", invoice_items);

  try {
    const query = `UPDATE invoices SET invoice_date = ?, due_date = ?, party_id = ?, status = ?,
        total = ?, balance_left = ?, invoice_type = ?, payment_type = ?, payment_type_description = ?, invoice_items = ?, time = ?, phone_number = ?, discount_value = ?, discount_type = ?
       WHERE invoice_number = ?`;
    const value = [invoice_date, due_date, party_id, status, total, balance_left, invoice_type, payment_type, payment_type_description, invoice_items, time, phone_number,discount_value,discount_type, invoice_number];
    const [result] = await pool.execute(query, value);

    for (const item of JSON.parse(invoice_items)) {
      const { id: id, booking_date, location } = item;

      const updateFields = [];
      const values = [];

      if (booking_date) {
        updateFields.push(`booking_date = ?`);
        values.push(booking_date);
      }

      if (location) {
        updateFields.push(`location = ?`);
        values.push(location);
      }

      if (updateFields.length > 0) {
        values.push(id); // WHERE id = ?
        const query = `UPDATE invoice_items SET ${updateFields.join(', ')} WHERE id = ?`;
        await pool.execute(query, values);
      }
    }

    res.json({ message: 'Invoice updated', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err });
  }
};

// DELETE
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);
    res.json({ message: 'Invoices deleted', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.saveAdvancePayment = async (req,res) => {
    const { invoice_id,party_id,method, amount_paid,note='' } = req.body;
    try{
      const query = `INSERT INTO invoice_payments (invoice_id,party_id,method,amount_paid,note) VALUES (?,?,?,?,?)`;
      const value = [invoice_id, party_id,method,amount_paid,note];
      const [result] = await pool.execute(query, value);
      res.send({ message: 'Advance payment saved', status: 200 });
    }catch(err){
      res.send({ error: err.message ,status:500});
    }
}

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
