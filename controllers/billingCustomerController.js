const pool = require('../db_config/db.js');
// CREATE
exports.createCustomer = async (req, res) => {
  let { party_name, phone_number, party_group, billing_address, shipping_address,email } = req.body;
  try {
    console.log(req.body);
    if(!shipping_address){
        shipping_address = '';
    }
    
    const [result] = await pool.execute(
      `INSERT INTO billing_customer (party_name, phone_number, party_group, billing_address, shipping_address,email) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [party_name, phone_number, party_group, billing_address, shipping_address,email]
    );
    res.send({ message: 'Customer created', status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllCustomers = async (req, res) => {
  try {
    const query = `SELECT bc.*,invc.total,invc.balance_left FROM billing_customer bc LEFT JOIN invoices invc ON bc.id = invc.party_id`
    const [rows] = await pool.execute(query);
    res.json({message:"Customers fetched successfully", data:rows ,status:200});
  } catch (err) {
    res.status(500).json({ error: err.message,err:err });
  }
};

// READ BY ID
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM billing_customer WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer found', data: rows[0], status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// READ BY ID
exports.getInvoiceByPartyId = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE party_id = ?', [id]);
    if (rows.length === 0) return res.send({ message: 'Invoice not found',status:200 ,data:[] });
    const parsedValue = rows.map((item)=>({...item,invoice_items:JSON.parse(item.invoice_items)}));
    res.json({ message: 'Invoice found', data: parsedValue, status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { party_name, phone_number, party_group, billing_address, shipping_address,email } = req.body;
  try {
    const [result] = await pool.execute(
      `UPDATE billing_customer SET 
         party_name = ?, phone_number = ?, party_group = ?, 
         billing_address = ?, shipping_address = ?,email = ? 
       WHERE id = ?`,
      [party_name, phone_number, party_group, billing_address, shipping_address,email, id]
    );
    res.json({ message: 'Customer updated',status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM billing_customer WHERE id = ?', [id]);
    res.json({ message: 'Customer deleted',status:200 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
