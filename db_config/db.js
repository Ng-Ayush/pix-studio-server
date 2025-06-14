const mysql = require('mysql2/promise');
// MySQL connection pool
const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pixstudio',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
},()=>{
    console.log("Connected to the database");
});
module.exports = connection;