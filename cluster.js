require('dotenv').config();
const cluster = require('node:cluster');
const os = require('os');


const WORKERS = Math.min(os.cpus().length, 12);

if (cluster.isPrimary) {
  console.log(`🚀 Master ${process.pid} starting ${WORKERS} workers`);

  for (let i = 0; i < WORKERS; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.error(`💥 Worker ${worker.process.pid} died`);
    console.log('♻️  Restarting...');
    cluster.fork();
  });

} else {
  require('./server.js'); // your original file renamed to server.js
}