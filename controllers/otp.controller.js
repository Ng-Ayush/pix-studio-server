const twilio = require("twilio");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const { generateOTP, getOtpEmailTemplate } = require("../utils/helper.js");
var otpForVerification = 0;
const jwt = require("jsonwebtoken");
const pool = require('../db_config/db.js');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
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