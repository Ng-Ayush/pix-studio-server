const pool = require('../db_config/db.js');
const axios = require('axios');

async function getAuthToken() {
    const response = await axios.post("https://ivr.voicensms.in:5004/api/Auth/token", {
        Username: process.env.CALLING_USERNAME,
        Password: process.env.CALLING_PASSWORD
    });
    return response.data;
}

exports.addAgent = async (req, res) => {
    const { agent_name, agent_phone, email } = req.body;

    try {
        const [lastExtension] = await pool.query(
            'SELECT extension_number FROM callings ORDER BY id DESC LIMIT 1'
        );

        let extension_number;
        console.log(lastExtension);
        
        if (lastExtension[0] && lastExtension[0].extension_number) {
            const lastExtensionNumber = parseInt(lastExtension[0].extension_number);
            extension_number = String(lastExtensionNumber + 1).padStart(3, '0');
        } else {
            extension_number = '001';
        }


        const [existing] = await pool.query(
            'SELECT * FROM callings WHERE agent_phone = ? OR extension_number = ?',
            [agent_phone, extension_number]
        );

        if (existing.length > 0) {
            return res.send({
                message: existing[0].agent_phone == agent_phone
                    ? 'Phone number already exists'
                    : 'Extension number already exists',
                status: 400
            });
        }

        let data = await getAuthToken();

        const callAddAgent = async (token) => {
            const response = await axios.post(
                "https://ivr.voicensms.in:5004/api/AddAgent",
                {
                    ownerid: data.user.ownerid,
                    email,
                    agent_name: agent_name,
                    agent_phoneno: "0" + agent_phone,
                    exten: extension_number
                },
                { headers: { Authorization: token } }
            );
            return response.data; 
        };

        let apiResponse;
        try {
            // First attempt
            apiResponse = await callAddAgent(data.access_token);

            // Retry if token invalid
            if (typeof apiResponse == "string" && apiResponse.includes("Invalid Token")) {
                data = await getAuthToken();
                apiResponse = await callAddAgent(data.access_token);
            }

        } catch (err) {
            if (err.response && typeof err.response.data == "string" && err.response.data.includes("Invalid Token")) {
                data = await getAuthToken();
                apiResponse = await callAddAgent(data.access_token);
            } else {
                throw err;
            }
        }



        // 🔹 Handle API response
        if (typeof apiResponse == "string" && apiResponse.includes("Successfully")) {
            await pool.query(
                'INSERT INTO callings (agent_name, agent_phone, extension_number,pilot_number,email, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                [agent_name, agent_phone, extension_number, data.user.bizfoneno, email, req.user.id]
            );
            return res.send({ message: 'Agent added successfully', status: 200 });
        }

        if (typeof apiResponse == "string" && apiResponse.includes("exist")) {
            return res.send({ message: 'Agent already exists', status: 400 });
        }

        // Fallback
        return res.send({ message: 'Failed to add agent', status: 400 });

    } catch (error) {
        console.error(error.response?.data || error.message);

        return res.send({ message: error.response?.data || 'Something went wrong', status: 400 });
    }
};


exports.getAgents = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM callings WHERE created_by = ?', [req.user.id]);
        res.send({ message: "Agents fetched successfully", data: rows, status: 200 });
    } catch (error) {
        res.send({ message: 'Something went wrong', error: error, status: 400 });        
    }
};