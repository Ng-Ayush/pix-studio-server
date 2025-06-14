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

// const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//   host: 'pixstudio-cartopiaa.f.aivencloud.com',
//   port: 21208,
//   user: 'avnadmin',
//   password: 'AVNS_JHpoaIKkill_c_5ymh2',
//   database: 'defaultdb',
//   ssl: {
//     rejectUnauthorized: false
//   },
//   waitForConnections: true,
//   connectionLimit: 10
// });

// (async () => {
//   const conn = await pool.getConnection();
//   const [rows] = await conn.query('SELECT NOW()');
//   console.log(rows);
//   conn.release();
// })();