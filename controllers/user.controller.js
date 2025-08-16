const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');
const ADMIN_RE = /^\d{6}$/;         // 6 digits for admin
const CUSTOMER_RE = /^\d{7}$/;      // 7 digits for normal customer
const AI_RE = /^[A-Z]{2}\d{4}$/;    // 2 uppercase letters + 4 digits for AI


exports.createUser = async (req, res) => {
    try {
        const { name, email, phone_number } = req.body;
        if (!name || !email || !phone_number) {
            return res.status(400).send({ error: 'Name, email, and phone number are required' });
        }

        // Create user and pin
        const newUser = await createUserWithPin(name, email, phone_number);
        res.status(201).send({ message: 'User created successfully', userId: newUser.id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send({ error: 'Failed to create user' });
    }
};

// Login with pin verification
exports.verifyPinUser = async (req, res) => {
    try {
        const { pin } = req.body;

        const role = detectRole(pin);
        if (!role) {
            return res.send({ status: 400, message: 'Invalid code format' });
        }

        console.log(role);


        if (role === 'admin') {
            const user = await verifyPin(pin);
            if (user) {
                if (user.status == 0) {
                    res.send({ error: 'Please contact to admin', status: 400, message: 'Account disabled, please contact to admin' });
                } else {
                    const token = jwt.sign({ _id: user.id }, process.env.JWT_SECRET);
                    res.send({ role: 'admin', phone_number: user.phone_number, name: user.name, user_id: user.id, userData: user, token: token, status: 200, message: 'Pin verification successful' });
                }
            }else{
                res.send({ error: 'Invalid pin', status: 400, message: 'Invalid pin' });
            }
        } else if (role == 'customer') {

            const query = `SELECT 
        ev.is_event_submitted,
         c.id,
         user.*
         FROM customers c 
         JOIN events ev ON ev.customer_id = c.id
         JOIN users user ON user.id = c.created_by
        WHERE c.customer_unique_id = ?`;

            const [codeQuery] = await pool.execute(query, [pin]);

            if (codeQuery[0]?.id) {
                res.send({ message: "Code Verified", role: 'customer', data: codeQuery[0], is_event_submitted: !!codeQuery[0]?.is_event_submitted, status: 200 })
            } else{
                res.send({ message: "Invalid Code", status: 400 })
            }
        } else if (role == 'ai_customer') {
            const query = `SELECT 
         c.*,
         user.*,
         user.id AS user_id,
         ev.*,
         ev.id AS event_id  
         FROM customers c 
         JOIN events ev ON ev.customer_id = c.id
         JOIN users user ON user.id = c.created_by
        WHERE c.customer_unique_id = ? AND c.is_ai_customer = 1`;

            const [row] = await pool.execute(query, [pin]);
            console.log(row);
            if(row[0]?.id){
                res.send({ message: "Code Verified", role: 'ai_customer', data: row[0], status: 200 })
            } else{
                res.send({ message: "Invalid Code", status: 400 })
            }
        }

    } catch (error) {
        console.error('Error verifying pin:', error);
        res.status(500).send({ error: 'Failed to verify pin' });
    }
};

const createUserWithPin = async (name, email, phone_number) => {
    try {
        const pin = generateUniquePin();

        // Insert user into the database
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, phone_number, pin) VALUES (?, ?, ?, ?)',
            [name, email, phone_number, pin]
        );

        // Return the new user info
        return { id: result.insertId, pin };
    } catch (error) {
        console.error('Error creating user:', error);
        throw new Error('Error creating user');
    }
};

// Verify the pin entered by the user
const verifyPin = async (pin) => {
    try {
        const [user] = await pool.execute(
            'SELECT * FROM users WHERE pin = ?',
            [pin]
        );

        // If user is found, return user data
        return user.length > 0 ? user[0] : null;
    } catch (error) {
        console.error('Error verifying pin:', error);
        throw new Error('Error verifying pin');
    }
};

// Generate a unique 6-digit pin
function generateUniquePin() {
    let pin;
    do {
        pin = Math.floor(100000 + Math.random() * 900000);  // Generates a 6-digit number
    } while (!isPinUnique(pin));
    return pin;
}

// Check if the generated pin is unique in the database
async function isPinUnique(pin) {
    const [existingUser] = await pool.execute(
        'SELECT * FROM users WHERE pin = ?',
        [pin]
    );
    return existingUser.length === 0;
}

function detectRole(code) {
    if (ADMIN_RE.test(code)) return 'admin';
    if (CUSTOMER_RE.test(code)) return 'customer';
    if (AI_RE.test(code)) return 'ai_customer';
    return null;
}
