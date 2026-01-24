const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');


const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';


const pubClient = new Redis(redisUrl, {
maxRetriesPerRequest: null,
enableReadyCheck: false,
});


const subClient = pubClient.duplicate();


// 🔴 REQUIRED HANDLERS
pubClient.on('error', (err) => {
console.error('Redis pub error:', err.message);
});


subClient.on('error', (err) => {
console.error('Redis sub error:', err.message);
});


pubClient.on('connect', () => console.log('🟢 Redis pub connected'));
subClient.on('connect', () => console.log('🟢 Redis sub connected'));

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const waClients = new Map();
module.exports = waClients;


const scheduleAdminExpiryCheck = require('./utils/cron.js');

// --------------------------------------------------
// Init cron jobs
// --------------------------------------------------
scheduleAdminExpiryCheck();

// --------------------------------------------------
// Ensure upload directory exists
// --------------------------------------------------
const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// --------------------------------------------------
// App & Server
// --------------------------------------------------
const app = express();
const server = http.createServer(app);

// --------------------------------------------------
// Socket.IO
// --------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.adapter(createAdapter(pubClient, subClient));

// Expose io to controllers
app.locals.io = io;

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// app.use(express.static('uploads'));
app.use('/uploads', express.static('uploads'));

// --------------------------------------------------
// Socket connection handling
// --------------------------------------------------
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('register', (userId) => {
    if (!userId) return;
    console.log(`📡 Socket joined room: user_${userId}`);
    socket.join(`user_${userId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
  });
});

// --------------------------------------------------
// Routes
// --------------------------------------------------
app.use('/api/mystudio/auth', require('./routes/auth.routes.js'));
app.use('/api/mystudio/admin', require('./routes/user.routes.js'));
app.use('/api/mystudio/customers', require('./routes/customer.routes.js'));
app.use('/api/mystudio/dashboard', require('./routes/dashboard.routes.js'));
app.use('/api/mystudio/otp', require('./routes/otp.routes.js'));
app.use('/api/mystudio/photo-selection', require('./routes/photo-selection.routes.js'));
app.use('/api/mystudio/billing-customer', require('./routes/billingCustomerRoutes.js'));
app.use('/api/mystudio/invoice-items', require('./routes/invoiceItemsRoutes.js'));
app.use('/api/mystudio/invoices', require('./routes/invoices.route.js'));
app.use('/api/mystudio/estimates', require('./routes/estimates.routes.js'));
app.use('/api/mystudio/super-admin', require('./routes/admin.routes.js'));
app.use('/api/mystudio/manage-features', require('./routes/manageFeatureRoute.js'));
app.use('/api/mystudio/customer-request', require('./routes/customerRequestRoute.js'));
app.use('/api/mystudio/manage-profile', require('./routes/manageProfileRoute.js'));
app.use('/api/mystudio/calling', require('./routes/calling.routes.js'));
app.use('/api/mystudio/photos', require('./routes/upload.routes.js'));

// --------------------------------------------------
// Health check
// --------------------------------------------------
app.get('/health', (req, res) => {
  res.send({ status: 'ok', time: new Date().toISOString() });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
