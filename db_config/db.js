const mysql = require('mysql2/promise');
// MySQL connection pool
require('dotenv').config();

const connection = mysql.createPool({
    host:  process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
},()=>{
    console.log("Connected to the database");
});
module.exports = connection;