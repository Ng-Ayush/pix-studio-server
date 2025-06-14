const pool = require('../db_config/db.js');
const { generateCustomerId } = require('../utils/helper.js');

// CREATE CUSTOMER
exports.createCustomer = async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user_id = req.user.id;
        const customer_unique_id  = generateCustomerId();

        const [existing] = await pool.execute(
            'SELECT * FROM customers WHERE phone = ?',
            [phone]
        );

        if (existing.length > 0) {
            return res.send({ message: 'Customer already exists',status: 400 });
        }

        const [result] = await pool.execute(
            'INSERT INTO customers (customer_unique_id , name, phone ,created_by) VALUES (?, ?, ? ,?)',
            [customer_unique_id, name, phone,user_id]
        );

        res.send({ message:"Customer created successfully", status: 200 });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Internal server error' });
    }
};

// GET ALL CUSTOMERS
exports.getAllCustomers = async (req, res) => {
    try {
        const user_id = req.user.id;
        const query = `SELECT cus.*, (SELECT COUNT(*) FROM events WHERE customer_id = cus.id) AS events FROM customers cus WHERE created_by = ? ORDER BY id DESC`
        const [customers] = await pool.execute(query,[user_id]);
        res.send({message:"Customers fetched successfully", data:customers ,status:200});
    } catch (err) {
        res.status(500).send({ error: 'Failed to fetch customers' });
    }
};

// GET SINGLE CUSTOMER
exports.getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const [customer] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);

        if (!customer.length) {
            return res.status(404).send({ message: 'Customer not found' });
        }

        res.send(customer[0]);
    } catch (err) {
        res.status(500).send({ error: 'Failed to get customer' });
    }
};

exports.searchCustomer = async (req, res) => {
    try {
        const { name } = req.params;
        const user_id = req.user.id;
        console.log(name);
        
        const query =   `SELECT cus.*, (SELECT COUNT(*) FROM events WHERE customer_id = cus.id) AS events FROM customers cus WHERE name LIKE '%${name}%' AND created_by = ? ORDER BY id DESC`;
        const [customer] = await pool.execute(query, [user_id]);

        if (!customer.length) {
            return res.send({ message: 'Customer not found',status:200 ,data:[] });
        }

        res.send({message:"Customers fetched successfully", data:customer ,status:200});
    } catch (err) {
        res.status(500).send({ error: 'Failed to get customer' });
    }
};

// UPDATE CUSTOMER
exports.updateCustomer = async (req, res) => {
    try {
        const { name, phone, id } = req.body;
        const user_id = req.user.id;

        await pool.execute(
            'UPDATE customers SET name = ?, phone = ? WHERE id = ? AND created_by = ?',
            [name, phone, id,user_id]
        );

        res.send({ message: 'Customer updated successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update customer' });
    }
};

// DELETE CUSTOMER
exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        await pool.execute('DELETE FROM customers WHERE id = ? AND created_by = ?', [id,user_id]);
        res.send({ message: 'Customer deleted successfully', status:200 });
    } catch (err) {
        res.status(500).send({ error: 'Failed to delete customer' });
    }
};