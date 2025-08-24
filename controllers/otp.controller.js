const twilio = require("twilio");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const { generateOTP, getOtpEmailTemplate } = require("../utils/helper.js");
var otpForVerification = 0;
const jwt = require("jsonwebtoken");
const pool = require('../db_config/db.js');
const nodemailer = require('nodemailer');


exports.sendOtp = async (req, res) => {
    const { phone_number, name, is_ai_guest = false, event_id = '', email = '' } = req.body;

    if (!phone_number) return res.status(400).send({ message: "Phone number is required" });

    if (is_ai_guest) {
        const [rows] = await pool.execute(
            'SELECT guest_phone, event_id FROM ai_guests WHERE guest_phone = ? AND event_id = ? LIMIT 1',
            [phone_number, event_id]
        );
        if (rows.length > 0) {
            return res.send({ message: "User already exists", status: 400 });
        }
    }

    const otp = generateOTP();

    console.log("Generated OTP:", otp);

    const message = `Hi ${name}, Your OTP is: ${otp}. It is valid for 5 minutes.`;

    try {
        // Send SMS via Twilio
        await client.messages.create({
            body: message,
            from: '+19713091748', // Official number
            to: "+91" + phone_number
        });

        if (email) {
            // Configure transporter
            let transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL,
                    pass: process.env.APP_PASSWORD
                }
            });

            const mailOptions = {
                from: process.env.GMAIL,
                to: email,
                subject: 'Your OTP Code from My Studio',
                html: getOtpEmailTemplate(otp, name),
            };

            // Wrap sendMail in Promise to await it
            await new Promise((resolve, reject) => {
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(info);
                    }
                });
            });
        }

        res.send({ message: "OTP sent via SMS and Email!", otp, status: 200 });

    } catch (error) {
        console.error("Error sending OTP:", error);
        res.send({ message: "Failed to send OTP", status: 500 });
    }
};


exports.verifyOTPForPinUser = async (req, res) => {
    try {
        const { otp, user_id } = req.body;

        // // Code is Commented for testing app

        // if (!otp || isNaN(otp)) {
        //     return res.send({ error: 'Invalid OTP' });
        // }

        // const storedOtp = otpForVerification;

        // console.log("STOPED ", otpForVerification, otp);

        // if (!storedOtp) return res.send({ message: 'OTP expired or not found', status: 400 });

        // if (storedOtp != otp) return res.send({ message: 'Invalid OTP' });


        const token = jwt.sign({ _id: user_id }, process.env.JWT_SECRET);

        return res.send({ message: 'OTP verified', token: token, status: 200 });

    } catch (error) {
        console.error('Error verifying pin:', error);
        res.status(500).send({ message: 'Failed to verify pin', status: 500 });
    }
}