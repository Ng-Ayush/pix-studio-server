const jwt = require('jsonwebtoken');
const pool = require('../db_config/db.js');
const axios = require('axios');
const crypto = require('crypto');
const ADMIN_RE = /^\d{6}$/;         // 6 digits for admin
const CUSTOMER_RE = /^\d{7}$/;      // 7 digits for normal customer
const AI_RE = /^[A-Z]{2}\d{4}$/;    // 2 uppercase letters + 4 digits for AI
const nodemailer = require('nodemailer');
const { getOtpEmailTemplate } = require("../utils/helper.js");
const { insertGlobalInvoiceItems } = require('./admin.controller.js');


exports.createUser = async (req, res) => {
    try {
        const brand = req.header('Brand') || req.header('brand') || req.header("BRAND");
        const { studio_name, email, phone_number, access_expires_on = null, allowed_photos_quantity = 0 } = req.body;
        if (!studio_name || !email || !phone_number) {
            return res.status(400).send({ error: 'Studio name, email, and phone number are required' });
        }

        // Create user and pin
        const newUser = await createUserWithPin(studio_name, email, phone_number, access_expires_on, allowed_photos_quantity, brand);

        await sendPinOnMail(newUser.pin, email, studio_name); // Send the pin to the user's email

        await insertGlobalInvoiceItems(newUser.id);

        res.send({ message: 'User Registered, Please Check Mail for Login Pin', userId: newUser.id, status: 200 });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send({ error: 'Failed to create user' });
    }
};

const sendPinOnMail = async (pin, email, studio_name) => {
    try {

        const transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.HOSTINGER_EMAIL,
                pass: process.env.HOSTINGER_PASS,
            },
        });

        const mailOptions = {
            from: `"Production House" <info@mystudioitsolutions.com>`,
            to: email,
            subject: 'Your Login Pin from Production House',
            html: getOtpEmailTemplate(pin, studio_name),    //template need to be changed
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
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

        if (role === 'admin') {
            const user = await verifyPin(pin);
            if (user) {
                if (user.status == 0) {
                    res.send({ error: 'Please contact to admin', status: 400, message: 'Account disabled, please contact to admin' });
                } else {
                    const token = jwt.sign({ _id: user.id }, process.env.JWT_SECRET);
                    res.send({ role: 'admin', phone_number: user.phone_number, name: user.name, user_id: user.id, userData: user, token: token, status: 200, message: 'Pin verification successful' });
                }
            } else {
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
            } else {
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
            if (row[0]?.id) {
                res.send({ message: "Code Verified", role: 'ai_customer', data: row[0], status: 200 })
            } else {
                res.send({ message: "Invalid Code", status: 400 })
            }
        }

    } catch (error) {
        console.error('Error verifying pin:', error);
        res.status(500).send({ error: 'Failed to verify pin' });
    }
};

