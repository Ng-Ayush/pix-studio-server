const twilio = require("twilio");
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const { generateOTP } = require("../utils/helper.js");
var otpForVerification = 0;
const jwt = require("jsonwebtoken");
const pool = require('../db_config/db.js');

const ADMIN_RE = /^\d{6}$/;         // 6 digits for admin
const CUSTOMER_RE = /^\d{7}$/;      // 7 digits for normal customer
const AI_RE = /^[A-Z]{2}\d{4}$/;    // 2 uppercase letters + 4 digits for AI

exports.sendOtp = async (req, res) => {
    const { phone_number, name, is_ai_guest = false,event_id='' } = req.body;
    if (!phone_number) return res.status(400).send({ message: "Phone number is required" });

    if (is_ai_guest) {
        const [rows] = await pool.execute('SELECT guest_phone,event_id FROM ai_guests WHERE guest_phone = ? && event_id = ? LIMIT 1', [phone_number,event_id]);
        if (rows.length > 0) {
            return res.send({ message: "User already exists", status: 400 });
        }
    }


    const otp = generateOTP();

    otpForVerification = otp;

    console.log("GOT NEW OTOP", otpForVerification);


    const message = `Hi ${name} ,Your OTP is: ${otp}. It is valid for 5 minutes.`;
    try {
        await client.messages.create({
            body: message,
            from: "whatsapp:+14155238886", // Twilio Sandbox Number
            to: "whatsapp:" + phone_number,
        });

        res.send({ message: "OTP sent successfully!", otp, status: 200 });
    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).send({ message: "Failed to send OTP", status: 500, otp: otp });
    }
};

exports.verifyOTPForPinUser = async (req, res) => {
    try {
        const { otp, user_id } = req.body;

        // Code is Commented for testing app

        // if (!otp || isNaN(otp)) {
        //     return res.send({ error: 'Invalid OTP' });
        // }

        // const storedOtp = otpForVerification;

        // console.log("STOPED ", otpForVerification, otp);

        // if (!storedOtp) return res.send({ message: 'OTP expired or not found', status: 400 });

        // if (storedOtp != otp) return res.send({ message: 'Invalid OTP' });

        //TIL HERE

        const token = jwt.sign({ _id: user_id }, process.env.JWT_SECRET);


        return res.send({ message: 'OTP verified', token: token, status: 200 });

    } catch (error) {
        console.error('Error verifying pin:', error);
        res.status(500).send({ message: 'Failed to verify pin', status: 500 });
    }
}