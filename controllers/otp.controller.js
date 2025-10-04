const twilio = require("twilio");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const { generateOTP, getOtpEmailTemplate } = require("../utils/helper.js");
var otpForVerification = 0;
const jwt = require("jsonwebtoken");
const pool = require('../db_config/db.js');
const nodemailer = require('nodemailer');
const { initWhatsAppClientForAdmin, clients } = require('../whatsappClientManager.js');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
// const WA_SESSIONS_DIR = path.resolve(__dirname, '../../.wwebjs_auth');

exports.sendOtp = async (req, res) => {
    const { phone_number, name, event_id = '', email = '' } = req.body;

    if (!phone_number) {
        return res.send({ message: "Phone number is required", status: 400 });
    }

    try {

        const otp = generateOTP();
        console.log("Generated OTP:", otp);

        const message = `Hi ${name}, Your OTP is: ${otp}. It is valid for 5 minutes.`;

        let smsSent = false;
        let emailSent = false;

        try {
            await client.messages.create({
                body: message,
                from: '+19713091748',
                to: "+91" + phone_number
            });
            smsSent = true;
        } catch (smsError) {
            console.error("Failed to send OTP via SMS:", smsError);
        }

        if (email) {
            try {
                console.log("MAIL", process.env.HOSTINGER_EMAIL, process.env.HOSTINGER_PASS);

                const transporter = nodemailer.createTransport({
                    host: "smtp.hostinger.com",
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.HOSTINGER_EMAIL,
                        pass: process.env.HOSTINGER_PASS
                    }
                });

                const mailOptions = {
                    from: `"My Studio" <info@mystudioitsolutions.com>`,
                    to: email,
                    subject: 'Your OTP Code from My Studio',
                    html: getOtpEmailTemplate(otp, name),
                };

                await transporter.sendMail(mailOptions);
                emailSent = true;
            } catch (emailError) {
                console.error("Failed to send OTP via Email:", emailError);
            }
        }

        if (smsSent && emailSent) {
            return res.send({ message: "OTP sent via SMS and Email!", otp, status: 200 });
        } else if (smsSent) {
            return res.send({ message: "OTP sent via SMS!", otp, status: 200 });
        } else if (emailSent) {
            return res.send({ message: "OTP sent via Email!", otp, status: 200 });
        } else {
            return res.send({ message: "Failed to send OTP via both SMS and Email", status: 500 });
        }

    } catch (error) {
        console.error("Unexpected error:", error);
        return res.send({ message: "Internal server error", status: 500 });
    }
};

async function setupWhatsAppHandlers(client, user_id, io) {
    client.on('qr', async qr => {
        await pool.query(`
      INSERT INTO whatsapp_sessions (user_id, status, qr_code, last_connected)
      VALUES (?, 'pending', ?, NOW())
      ON DUPLICATE KEY UPDATE status='pending', qr_code=VALUES(qr_code), updated_at=NOW()
    `, [user_id, qr]);

        io.to(`user_${user_id}`).emit('qr', qr);
    });

    client.on('authenticated', async () => {
        const waNumber = client.info?.wid?.user || null;

        await pool.query(`
      INSERT INTO whatsapp_sessions (user_id, wa_number, status, last_connected)
      VALUES (?, ?, 'ready', NOW())
      ON DUPLICATE KEY UPDATE wa_number=VALUES(wa_number), status='ready', last_connected=NOW(), updated_at=NOW()
    `, [user_id, waNumber]);

        io.to(`user_${user_id}`).emit('authenticated');
    });

    client.on('ready', async () => {
        await pool.query(`
      UPDATE whatsapp_sessions SET status='ready', last_connected=NOW(), updated_at=NOW()
      WHERE user_id=?
    `, [user_id]);

        client.isReady = true;

        io.to(`user_${user_id}`).emit('ready');
    });

    client.on('auth_failure', msg => {
        io.to(`user_${user_id}`).emit('auth_failure', msg);
        console.error(`Auth failure for user ${user_id}:`, msg);
    });

    client.on('disconnected', async reason => {
        clients.delete(user_id);

        await pool.query(`
      UPDATE whatsapp_sessions SET status='disconnected', updated_at=NOW()
      WHERE user_id=?
    `, [user_id]);

        io.to(`user_${user_id}`).emit('disconnected', reason);
        console.warn(`WhatsApp disconnected for user ${user_id}:`, reason);
    });

    client.on('change_state', state => {
        io.to(`user_${user_id}`).emit('change_state', state);
        console.log(`WhatsApp client state changed for user ${user_id}:`, state);
    });
}

exports.verifyOTPForPinUser = async (req, res) => {
    try {
        const { otp, user_id } = req.body;
        // const io = req.app.locals.io;

        // if (!io) return res.status(500).send('Socket.io not initialized');

        // if (!clients.has(user_id)) {
        //     const client = await initWhatsAppClientForAdmin(user_id);
        //     await setupWhatsAppHandlers(client, user_id, io);
        //     await client.initialize();
        //     clients.set(user_id, client);
        // } else {
        //     io.to(`user_${user_id}`).emit('message', 'WhatsApp client already initialized');
        // }

        const token = jwt.sign({ _id: user_id }, process.env.JWT_SECRET);
        return res.send({ message: 'OTP verified', token, status: 200 });
    } catch (error) {
        console.error('Error in verifyOTPForPinUser:', error);
        return res.status(500).send({ message: 'Failed to verify pin', status: 500 });
    }
};

async function clearSession(adminId) {
    const sessionDir = path.join(__dirname, '../../.wwebjs_auth', adminId.toString());
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}