exports.googleLogin = async (req, res) => {
    const { code, email: requestedEmail } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).send({ error: 'Google authorization code is required' });
    }
    if (requestedEmail !== undefined && typeof requestedEmail !== 'string') {
        return res.status(400).send({ error: 'Google email must be a string' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !process.env.JWT_SECRET) {
        console.error('Google login is missing required server configuration');
        return res.status(500).send({ error: 'Google login is not configured' });
    }

    let googleProfile;
    let googleRequestPhase = 'authorization code exchange';
    try {
        const tokenParams = new URLSearchParams({
            code: code.trim(),
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code',
        });
        const { data: tokenData } = await axios.post(
            'https://oauth2.googleapis.com/token',
            tokenParams.toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        if (!tokenData.access_token) {
            return res.status(401).send({ error: 'Google authorization code is invalid or expired' });
        }

        googleRequestPhase = 'Google profile lookup';
        const { data } = await axios.get(
            'https://openidconnect.googleapis.com/v1/userinfo',
            { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        googleProfile = data;
    } catch (error) {
        if (googleRequestPhase === 'authorization code exchange') {
            const googleError = error.response?.data?.error;
            const googleErrorDescription = error.response?.data?.error_description;
            console.error('Google authorization code exchange failed:', {
                status: error.response?.status,
                googleError,
                googleErrorDescription,
            });
            return res.status(error.response?.status === 400 ? 401 : 502).send({
                error: 'Google rejected the authorization code',
                googleError: googleError || 'token_exchange_failed',
                googleErrorDescription: googleErrorDescription || 'No error details returned by Google',
            });
        }
        console.error('Failed to verify Google identity:', {
            status: error.response?.status,
            googleError: error.response?.data?.error,
        });
        return res.status(502).send({ error: 'Failed to verify Google identity' });
    }

    if (!googleProfile.email || googleProfile.email_verified !== true) {
        return res.status(401).send({ error: 'A verified Google email is required' });
    }

    const verifiedEmail = googleProfile.email.trim().toLowerCase();
    if (requestedEmail && requestedEmail.trim().toLowerCase() !== verifiedEmail) {
        return res.status(401).send({ error: 'Google email does not match the requested account' });
    }

    try {
        const [matchingUsers] = await pool.execute(
            'SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1',
            [verifiedEmail]
        );
        let user = matchingUsers[0];

        if (!user) {
            const name = typeof googleProfile.name === 'string' ? googleProfile.name.trim() : '';
            if (!name) {
                return res.status(400).send({ error: 'Google profile name is required to create an account' });
            }

            const pin = await generateUniqueGooglePin();
            const brand = req.header('Brand') || req.header('brand') || req.header('BRAND') || null;
            let createdUserId;
            try {
                const [result] = await pool.execute(
                    `INSERT INTO users
                        (studio_name, email, phone_number, pin, access_expires_on, allowed_photos_quantity, brand)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name, verifiedEmail, '', pin, new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(), 100, brand]
                );
                createdUserId = result.insertId;
            } catch (error) {
                if (error.code !== 'ER_DUP_ENTRY') {
                    throw error;
                }
                const [racedUsers] = await pool.execute(
                    'SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1',
                    [verifiedEmail]
                );
                user = racedUsers[0];
                if (!user) {
                    throw error;
                }
            }
            if (createdUserId) {
                await insertGlobalInvoiceItems(createdUserId);
                const [createdUsers] = await pool.execute(
                    'SELECT * FROM users WHERE id = ?',
                    [createdUserId]
                );
                user = createdUsers[0];
            }
        }

        if (user.status == 0) {
            return res.status(403).send({
                error: 'Account disabled, please contact to admin',
                status: 403,
            });
        }
        if (user.access_expires_on && new Date() > new Date(user.access_expires_on)) {
            return res.status(403).send({
                error: 'Your access has expired. Please renew your subscription.',
                status: 403,
            });
        }

        const token = jwt.sign({ _id: user.id }, process.env.JWT_SECRET);
        return res.send({
            token,
            userData: user,
            status: 200,
            message: 'Google login successful',
        });
    } catch (error) {
        console.error('Error completing Google login:', error);
        return res.status(500).send({ error: 'Failed to complete Google login' });
    }
};

const createUserWithPin = async (studio_name, email, phone_number, access_expires_on, allowed_photos_quantity, brand) => {
    try {
        const pin = generateUniquePin();

        // Insert user into the database
        const [result] = await pool.execute(
            'INSERT INTO users (studio_name, email, phone_number, pin, access_expires_on, allowed_photos_quantity, brand) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [studio_name, email, phone_number, pin, access_expires_on, allowed_photos_quantity, brand]
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

async function generateUniqueGooglePin() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const pin = String(crypto.randomInt(100000, 1000000));
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE pin = ? LIMIT 1',
            [pin]
        );
        if (existingUsers.length === 0) {
            return pin;
        }
    }
    throw new Error('Unable to generate a unique login pin');
}
