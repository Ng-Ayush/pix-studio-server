require('dotenv').config();

const express = require('express');
const http = require('http');
const restoreSessions = require("./utils/restoreSessions");
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const waClients = new Map();

http.globalAgent.maxSockets = Infinity;
http.globalAgent.maxFreeSockets = 200;

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
// Middleware
// --------------------------------------------------
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/ai-uploads', express.static(path.join(__dirname, 'ai-uploads')));

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

server.listen(PORT, async () => {
  // await restoreSessions(waClients);
  console.log(`🚀 Server running on port ${PORT}`);
});