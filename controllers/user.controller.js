const pool = require('../db_config/db.js');
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

        if (!pin || isNaN(pin)) {
            return res.status(400).send({ error: 'Invalid pin' });
        }

        const user = await verifyPin(pin);
        if (user) {
              if(user.status == 0){
                res.send({ error: 'Please contact to admin', status: 400, message: 'Account disabled, please contact to admin' });
            }else{
            res.send({ phone_number: user.phone_number, name: user.name, user_id:user.id, userData:user, status:200, message: 'Pin verification successful' });
            }
        } else {
            res.send({ error: 'Invalid pin', status:400, message: 'Invalid pin' });
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
