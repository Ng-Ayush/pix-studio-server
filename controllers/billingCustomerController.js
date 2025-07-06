const pool = require('../db_config/db.js');
// CREATE
exports.createCustomer = async (req, res) => {
  let { party_name, phone_number, billing_address, email } = req.body;
  try {
    console.log(req.body);

    const [result] = await pool.execute(
      `INSERT INTO billing_customer (party_name, phone_number, billing_address,email) 
       VALUES (?, ?, ?, ?)`,
      [party_name, phone_number, billing_address, email]
    );
    res.send({ message: 'Customer created', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllCustomers = async (req, res) => {
  try {
    console.log("rewqwqwq urse",req.user)
    const query = `SELECT bc.*,invc.total,invc.balance_left,invc.invoice_type FROM billing_customer bc LEFT JOIN invoices invc ON bc.id = invc.party_id ORDER BY bc.party_name ASC`;
    const [rows] = await pool.execute(query);
    
    const customersMap = new Map();
    for (const row of rows) {
      const customerId = row.id;

      if (!customersMap.has(customerId)) {
        customersMap.set(customerId, {
          id: row.id,
          party_name: row.party_name,
          phone_number: row.phone_number,
          email: row.email,
          party_group: row.party_group,
          billing_address: row.billing_address,
          shipping_address: row.shipping_address,
          created_at: row.created_at,
          updated_at: row.updated_at,
          total: 0,
          balance_left: 0,
          invoice_type: row.invoice_type
        });
      }

      // If this row has invoice data, accumulate totals
      if (row.total !== null && row.balance_left !== null) {
        const customer = customersMap.get(customerId);
        customer.total += Number(row.total);
        customer.balance_left += Number(row.balance_left);
      }
    }

    const customers = Array.from(customersMap.values());

    res.json({ message: "Customers fetched successfully", data: customers, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message, err: err });
  }
};

// READ BY ID
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM billing_customer WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer found', data: rows[0], status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// READ BY ID
exports.getInvoiceByPartyId = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE party_id = ?', [id]);
    if (rows.length === 0) return res.send({ message: 'Invoice not found', status: 200, data: [] });
    const parsedValue = rows.map((item) => ({ ...item, invoice_items: JSON.parse(item.invoice_items) }));
    res.json({ message: 'Invoice found', data: parsedValue, status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { party_name, phone_number, billing_address, email } = req.body;
  try {
    const [result] = await pool.execute(
      `UPDATE billing_customer SET 
         party_name = ?, phone_number = ?,
         billing_address = ?, email = ? 
       WHERE id = ?`,
      [party_name, phone_number, billing_address, email, id]
    );
    res.json({ message: 'Customer updated', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM billing_customer WHERE id = ?', [id]);
    res.json({ message: 'Customer deleted', status: 200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
