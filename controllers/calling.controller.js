const pool = require('../db_config/db.js');


exports.addAgent = async (req, res) => {
    const { agentName,agentPhone,email } = req.body;
    const [rows] = await pool.query('INSERT INTO callings (email,agent_name,agent_phone) VALUES (?, ?, ?)', [email, agentName,agentPhone]);
    res.send({ message: 'Agent added successfully', status: 200 });
};

exports.getAgents = async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM callings');
    res.send({message:"Agents fetched successfully", data:rows ,status:200});
};